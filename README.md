# Heartfleet

**Heartfleet** is a two-player Battleship experience with a gentle, wholesome social twist. Players place fleets, take turns attacking coordinates, and unlock **Heartbeats**—moments to ask and answer questions as the match unfolds.

The game preserves classic Battleship combat while adding opportunities for conversation. Its intended play session is approximately **30–45 minutes**.

## Gameplay

- **Two-player rooms:** One player creates a room and shares its invite code; the other joins.
- **Fleet placement:** Both players arrange and confirm their ships before the match begins.
- **Turn-based combat:** Players alternate shots, recording hits, misses, sunk ships, and victory.
- **Hearts:** Players earn Hearts from gameplay milestones, including successful attacks and sinking ships.
- **Heartbeats:** An eligible player can spend **3 Hearts** to activate a conversation moment. The opponent chooses a curated or custom question; the initiator can answer or skip.
- **Gentle & Wholesome tone:** Heartbeats emphasize light, considerate interaction. Unresolved Heartbeats do not automatically expire.
- **Combat pause:** While a Heartbeat is awaiting a question or response, combat is paused. It resumes after the Heartbeat is completed or skipped.

## Technology

- **Next.js** with **React** and **TypeScript**
- **Supabase / PostgreSQL** for room, match, fleet, Hearts, and Heartbeat data
- **PostgreSQL functions and triggers** for game rules and milestone rewards
- **Playwright** for end-to-end testing

## Prerequisites

To run your own copy of Heartfleet, you need:

- Node.js and npm (use the versions supported by `package.json`)
- A **separate Supabase project** (or Docker Desktop to run Supabase locally)
- The Supabase CLI, available through `npx supabase`
- Two dedicated test accounts if you intend to run multiplayer E2E tests

## Getting started (for contributors and people cloning the repository)

These instructions are for someone setting up Heartfleet **from a fresh clone**. You do **not** need access to the original Heartfleet Supabase project or its database password.

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_HEARTFLEET_REPOSITORY.git
cd YOUR_HEARTFLEET_REPOSITORY
npm install
```

Replace the repository URL and folder name with the actual repository location.

### 2. Create your own database

Choose **one** of these approaches:

**Option A — Local Supabase (recommended for development and tests)**

Install and start Docker Desktop, then run:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

`supabase start` launches a local Supabase instance. `db reset` applies the SQL migrations in `supabase/migrations/` to the **local** database; it also deletes existing local records. `supabase status` displays local connection information and API keys.

**Option B — Your own hosted Supabase project**

1. Create a new project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Obtain its project reference from the dashboard.
3. Link the clone to **your new project**, not the original author's project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_OWN_PROJECT_REF
   ```

4. Review the committed migrations, then apply them to **your own** database:

   ```bash
   npx supabase db push
   ```

   `db push` changes the linked remote database. Only run it against a project you control and after reviewing the migrations.

**Important:** Both approaches require the repository to include a complete, tested `supabase/migrations/` directory. If migrations have not yet been committed, the schema cannot be recreated from the clone alone; contact the maintainer for the missing database setup.

### 3. Configure the application

Create your local environment file from the committed template:

**PowerShell**

```powershell
Copy-Item .env.example .env.local
```

**macOS / Linux**

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in **every variable defined by `.env.example`** using values from your own Supabase instance. For local Supabase, use `npx supabase status`; for hosted Supabase, use the dashboard's API settings. Use public/publishable keys only in variables intended for browser use, and keep secret/service-role keys server-side. Never copy the original project's credentials.

If the app's authentication configuration requires redirect URLs, allow `http://localhost:3000` and any callback URL specified in the project configuration in **your own** Supabase Auth settings.

### 4. Run Heartfleet

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Create or sign in to two accounts in your own environment to try multiplayer rooms and gameplay.

## Database migrations (maintainers)

**Cloners should follow the database setup above.** The commands in this section are for maintainers updating the committed schema from an existing Heartfleet Supabase project.

After changing the original hosted database, link to the correct project and pull changes:

```bash
npx supabase login
npx supabase link --project-ref YOUR_MAINTAINER_PROJECT_REF
npx supabase db pull
```

Review and commit the resulting SQL files in `supabase/migrations/`. They should include application tables, constraints, indexes, RLS policies, functions, and triggers. In particular, verify Heartfleet's functions `fire_game_shot`, `initialize_game_hearts`, `award_game_shot_hearts`, `award_game_sunk_hearts`, `grant_game_heart_milestone`, `activate_game_heartbeat`, `choose_game_heartbeat_question`, and `respond_game_heartbeat`.

Do not export player records or credentials. Custom objects attached to managed schemas such as `auth` may need additional inspection. Before publishing, validate the migrations by applying them to a clean **local** Supabase instance:

```bash
npx supabase start
npx supabase db reset
```

## End-to-end test environment (for contributors)

