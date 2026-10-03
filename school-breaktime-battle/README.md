# School Breaktime Battle — Canteen Rush

A multiplayer, school-themed browser game. The host creates a room, students join with a
4-digit code, pick a character, and race out of class when the break bell rings: grab snacks
in the canteen, dodge the prefects, and get back to class before the final bell.

Version 1 contains one mode, **Canteen Rush**. No free chat — only preset reactions.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Without Supabase keys the app runs in **demo mode** (a yellow banner says so):

- **Practice alone against bots** on the landing page starts a room with 3 bots.
- **Create Game Room** also works: open a second tab in the same browser, choose
  **Join With Code**, and the two tabs play together (they talk through `BroadcastChannel`).

Other commands:

```bash
npm run build      # production build
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run test       # Vitest: rules, scoring, collision, bots
```

## Online multiplayer (Supabase)

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   ```

4. Restart `npm run dev`. The demo banner disappears and rooms work across devices.

Realtime uses Supabase **broadcast** on the channel `room:{roomCode}`; no table replication is
needed. Tables store rooms, players and match results (writes are best-effort and never block a
match). The RLS policies in the migration allow anonymous read/write of game records only — fine
for a school event, but tighten them before wider use.

**Message volume:** the host broadcasts a snapshot ~8×/s and each moving student sends its
position ~9×/s. A full 8-player room is well within paid-plan limits; on the free plan, keep an
eye on Realtime quotas or lower the rates in `lib/realtime/sync.ts`.

## Deploying to Vercel

This app lives in the `school-breaktime-battle/` folder of the repository. When importing the
repo in Vercel, set **Root Directory** to `school-breaktime-battle`, and add the two
environment variables above.

## How it works

### Host-authoritative multiplayer

- The host's browser runs the simulation (`HostRuntime`): timer, snack and power-up spawning,
  prefect patrols, bots, collisions and scoring. It broadcasts a `game_state` snapshot with the
  batched gameplay events (`snack_collected`, `powerup_collected`, `player_caught`, …).
- Each student's browser (`ClientRuntime`) moves its own character locally for instant
  response, sends `player_moved`, and draws everyone else smoothly from the snapshots.
- The lobby is also host-authoritative: `join_request` → `lobby_state` or `join_rejected`
  (room full, already started, duplicate or rude name).
- Heartbeats mark inactive students (the host can remove them) and show
  "Host disconnected." to students if the host goes quiet. There is no host migration in V1;
  if the host reloads mid-match, everyone returns to the lobby.
- Reloading a student tab reconnects to the room using the per-tab session.

### Code map

```
app/                      Pages: landing, create, join, lobby, game, results
components/ui             Button, Card, Input/Select, Badge
components/game           GameCanvas (Phaser), HUD, overlays, controls, reactions, leaderboard
components/lobby          Character select, player list
lib/game/engine.ts        Pure game rules (no Phaser/React) — shared by host, bots and tests
lib/game/map.ts           Zones, walls, obstacles, spawn points, prefect routes
lib/game/scoring.ts       Points, ranking and results
lib/game/bots.ts          Demo bots (doorway path-finding, prefect dodging)
lib/game/runtime.ts       Host and client match loops
lib/game/phaser/          The Phaser scene that draws the runtime
lib/realtime/             Event types, Supabase/BroadcastChannel transports, sync rates
lib/room/                 Room client (lobby protocol) and room/result persistence
store/gameStore.ts        Zustand store the React UI reads
supabase/migrations/      Database schema
```

## Game rules (V1)

| Event | Points |
| --- | --- |
| Biscuit / Chin Chin / Puff Puff / Zobo | 5 / 8 / 10 / 12 |
| Meat Pie / Indomie Bowl / Special Lunch Pack | 20 / 30 / 50 |
| Return to class (after at least one snack, once) | +25 |
| Caught by a prefect (and frozen 2 s) | −20 |
| Bump an obstacle (chair, bag, blocked path) | −5 |
| Outside class when the final bell rings | −30 |
| First time reaching the canteen | +5 |
| Snack streak (every 3rd snack within 4 s of the last) | +5 |
| Never caught, at least one snack (at the bell) | +10 |
| Entering the Staff Room | −10 |

Scores never go below zero. Ties are broken by fewer captures, then more snacks, then earliest
return to class. The extra rows after the main table cover the "reaching the canteen",
"streak", "avoiding prefects" and "restricted zone" items from the design brief; all values
live in `lib/game/constants.ts`.

**Power-ups:** Speed Shoes (faster for 5 s), Prefect Shield (blocks one capture),
Double Points (8 s). They apply as soon as they are picked up.

**Characters:** Fast Runner (+15% speed), Snack Lover (+2 per snack), Class Captain (starts
with a shield), Bookworm (power-ups last 30% longer), Football Boy (shorter stun after
obstacles), Quiet Genius (less slowed by spilled water and crowds).

**Controls:** arrow keys or WASD; on touch screens a large movement pad (it floats over the
game when a phone is held sideways). On small screens the camera zooms in and follows you.

## Sounds

Every effect has a built-in fallback tone, so no audio files are required. See
`public/sounds/README.md` to add real MP3s.

## Not in V1

Free chat, voice/video, accounts, teacher dashboard, more maps and the other planned modes
(Dodge the Prefect, Beat the Bell, Snack War, Lost Notebook Mission, Classroom Escape).
