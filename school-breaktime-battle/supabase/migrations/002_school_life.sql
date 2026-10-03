-- School Life: classes, students and friendships.
--
-- Students sign in with a class code, a display name and a 4-digit PIN. PINs are bcrypt
-- hashed and checked inside the database, with a lock-out after repeated wrong guesses.
-- The tables have row level security switched on with no policies, so the browser cannot
-- read or write them directly; everything goes through the functions below, which check a
-- per-student session token. Realtime presence uses broadcast on `life:{classCode}`.

create table if not exists life_classes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 2 and 40),
  teacher_name text not null check (char_length(teacher_name) between 2 and 40),
  created_at timestamptz not null default now()
);

create table if not exists life_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references life_classes(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 16),
  name_key text not null,
  pin_hash text not null,
  session_token uuid,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  profile jsonb not null default '{}'::jsonb check (pg_column_size(profile) < 32000),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (class_id, name_key)
);

create index if not exists life_students_session_token_idx on life_students (session_token);

create table if not exists life_friendships (
  class_id uuid not null references life_classes(id) on delete cascade,
  a uuid not null references life_students(id) on delete cascade,
  b uuid not null references life_students(id) on delete cascade,
  points integer not null default 0 check (points between 0 and 1000),
  updated_at timestamptz not null default now(),
  primary key (a, b),
  check (a < b)
);

create index if not exists life_friendships_b_idx on life_friendships (b);
create index if not exists life_friendships_class_idx on life_friendships (class_id);

alter table life_classes enable row level security;
alter table life_students enable row level security;
alter table life_friendships enable row level security;

-- Creates a class and returns its 6-character code (no easily confused characters).
create or replace function life_create_class(p_name text, p_teacher text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i integer;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 40
     or char_length(trim(coalesce(p_teacher, ''))) not between 2 and 40 then
    raise exception 'invalid_input';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    begin
      insert into life_classes (code, name, teacher_name) values (v_code, trim(p_name), trim(p_teacher));
      return v_code;
    exception when unique_violation then
      -- Code already used: try another.
    end;
  end loop;
end;
$$;

create or replace function life_class_info(p_code text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'name', c.name,
    'teacherName', c.teacher_name,
    'studentCount', (select count(*) from life_students s where s.class_id = c.id)
  )
  from life_classes c
  where c.code = upper(trim(p_code));
$$;

-- Signs a student in, creating them on first use. Returns { error } instead of raising so the
-- failed-attempt counter is kept.
create or replace function life_enter(p_code text, p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class life_classes;
  v_student life_students;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_key text := lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_token uuid := gen_random_uuid();
begin
  select * into v_class from life_classes where code = upper(trim(coalesce(p_code, '')));
  if not found then
    return json_build_object('error', 'class_not_found');
  end if;
  if char_length(v_name) not between 2 and 16 or v_name !~ '^[A-Za-z0-9 ._''-]+$' then
    return json_build_object('error', 'invalid_name');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    return json_build_object('error', 'invalid_pin');
  end if;

  select * into v_student from life_students where class_id = v_class.id and name_key = v_key for update;

  if not found then
    if (select count(*) from life_students where class_id = v_class.id) >= 60 then
      return json_build_object('error', 'class_full');
    end if;
    insert into life_students (class_id, display_name, name_key, pin_hash, session_token)
    values (v_class.id, v_name, v_key, extensions.crypt(p_pin, extensions.gen_salt('bf')), v_token)
    returning * into v_student;
    return json_build_object(
      'studentId', v_student.id, 'token', v_token, 'name', v_student.display_name,
      'isNew', true, 'profile', null, 'className', v_class.name
    );
  end if;

  if v_student.locked_until is not null and v_student.locked_until > now() then
    return json_build_object('error', 'locked', 'retryAfter', ceil(extract(epoch from v_student.locked_until - now())));
  end if;

  if extensions.crypt(p_pin, v_student.pin_hash) <> v_student.pin_hash then
    update life_students
      set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
          locked_until = case when failed_attempts + 1 >= 5 then now() + interval '5 minutes' else locked_until end
      where id = v_student.id;
    return json_build_object('error', 'wrong_pin');
  end if;

  update life_students
    set session_token = v_token, failed_attempts = 0, locked_until = null, last_seen = now()
    where id = v_student.id;
  return json_build_object(
    'studentId', v_student.id, 'token', v_token, 'name', v_student.display_name,
    'isNew', false, 'profile', nullif(v_student.profile, '{}'::jsonb), 'className', v_class.name
  );
end;
$$;

create or replace function life_save(p_token uuid, p_profile jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null or jsonb_typeof(p_profile) <> 'object' then
    return false;
  end if;
  update life_students set profile = p_profile, last_seen = now() where session_token = p_token;
  return found;
end;
$$;

-- Classmates (name and look only) plus my friendship points with each of them.
create or replace function life_roster(p_token uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me life_students;
begin
  select * into v_me from life_students where session_token = p_token and p_token is not null;
  if not found then
    return json_build_object('error', 'signed_out');
  end if;
  return json_build_object(
    'students', coalesce((
      select json_agg(json_build_object('id', s.id, 'name', s.display_name, 'look', s.profile -> 'look') order by s.display_name)
      from life_students s
      where s.class_id = v_me.class_id and s.id <> v_me.id
    ), '[]'::json),
    'friendships', coalesce((
      select json_object_agg(case when f.a = v_me.id then f.b else f.a end, f.points)
      from life_friendships f
      where f.a = v_me.id or f.b = v_me.id
    ), '{}'::json)
  );
end;
$$;

create or replace function life_add_friendship(p_token uuid, p_other uuid, p_points integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me life_students;
  v_other life_students;
  v_points integer := least(5, greatest(1, coalesce(p_points, 1)));
  v_total integer;
begin
  select * into v_me from life_students where session_token = p_token and p_token is not null;
  if not found then
    return null;
  end if;
  select * into v_other from life_students where id = p_other and class_id = v_me.class_id;
  if not found or v_other.id = v_me.id then
    return null;
  end if;
  insert into life_friendships (class_id, a, b, points)
  values (v_me.class_id, least(v_me.id, v_other.id), greatest(v_me.id, v_other.id), v_points)
  on conflict (a, b) do update
    set points = least(1000, life_friendships.points + excluded.points), updated_at = now()
  returning points into v_total;
  return v_total;
end;
$$;

revoke all on function life_create_class(text, text) from public;
revoke all on function life_class_info(text) from public;
revoke all on function life_enter(text, text, text) from public;
revoke all on function life_save(uuid, jsonb) from public;
revoke all on function life_roster(uuid) from public;
revoke all on function life_add_friendship(uuid, uuid, integer) from public;

grant execute on function life_create_class(text, text) to anon, authenticated;
grant execute on function life_class_info(text) to anon, authenticated;
grant execute on function life_enter(text, text, text) to anon, authenticated;
grant execute on function life_save(uuid, jsonb) to anon, authenticated;
grant execute on function life_roster(uuid) to anon, authenticated;
grant execute on function life_add_friendship(uuid, uuid, integer) to anon, authenticated;
