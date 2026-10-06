# RupeeWise Budget — Senior Developer Product & Architecture Feedback

**Review date:** 2026-10-06  
**Branch reviewed:** `arena/7737566d-rupeewise-budget`  
**Scope:** Repository architecture, user flow, product objectives, data/security posture, build/test health, and recommended upgrade roadmap.

---

## 1. Executive summary

RupeeWise is a promising MVP for an Indian personal finance tracker. The current product supports authentication, transaction CRUD, a dashboard, monthly budget settings, category spend visualisation, and AI-assisted categorisation/insights backed by Supabase and Supabase Edge Functions.

The UI foundation is strong for an MVP: mobile-first navigation, shadcn/Radix primitives, Tailwind design tokens, INR formatting, and a clear “track money + budget + AI tips” positioning. However, I would **not treat this as production-ready yet**. The main production risks are:

1. **Reliability/build hygiene:** `npm ci` fails because lockfiles are out of sync; lint currently fails; tests are placeholder-only.
2. **Cost/performance risk:** AI insights can be triggered repeatedly because dashboard polling refreshes transactions every 5 seconds and the AI insights component fetches on every transaction array change.
3. **Financial correctness issues:** Budget-category spend is not filtered to the current month; savings projection logic is inaccurate; trend labels are hardcoded.
4. **Data model mismatch:** AI autocomplete can suggest categories the frontend/budget model does not support.
5. **Auth/security hardening:** Password reset routes are incomplete, Edge Function JWT verification is disabled in config, CORS is wildcard, `.env` is tracked, and audit history is client-written rather than server-enforced.

**Recommendation:** Before feature expansion, run a hardening sprint focused on deterministic installs/CI, data correctness, AI rate control, and Supabase schema constraints/indexes.

---

## 2. Inferred product objectives

Based on the code and product copy, RupeeWise is aiming to be:

- A simple INR-first finance tracker for Indian users.
- A quick-entry transaction tracker for UPI, cards, wallets, and cash.
- A monthly dashboard for income, expenses, budget usage, savings, and category spend.
- A budget planning tool with total and per-category monthly limits.
- An AI-assisted assistant for category suggestions and actionable savings insights.

That objective is coherent. The main gap is that the current implementation does not yet guarantee month-level financial correctness or scalable AI usage.

---

## 3. Current architecture overview

### Frontend stack

- Vite + React + TypeScript.
- Tailwind CSS + shadcn/Radix UI components.
- React Router for `Dashboard` and `Budget Planning` routes.
- React Query is installed and provided, but core data fetching currently uses custom hooks/state rather than React Query caching.
- Recharts for dashboard charts.
- Framer Motion for UI animation.

### Backend/data stack

- Supabase Auth for email/password and Google OAuth through Lovable cloud auth.
- Supabase Postgres tables:
  - `transactions`
  - `budgets`
  - `transaction_history`
- Supabase RLS policies exist for user-owned transactions and budgets.
- Supabase Realtime publication includes `transactions`.
- Supabase Edge Functions:
  - `ai-autocomplete`
  - `ai-insights`
- AI calls are routed through `https://ai.gateway.lovable.dev/v1/chat/completions`.

### Current app flow

```text
main.tsx
  └─ App.tsx
      └─ QueryClientProvider
          └─ BrowserRouter
              └─ AuthGuard
                  ├─ Auth page if unauthenticated
                  └─ TransactionsProvider
                      └─ AppLayout
                          ├─ Sidebar / Bottom nav
                          ├─ AddTransactionDialog
                          └─ Routes
                              ├─ /        -> Dashboard
                              └─ /budget  -> Budget Planning
```

### Data flow

```text
User action
  ├─ Auth page -> useAuth -> Supabase Auth
  ├─ Add/Edit/Delete transaction -> useTransactions -> Supabase transactions table
  ├─ Budget settings -> useBudget -> Supabase budgets table
  ├─ AI category suggestion -> useAIAutocomplete -> ai-autocomplete Edge Function
  └─ AI insights -> useAIInsights -> ai-insights Edge Function
```

---

## 4. Validation results

I installed dependencies without changing lockfiles using `npm install --package-lock=false`, then ran the core checks.

