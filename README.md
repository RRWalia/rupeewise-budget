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
# Optional: Google Search Console HTML-tag content value
VITE_GOOGLE_SITE_VERIFICATION=""
```

Supabase Edge Functions also require server-side secrets such as `LOVABLE_API_KEY`. Configure those in Supabase, not in frontend `.env` files.

## Google Search Console

The production site and SEO canonical URLs use `https://rupeewise-budget.lovable.app/`. To verify it with Google Search Console:

1. Add a **URL-prefix** property for `https://rupeewise-budget.lovable.app/` in Search Console.
2. For the recommended **HTML file** method, the downloaded verification file is `google77280abb8794a6d3.html`. It is in `public/`, so Vite serves it from the site root after deployment at `https://rupeewise-budget.lovable.app/google77280abb8794a6d3.html`. Keep the filename and contents unchanged.
3. Deploy the site, then click **Verify** in Search Console. Keep the file deployed so ownership remains verified.
4. Submit `https://rupeewise-budget.lovable.app/sitemap.xml` in the property's **Sitemaps** section.

Alternatively, choose **HTML tag** verification and set the tag's `content` value as `VITE_GOOGLE_SITE_VERIFICATION` in the production build environment; Vite injects that meta tag into the initial HTML response at build time. DNS TXT verification is also available if you prefer Google's DNS method.

The public homepage provides crawlable product information; the authenticated app, sign-in and password-reset routes are marked `noindex` and are not listed in the sitemap. Search Console reports how Google crawls the site, but indexing and ranking take time and are not guaranteed.

## Supabase notes

- Tables include `transactions`, `budgets`, `transaction_history`, `bot_chats`, and `pending_transactions`.
- RLS policies scope user data by `auth.uid()`; SMS approval writes go through ownership-checked database functions.
- AI functions require authenticated JWTs.
- `ALLOWED_ORIGINS` can be set for Edge Function CORS. If unset, local dev and the Lovable production domain are allowed.
- Apply migrations in order, including `20261007000002_sms_approvals.sql`, and deploy the Telegram Edge Functions after changing them.

## Bank SMS review

RupeeWise is a web app and does not read the phone's SMS inbox. To bring SMS into the app, an Android user can configure a separate SMS-forwarding/automation tool to forward only selected bank transaction alerts to the connected Telegram bot. iOS does not expose background SMS access to third-party apps.

Forwarded debit and credit alerts are parsed and categorized into `pending_transactions`. Preserve the sender ID in forwarded text when possible; otherwise prefix the message with `SMS:`. They do not affect balances until the user opens **Approvals**, checks or edits the suggested type, amount, date, payment mode and category, then approves. Dismissal never creates a transaction. Ordinary Telegram messages such as `Coffee 150` keep the existing direct-log behavior.

The webhook stores the parsed fields and a one-way message fingerprint for deduplication; it does not persist the original SMS body. Configure the phone-side forwarder to exclude OTPs, login codes and promotional messages. The parser also declines recognizable OTP, failed and promotional alerts, but phone-side filtering is still recommended.

## Quality gates

Before merging changes, run:

```sh
npm ci
npm run check
npm audit --omit=dev
```

`npm audit --omit=dev` is expected to pass with zero production vulnerabilities. Some remaining audit findings may be dev-toolchain-only until major upgrades such as Tailwind/Vite/Vitest are planned.
