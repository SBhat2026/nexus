# Nexus — AI Research Navigator

Phase 1: Next.js 16 + Tailwind v4 + D3 + Supabase scaffold. Mock data only.

## Local dev

```bash
npm run dev      # http://localhost:3000
npm run build    # production build check
```

## Supabase setup

1. Create a project at supabase.com
2. Enable pgvector: in the SQL editor run `create extension if not exists vector;`
3. Run `supabase/migrations/0001_init.sql` in the SQL editor
4. Copy your project URL and anon key from Settings → API

## Vercel deploy

1. `git push` to GitHub
2. Import repo in Vercel
3. Set env vars:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY`
4. Deploy

## Phase 2 (next)
- Semantic Scholar API integration (`/api/session/create`)
- JS DBSCAN clustering via `density-clustering` (inline in Next.js API route)
- Isolation Forest for outlier detection
- Real graph data replacing `lib/mockGraph.ts`