### Install/reproducibility

- `npm ci` **fails** because `package.json` and `package-lock.json` are not in sync.
- The repo contains multiple lockfiles/package-manager artifacts: `package-lock.json`, `bun.lock`, and `bun.lockb`.

### Build

- `npm run build` **passes**.
- Build warning: CSS `@import` appears after Tailwind directives in `src/index.css`.
- Build warning: main JS bundle is large: about **1.245 MB** minified, **358.55 KB gzip**.

### Lint

- `npm run lint` **fails**.
- Current result: **11 errors, 9 warnings**.
- Main causes:
  - `any` types in charts, transactions, and Edge Functions.
  - Empty interface patterns in shadcn components.
  - `require()` in Tailwind config.
  - React hook dependency warning in `AIInsightsCard`.

### Tests

- `npm run test` **passes**, but only runs one placeholder test: `expect(true).toBe(true)`.
- There is currently no meaningful coverage for auth, transactions, budget calculations, AI fallback handling, or RLS-driven flows.

### Security audit

- `npm audit --omit=dev` reports **5 high severity production vulnerabilities**.
- Full audit reports more issues, including critical dev/transitive issues. Because lockfiles are inconsistent, dependency health should be cleaned up before treating audit counts as final.

---

## 5. What is working well

1. **Clear MVP user journey**  
   Sign in, add transactions, see dashboard, configure monthly budget.

2. **Good mobile-first UX direction**  
   Desktop sidebar plus mobile bottom nav is appropriate for a consumer finance tracker.

3. **Supabase is a practical backend choice**  
   Auth, RLS, Realtime, migrations, and Edge Functions are reasonable for this product stage.

4. **RLS direction is correct**  
   Later migrations moved away from open MVP policies toward user-owned access.

5. **AI is server-side**  
   AI API keys are kept in Edge Functions rather than exposed directly to the browser.

6. **Edit/delete functionality exists**  
   This is important for user trust in a finance app.

7. **Typed Supabase client exists**  
   The project has a generated `src/integrations/supabase/types.ts`, even though strict typing is not fully enforced yet.

---

## 6. Priority findings and recommended actions

## P0 — Fix before production/beta expansion

### P0.1 Deterministic install is broken

**Finding:** `npm ci` fails because `package-lock.json` does not match `package.json`. The repo also contains both npm and Bun lockfiles.

**Impact:** CI/CD, deployment, vulnerability audit, and onboarding will be unreliable.

**Recommendation:**

- Choose one package manager for the repo.
- If npm is chosen, regenerate `package-lock.json` with a clean `npm install`, remove Bun lockfiles if not needed, and enforce `npm ci` in CI.
- If Bun is chosen, document Bun usage and remove stale npm lockfile if the platform allows it.

---

### P0.2 Lint fails and TypeScript strictness is disabled

**Finding:** Lint currently fails. TypeScript config has `strict: false`, `noImplicitAny: false`, and related checks disabled.

**Impact:** A finance app should be stricter than an average UI app because small type/date/category errors become money-reporting errors.

**Recommendation:**

- Fix existing lint errors.
- Add CI gates for `lint`, `test`, and `build`.
- Gradually move `strict` to `true`; start with domain/data files first.

---

### P0.3 AI insights can be called repeatedly and become expensive

**Finding:** `useTransactions` always polls every 5 seconds. `AIInsightsCard` calls `fetchInsights(transactions)` whenever the transaction array changes. Since refetching creates a new array, dashboard users with transactions can repeatedly call the AI Edge Function.

Relevant files:

- `src/hooks/useTransactions.ts`
- `src/components/AIInsightsCard.tsx`
- `src/hooks/useAIInsights.ts`

**Impact:** High AI cost, rate limiting, slow dashboard, poor user experience.

**Recommendation:**

- Do not call AI automatically on every transaction-array refresh.
- Cache AI insights per user/month/transaction fingerprint.
- Add a manual “Refresh insights” action or debounce/throttle to once per meaningful change.
- Store generated monthly insight snapshots in Supabase if insights are meant to persist.
- Remove default 5-second polling; use filtered realtime and a longer/manual fallback.

---

### P0.4 Budget page compares monthly budget against lifetime spending

