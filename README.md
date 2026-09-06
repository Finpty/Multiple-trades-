# TRADE ONE

Multi-tenant platform for trade businesses. One deployment serves every
business; each business is generated and operated entirely from stored
configuration through the admin UI — no code changes, no developer, no AI
required.

## Quick start

```bash
cp .env.example .env            # set DATABASE_URL and PLATFORM_SECRET
pnpm install
pnpm setup                      # prisma generate + migrate deploy + seed
pnpm dev                        # http://localhost:3000
```

Sign in with the seeded platform owner (`SEED_OWNER_EMAIL` /
`SEED_OWNER_PASSWORD`). Demo tenants: http://localhost:3000/kabura and
http://localhost:3000/elite-plumbing.

## Documentation

- `docs/ARCHITECTURE.md` — layers, tenancy, request flow, generation engine
- `docs/DATABASE.md` — schema conventions, RLS, query rules, audit
- `docs/SECURITY.md` — authentication, authorization, secrets, media, domains
- `docs/DECISIONS.md` — architecture decision records
- `docs/PROGRESS.md` — status

## Scripts

| Command                 | Purpose                                   |
|-------------------------|-------------------------------------------|
| `pnpm dev` / `build` / `start` | Next.js                             |
| `pnpm typecheck`        | TypeScript                                |
| `pnpm db:migrate`       | Apply migrations (production)             |
| `pnpm db:migrate:dev`   | Create a migration (development)          |
| `pnpm db:rls`           | Regenerate RLS SQL after adding models    |
| `pnpm db:seed`          | Seed roles, catalogue, owner, demo        |
| `pnpm db:reset`         | Reset database and reseed                 |
| `pnpm test:e2e`         | Playwright end-to-end tests               |
