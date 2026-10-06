# RupeeWise Budget

RupeeWise is an INR-first personal finance tracker for Indian users. It helps users record income and expenses, track monthly budgets, review category spend, and get AI-assisted saving insights.

## Stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/Radix UI
- Recharts
- Supabase Auth, Postgres, Realtime, and Edge Functions

## Getting started

Use npm as the package manager for this repository.

```sh
npm ci
cp .env.example .env
npm run dev
```

Fill `.env` with your Supabase project values before using auth or data-backed features.

## Scripts

```sh
npm run dev        # local development server
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # TypeScript project check
npm run test       # Vitest test suite
npm run check      # lint + typecheck + test + build
```

## Environment variables

```sh
VITE_SUPABASE_PROJECT_ID="your-supabase-project-id"
VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-anon-key"
VITE_SUPABASE_URL="https://your-project-id.supabase.co"
```

Supabase Edge Functions also require server-side secrets such as `LOVABLE_API_KEY`. Configure those in Supabase, not in frontend `.env` files.

## Supabase notes

- Tables: `transactions`, `budgets`, `transaction_history`.
- RLS policies scope user data by `auth.uid()`.
- AI functions require authenticated JWTs.
- `ALLOWED_ORIGINS` can be set for Edge Function CORS. If unset, local dev and the Lovable production domain are allowed.

## Quality gates

Before merging changes, run:

```sh
npm ci
npm run check
npm audit --omit=dev
```

`npm audit --omit=dev` is expected to pass with zero production vulnerabilities. Some remaining audit findings may be dev-toolchain-only until major upgrades such as Tailwind/Vite/Vitest are planned.