**Finding:** `Budget.tsx` computes `categorySpending` from all transactions without filtering to the current month.

Relevant file:

- `src/pages/Budget.tsx`

**Impact:** Category progress bars become more wrong every month. Users may think they exceeded this month’s budget because historical spending is included.

**Recommendation:**

- Filter transactions by selected budget month.
- Add a month selector so users can view/edit previous and future budgets.
- Centralize month filtering in a shared utility to avoid dashboard/budget drift.

---

### P0.5 AI autocomplete category list does not match frontend categories

**Finding:** Edge Function categories include values like `Food Delivery`, `Bills`, `Subscriptions`, `Fuel`, `Investment`, `Business`, and `Rent`, while the frontend category model does not. The frontend can display/apply unsupported AI categories through the category suggestion path.

Relevant files:

- `supabase/functions/ai-autocomplete/index.ts`
- `src/lib/mockData.ts`
- `src/components/CategoryDropdown.tsx`
- `src/components/AddTransactionDialog.tsx`

**Impact:** Transactions can be saved with categories that charts/budgets do not handle consistently.

**Recommendation:**

- Define categories in one shared source of truth.
- Align DB constraints, frontend categories, AI prompt categories, and budget category columns.
- Consider a normalized `categories` table instead of hardcoded category columns.

---

### P0.6 Password reset flow is incomplete

**Finding:** Password reset redirects to `/auth`, but the app has no `/auth` route. If the user is authenticated after reset redirect, `/auth` falls into `NotFound`. There is also no visible “set new password” form.

Relevant files:

- `src/hooks/useAuth.ts`
- `src/App.tsx`
- `src/pages/Auth.tsx`

**Impact:** Users may be unable to complete password resets.

**Recommendation:**

- Add explicit `/auth` and `/reset-password` routes.
- Detect Supabase recovery session and show an update-password form.
- Add tests for forgot password and recovery redirect behavior.

---

## P1 — Important hardening and scale improvements

### P1.1 Centralize auth state

**Finding:** `useAuth()` sets up its own Supabase listener every time it is used. It is called by `AuthGuard`, `Auth`, `Header`, and `AppSidebar`.

**Impact:** Multiple auth subscriptions, repeated session checks, and potential state drift.

**Recommendation:**

- Create `AuthProvider`/`AuthContext` once near app root.
- Expose `user`, `session`, `loading`, and auth actions from context.
- Pass user id into transaction/budget hooks rather than calling `supabase.auth.getUser()` repeatedly.

---

### P1.2 Move server state to React Query

**Finding:** React Query is installed and provided but custom hooks manually manage caching/loading/refetch state.

**Impact:** Duplicate fetching, no stale-time control, no centralized invalidation, and harder offline/loading behavior.

**Recommendation:**

- Use React Query for transactions, budgets, insight snapshots, and mutation invalidation.
- Keep form-local state in components.
- Use query keys like `['transactions', userId, month]` and `['budget', userId, month]`.

---

### P1.3 Realtime subscription is unfiltered and polling is too aggressive

**Finding:** The transactions realtime channel subscribes to all transaction table changes and fetches again on every event. It also always polls every 5 seconds.

**Impact:** Wasteful at scale; any table change can trigger all active clients to refetch.

**Recommendation:**

- Subscribe only after user id is available.
- Add a realtime filter such as `user_id=eq.${user.id}` where supported.
- Use realtime as primary and a much less frequent fallback.
- Consider server-side updated timestamps and cursor-based sync as the dataset grows.

---

### P1.4 Date/month logic needs a shared local-date utility

**Finding:** Several components use `new Date().toISOString().split('T')[0]` and direct `new Date(dateString)` month calculations.

**Impact:** In India, `toISOString()` can produce yesterday’s date between local midnight and 05:29. Month boundaries and date formatting can become inconsistent.

**Recommendation:**

- Add utilities like `getLocalDateInputValue()`, `getMonthKey(date)`, and `parseDateOnlyLocal(date)`.
- Use those utilities everywhere: add/edit transaction, dashboard filtering, budget month key, and charts.

---

### P1.5 Savings/trend calculations are misleading

**Findings:**

