-- Student Life: no teacher role. Any student can start a school (a group with a code) and
-- share the code with friends.

alter table life_classes alter column teacher_name drop not null;
alter table life_classes drop constraint if exists life_classes_teacher_name_check;

drop function if exists life_create_class(text, text);

create or replace function life_create_class(p_name text)
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
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception 'invalid_input';
  end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    begin
      insert into life_classes (code, name) values (v_code, trim(p_name));
      return v_code;
    exception when unique_violation then
      null; -- code already used: loop and try another
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
    'studentCount', (select count(*) from life_students s where s.class_id = c.id)
  )
  from life_classes c
  where c.code = upper(trim(p_code));
$$;

revoke all on function life_create_class(text) from public;
grant execute on function life_create_class(text) to anon, authenticated;