Playwright tests create rooms, place ships, fire shots, and mutate game records. **Run them against your own isolated local or test Supabase database**, never a production database.

Create the E2E environment file:

**PowerShell**

```powershell
Copy-Item .env.e2e.example .env.e2e
```

**macOS / Linux**

```bash
cp .env.e2e.example .env.e2e
```

Fill in the variables in `.env.e2e.example` with values for your own test environment. Prepare two test accounts corresponding to the Playwright fixtures `playerA` and `playerB`; consult the authentication setup code for how those credentials are supplied. The test runner must point to a running Heartfleet instance configured for that same test database.

Keep `.env.local`, `.env.e2e`, and Playwright session files private. The committed `.env.example` and `.env.e2e.example` files should contain placeholders only.

## Testing with Playwright

The end-to-end suite includes multiplayer gameplay and Heartbeat tests. Tests use authenticated Playwright fixtures and may create fresh rooms, submit fleets, fire shots, and resolve Heartbeats.

### Install browser dependencies

```bash
npx playwright install
```

### Prepare authentication

Start the development server against your test database in a separate terminal (`npm run dev`) before running browser tests, unless your Playwright configuration starts it automatically.


The project uses a Playwright `setup` project to establish authenticated browser sessions, stored locally under `playwright/.auth/`.

Run the setup project before using `--no-deps`:

```bash
npx playwright test --project=setup
```

> Check `playwright.config.ts` for the exact configured project names and authentication requirements. The commands below use the existing `setup` and `player-a` project names.

### Run gameplay tests

```bash
npx playwright test match-gameplay.spec.ts --project=player-a --no-deps --workers=1
```

Run a single gameplay case:

```bash
npx playwright test match-gameplay.spec.ts --project=player-a --no-deps --workers=1 --grep "HF-G01"
```

Run a subset:

```bash
npx playwright test match-gameplay.spec.ts --project=player-a --no-deps --workers=1 --grep "HF-G(01|02|11)"
```

### Run Heartbeat tests

```bash
npx playwright test heartbeat.spec.ts --project=player-a --no-deps --workers=1
```

Run a single Heartbeat case:

```bash
npx playwright test heartbeat.spec.ts --project=player-a --no-deps --workers=1 --grep "HF-H25"
```

Run a subset:

```bash
npx playwright test heartbeat.spec.ts --project=player-a --no-deps --workers=1 --grep "HF-H(19|20|21|22|23|24)"
```

### Full regression

Run all tests for the player A project using the existing authentication state:

```bash
npx playwright test --project=player-a --no-deps --workers=1
```

Or run the entire configured Playwright suite, including project dependencies:

```bash
npx playwright test
```

Use `--no-deps` **only when the authentication setup has already completed and the saved sessions are still valid**. Otherwise, omit `--no-deps` or rerun the setup project.

`--workers=1` runs tests sequentially, which is useful while diagnosing shared test-account or database interactions.

### View test reports and traces

If the Playwright HTML reporter is configured, open its report with:

```bash
npx playwright show-report
```

For a failed test that generated a trace:

```bash
npx playwright show-trace path/to/trace.zip
```

Playwright typically writes failure artifacts under `test-results/`. Check the test output for the exact path.

### Test coverage overview

| Suite | Test IDs | Focus |
| --- | --- | --- |
| Match gameplay | `HF-G01`–`HF-G15` | Fleet confirmation, turn rules, attacks, ship sinking, match completion, access control |
| Heartbeats | `HF-H00`–`HF-H25` | Rewards, activation, question selection, answering, skipping, history, validation, concurrency, persistence, post-match behavior |

These IDs describe the planned/implemented test cases; **their presence does not imply that every test has passed**. Run the full suite to establish the current status.

### Troubleshooting

**Authentication failures:** Recreate the Playwright authentication state by running the `setup` project. Confirm the test accounts and environment values are valid.

**Invalid invite code:** Confirm the room-creation response is parsed correctly. The create-room API returns a nested structure like `{ "room": { "id": "...", "code": "...", "status": "waiting" } }`; the join helper must use `room.code` from the nested object.

**Unexpected attack hit in a test:** When generating a guaranteed miss, compare the target coordinate against the fleet belonging to the player **receiving** the shot, not the player firing it.

**Long-running tests:** Match completion and Heartbeat setup can involve many sequential requests. Some tests specify longer per-test timeouts.

**Anonymous requests appear authenticated:** Use a fresh Playwright API request context with empty cookies and origins to verify anonymous access, rather than a request context inherited from an authenticated player.

## Production checks

Before deploying changes:

```bash
npm run build
```

Run the E2E regression suite against the intended test environment and verify database permissions, authentication, and room membership checks. Never use production accounts or data for destructive E2E tests.

## Project status

Heartfleet is under active development and test validation. Gameplay and Heartbeat flows have dedicated Playwright coverage; complete regression and authorization verification remain release checks.