- Savings projection uses a fixed 31 days.
- The UI says “Projection based on last 4 weeks’ average spending,” but the code prorates current-month spend.
- Negative projected savings are clamped to zero.
- “+12% / -8% vs last month” is hardcoded.
- Dashboard passes current-month transactions into a chart that attempts monthly grouping, resulting in a one-point chart.

**Impact:** Users may make financial decisions based on inaccurate analytics.

**Recommendation:**

- Create a tested finance analytics module.
- Calculate real days-in-month.
- Show deficits as negative instead of clamping.
- Calculate actual month-over-month deltas from historical data.
- Decide whether “savings trend” is monthly trend, weekly trend, or forecast, then align the data and copy.

---

### P1.6 Audit history should be database-owned

**Finding:** Transaction edit history is generated on the client and inserted after the transaction update.

**Impact:** History can be skipped, tampered with, or fail after the transaction update. It is not a reliable audit trail.

**Recommendation:**

- Move transaction history creation into a Postgres trigger or secure RPC.
- Add RLS rules that ensure history belongs to the same user and transaction owner.
- Add UI to view history only if this is a product requirement.

---

### P1.7 Database schema should enforce business rules

**Findings:**

- `user_id` remains nullable in typed schema.
- Amount positivity is not enforced in the DB.
- `payment_mode`, `type`, and category constraints are loose.
- Budget categories are fixed columns, which makes adding categories harder.
- Indexes are not explicitly added for common queries.

**Recommendation:**

- Add constraints: amount > 0, valid transaction type, valid payment mode.
- Make `user_id` not null after migration/backfill.
- Add indexes:
  - `transactions(user_id, date desc)`
  - `budgets(user_id, month)`
  - `transaction_history(user_id, transaction_id, edited_at desc)`
- Evaluate moving category budgets to a child table:
  - `budget_categories(budget_id, category_id, amount)`
- Consider a `categories` table per user plus default system categories.

---

### P1.8 AI/security/privacy hardening

**Findings:**

- Edge Function config has `verify_jwt = false`, while functions manually validate the bearer token.
- CORS uses `Access-Control-Allow-Origin: *`.
- The app sends transaction summaries/details to an external AI gateway.
- There is no explicit user consent or settings control for AI analysis.
- No app-level rate limiting is visible.

**Recommendation:**

- Enable Supabase JWT verification if compatible with the Lovable setup.
- Restrict CORS origins for production.
- Add AI opt-in/consent copy and a privacy disclosure.
- Minimize data sent to AI; send aggregates unless transaction-level detail is necessary.
- Add rate limiting/user quotas in Edge Functions.

---

## P2 — Product and UX upgrade opportunities

### P2.1 Upgrade onboarding

Add a guided first-run setup:

1. Monthly income.
2. Savings goal.
3. Top spending categories.
4. First transaction.
5. Explain AI opt-in.

This will make an empty dashboard feel intentional rather than incomplete.

---

### P2.2 Add month navigation everywhere

The app is clearly monthly-budget oriented, but it only operates on the current month. Add a month picker on dashboard and budget pages so users can review past periods and plan future ones.

---

### P2.3 Add transaction filters/search/export

Recommended filters:

- Month/date range.
- Category.
- Payment mode.
- Income/expense.
- Text search in notes.

Recommended export:

- CSV export for a selected month or date range.

---

### P2.4 Add recurring transactions

Many Indian household transactions recur monthly: rent/home loan, EMIs, SIPs, tuition, subscriptions, salary. Recurring transactions would materially improve product value.

---

### P2.5 Expand payment/account model

Current payment mode is only `UPI`, `Card`, `Cash`. Consider:

- Bank account.
- Credit card.
- UPI app/source.
- Wallet.
- Net banking.
- Account transfers.

This unlocks better reporting and reconciliation later.

---

### P2.6 Make AI actionable, not decorative

Current AI cards are informational. Stronger product patterns:

- “You are ₹X over Shopping budget — reduce by ₹Y/week.”
- “Create a budget rule from this insight.”
- “Mark this suggestion useful/not useful.”
- “Explain how this was calculated.”
- “Generate monthly review.”

---

### P2.7 Add notifications

