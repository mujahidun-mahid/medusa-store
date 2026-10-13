# Medusa Store — v2 shop backend + admin dashboard
Live backend + admin served by one Render container (Node 22, bundled Redis),
data in Supabase Postgres.

Deploy: push to `master` (or Render dashboard → Manual Deploy).
Seed (one-time, already done): `npx medusa exec ./src/scripts/seed.ts`
Admin user: created via `npx medusa user -e <email> -p <password>`