Useful notifications:

- 80% and 100% category budget thresholds.
- Weekly spending summary.
- Month-end budget review.
- Recurring transaction reminders.

---

### P2.8 Improve SEO/branding polish

- README is still mostly default Lovable content.
- Open Graph description/image still references Lovable generated content.
- `index.html` has a leftover TODO comment.
- Rename package from `vite_react_shadcn_ts` to a product name such as `rupeewise-budget`.

---

## 7. Suggested roadmap

### Sprint 0 — Engineering hygiene and release safety

**Goal:** Make the project reproducible, testable, and deployable.

- Standardize on one package manager.
- Fix lockfile and make `npm ci` or equivalent pass.
- Fix lint errors.
- Add GitHub CI: install, lint, test, build.
- Move `.env` to `.env.example` and ensure secrets/environment files are ignored.
- Upgrade vulnerable production dependencies, especially router-related packages.
- Add basic smoke tests for dashboard and auth rendering.

**Exit criteria:** Clean install, lint, tests, and build all pass in CI.

---

### Sprint 1 — Financial correctness

**Goal:** Users can trust the numbers.

- Add shared date/month utility.
- Fix budget page to use current/selected month spending.
- Add month selector.
- Replace hardcoded trends with real month-over-month values.
- Correct savings projection and copy.
- Add unit tests for all finance calculations.

**Exit criteria:** Budget and dashboard numbers are covered by tests and match expected month-level calculations.

---

### Sprint 2 — Data model and security hardening

**Goal:** Make Supabase safe and scalable.

- Add DB constraints and indexes.
- Make `user_id` non-null where possible.
- Move audit history into DB trigger/RPC.
- Align category system across frontend, DB, and AI.
- Filter realtime by user and reduce polling.
- Harden Edge Function JWT/CORS/rate limits.

**Exit criteria:** Schema enforces core business rules; no client-only audit trail; realtime and AI are controlled.

---

### Sprint 3 — Product depth

**Goal:** Increase user value beyond simple tracking.

- Onboarding wizard.
- Recurring transactions.
- Filters/search/export.
- Budget alerts.
- AI monthly review and actionable recommendations.
- Improved privacy controls.

---

## 8. Recommended technical target architecture

```text
App Root
  ├─ AuthProvider
  ├─ QueryClientProvider
  ├─ Theme/Tooltip/Toast Providers
  └─ Router
      ├─ Public routes
      │   ├─ /auth
      │   └─ /reset-password
      └─ Protected routes
          ├─ AppLayout
          ├─ /dashboard?month=YYYY-MM
          ├─ /budget?month=YYYY-MM
          ├─ /transactions
          └─ /settings

Domain modules
  ├─ services/supabase
  ├─ features/auth
  ├─ features/transactions
  ├─ features/budgets
  ├─ features/insights
  └─ lib/finance-calculations

Data layer
  ├─ React Query hooks
  ├─ typed mutations
  ├─ central invalidation
  └─ realtime event sync

Supabase
  ├─ normalized schema
  ├─ RLS + constraints + indexes
  ├─ DB-owned audit history
  └─ rate-limited Edge Functions
```

---

## 9. PM decision points

These are product-level decisions needed before the next engineering push:

1. **Package manager:** npm or Bun?
2. **Category model:** fixed default categories only, or user-customizable categories?
3. **AI policy:** opt-in or enabled by default? Transaction-level data or aggregates only?
4. **Budgeting model:** one monthly overall budget plus categories, or category-first budgets with rollup?
5. **Target user:** individual personal finance only, or family/shared household budgeting later?
6. **Data import:** manual entry only for MVP, or CSV/SMS/UPI statement import on roadmap?
7. **Audit history:** internal engineering trace only, or user-visible edit history?

---

## 10. Bottom-line recommendation

The product has a good MVP base, but the next best investment is not more UI features. The next best investment is a **two-sprint hardening phase**:

1. **Sprint 0:** lockfile/CI/lint/security cleanup.
2. **Sprint 1:** month/date/budget/analytics correctness.

Once those are done, RupeeWise will be in a much better position to add user-facing upgrades like recurring transactions, import/export, alerts, and more advanced AI insights.
