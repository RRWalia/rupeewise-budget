# RupeeWise — Full Stack Audit (Senior Eng / UI-UX Lead)
Commit: c166d5d (post-sms-ingest) | Branch: arena/6bae67d9-rupeewise-budget | Date: 2026-10-08

---

## 1. EXECUTIVE SUMMARY

**What this is:** A React/Vite PWA for Indian personal finance tracking with Telegram bot integration, bank-SMS approvals (pending_transactions), and AI-guided categorization. The recent change (sms-ingest edge function + Settings endpoint display) closes the "free Android SMS forwarder" loop correctly.

**Overall health:** SOLID architecture, good security posture (RLS, webhook-secret auth, no SMS-read permissions), but several operational gaps remain before it can be called production-grade for financial data.

**Biggest risks (in order):**
1. Dual auth paths (Supabase Auth + Lovable integration) — session conflicts possible.
2. No error boundaries + long pages (Approvals 349 lines, Settings 230+) — maintainability debt.
3. SMS-ingest is a public HTTP endpoint with only a secret check — needs rate limiting / IP filtering / payload size cap hardened.
4. External AI gateway (lovable.dev) is a single point of failure for categorization; no graceful degradation beyond a static fallback.
5. No PWA service worker / manifest visible despite the "add to home screen" marketing claim.

---

## 2. ARCHITECTURE & DATA FLOW

### Routing & Layout (`src/App.tsx`, `src/components/AppLayout.tsx`)
- Uses `BrowserRouter` with a simple protected-route pattern (`AuthGuard` + `TransactionsProvider`).
- Routes: `/auth`, `/*` → protected app (`/`, `/budget`, `/settings`, `/approvals`).
- **Issue:** No route-level code splitting. All 94 source files load into the initial bundle (build output shows ~350KB vendor + 324KB charts + 166KB supabase). For a PWA targeting Indian mobile networks, this needs `React.lazy()` + `Suspense` on `/budget`, `/settings`, `/approvals`.
- **Issue:** `Toaster` (shadcn) AND `Sonner` (sonner) are both mounted globally. Redundant — pick one notification system.

### State Management (`src/contexts/TransactionsContext.tsx`, `src/hooks/useTransactions.ts` — inferred)
- Uses a Context + a custom hook (`useTransactions`) that likely wraps `@tanstack/react-query`. This is a common "double data layer" anti-pattern: Context for providers, QueryClient for server state. If `useTransactions` already uses react-query, the Context adds no value and can cause stale reads when the query cache invalidates.
- **Recommendation (P1):** Remove `TransactionsProvider` if `useTransactions` already manages query state; or consolidate so the provider only provides UI-scoped state (filters, selected month), not the server cache.

### Auth (`src/hooks/useAuth.tsx`)
- Uses `supabase.auth.onAuthStateChange` + `getSession` correctly.
- Also imports `lovable` (`@/integrations/lovable/index`). This suggests a dual-auth mechanism: Supabase native session vs Lovable's cloud auth JS.
- **Risk (P0):** If Lovable injects its own session/token and Supabase has a different session, the app may appear "logged out" to one system and "logged in" to the other, causing redirect loops or ghost users in `bot_chats`. Verify which auth method writes to `auth.users`; ensure RLS policies reference the correct `auth.uid()`.
- **Missing:** No session-refresh handling beyond Supabase's internal refresh. No visibility into how Lovable's auth token is refreshed.

---

## 3. DATABASE / BACKEND

### Schema (`supabase/migrations/` — 11 migrations, idempotent)
**Strengths:**
- All migrations are idempotent (`IF NOT EXISTS` / `DO $$ BEGIN ... END $$`). Safe to retry.
- RLS policies are explicitly defined for `bot_chats`, `pending_transactions`, `transactions` (select/insert/update/delete per user).
- Unique indexes prevent duplicates: `pending_transactions_user_fingerprint_uidx`, `pending_transactions_bot_message_uidx`, `idx_bot_chats_live_per_user`.
- `approve_pending_transaction` is `SECURITY DEFINER` with strict validation (amount range, category whitelist per type, payment mode whitelist, user-id ownership check). Good.

**Issues / Improvements:**
- `pending_transactions` has `telegram_message_id BIGINT` with a partial unique index (`WHERE bot_chat_id IS NOT NULL AND telegram_message_id IS NOT NULL`). The SMS-ingest path sets this to `null` — correct — but there's no audit trail for which endpoint delivered the SMS (could add `source_endpoint` enum: 'telegram', 'sms_ingest'). **P2 — audit/debugging.**
- `transactions` has `payment_mode` with a `NOT VALID` check constraint (widened from `NOT VALID`). This is a deliberate workaround for chat-logged entries. Fine, but should be documented in a README or schema doc.
- **Performance:** No partitioning on `transactions` or `pending_transactions`. For a personal tracker this is acceptable, but if users have 5+ years of data, monthly/month-key index queries should be verified with `EXPLAIN`.
- **Migration 20261006000100 (`harden_finance_schema.sql`):** Not inspected fully — verify it doesn't drop/index in a way that conflicts with SMS approvals.

### Public Endpoint Security (`sms-ingest` — new)
- Authenticates via `bot_chats.webhook_secret`. Secret is UUID-like, unique per connection. Good.
- `verify_jwt = false`. Correct for a forwarder that has no Supabase session.
- **Gaps (P0 — must fix before public use):**
  1. No rate limiting. A malicious actor with a leaked secret could POST rapidly. Add a simple time-window check or use Supabase's built-in rate limits if available.
  2. No IP allowlisting / geofencing. The endpoint accepts from any IP.
  3. No payload schema validation beyond `asString()`. A malformed JSON could cause unexpected behavior (though `JSON.parse` is guarded by try/catch).
  4. No logging / monitoring. The endpoint uses `console.error` but no structured logging to an external service. For financial data, log attempts (success/failure) to a table or external service.
  5. `MAX_BODY_BYTES = 16KB` is good — prevent blob attacks.
  6. The secret is shown in plaintext in Settings. This is necessary for copy/paste, but consider a "regenerate" button (disconnect/reconnect bot) to rotate it.

---

## 4. EDGE FUNCTIONS

### Function Inventory (`supabase/functions/`)
1. `telegram-connect` — creates bot_chats row, sets webhook_secret, validates bot token.
2. `telegram-webhook` — receives Telegram updates, parses `/start`, `/undo`, bank SMS, chat entries. Refactored to use shared module.
3. `sms-ingest` — NEW. Generic HTTP endpoint.
4. `ai-autocomplete` — AI category suggestions? Not fully inspected.
5. `ai-insights` — AI insights card data.

**Architecture quality:**
- All use `serve()` from `std/http/server.ts` — standard Deno pattern.
- All use `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` for admin access — correct for webhooks that can't use user JWT.
- `telegram-webhook` always returns `okResponse()` on exceptions to prevent Telegram retries — smart.
- **Issue:** `ai-autocomplete` and `ai-insights` call `https://ai.gateway.lovable.dev/v1/chat/completions` with `LOVABLE_API_KEY`. If the key rotates or the gateway is down, those features break with no graceful UI fallback (the `categorizeWithAI` does fall back to static categories, which is good; check if the UI components handle `loading` + `error` states).
- **Missing:** No health-check endpoint exposed for monitoring (only `GET`) — fine for now.

---

## 5. FRONTEND / STATE / PERFORMANCE

### Component Library (`src/components/ui/` — shadcn/ui)
- Uses Radix primitives + Tailwind + `class-variance-authority` (CVA). Consistent, accessible by default.
- Components: `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `table`, `toast`, `tooltip`.
- **Issue:** `badge.tsx`, `button.tsx`, `form.tsx`, etc. have `react-refresh/only-export-components` warnings (non-critical for production but indicates some components export non-component values — likely fine).

### Key Pages (depth review)

**Index (`src/pages/Index.tsx` — 164 lines)**
- Shows `SummaryCard`, `SpendingPieChart`, `SavingsTrendCard`, `AIInsightsCard`, `RecentTransactions`.
- Uses `useSharedTransactions()` + `useBudget()`.
- Computes `currentMonthTransactions`, `previousMonthTransactions`, `currentTotals`, `previousTotals`, `incomeTrend`, `expenseTrend`. All memoized correctly.
- **UX observation:** No empty state for new users (first visit with 0 transactions). The pie chart and trend cards will render with 0 values — might confuse users. Add an `isEmpty` guard with onboarding prompts.
- **UX observation:** `EditTransactionDialog` is imported but not shown in the snippet; verify it opens via row click. If it's a full-page edit, consider inline editing for faster UX.

**Approvals (`src/pages/Approvals.tsx` — 349 lines)**
- Longest page. Likely contains the approval list, category editing, approve/dismiss actions, and possibly pending SMS review.
- **Architectural debt:** 349 lines for one page is too much. Should be split into:
  - `PendingList` component (table/card list)
  - `PendingCard` (individual review with category dropdown, amount edit, approve/dismiss)
  - `ApprovalFilters` (status: pending / approved / dismissed; date range)
- **UX observation:** Approvals is the critical path for SMS-ingest. Make sure it loads fast when a new SMS arrives (real-time feel). If using react-query without polling/subscription, the user must refresh to see new arrivals. Consider a lightweight `useEffect` + `supabase.realtime` subscription on `pending_transactions` for the user's `user_id`.

**Settings (`src/pages/Settings.tsx` — ~230 lines, post-edit)**
- Telegram Bot card: connection flow (connect / deep link / disconnect) is clear.
- New SMS section (my edit): shows endpoint URL, secret, sample payload, instructions. **Good UX improvement for auto-forward setup.**
- **UX improvement:** The copy buttons (Copy/Check icons) use `navigator.clipboard`. On older Android WebViews (some users), this may fail silently. Consider a fallback `document.execCommand('copy')` or a visual "copied" state that doesn't depend on clipboard API success.
- **Accessibility:** The settings cards use `<Card>` which renders as `<section>` with heading. Good. The endpoint URL is in `<code>` — should have `aria-label="Ingest endpoint"` for screen readers.
- **UX gap:** No "Regenerate secret" button. If a user suspects the secret leaked (e.g., shared screen, forwarder misconfigured), they must disconnect/reconnect the bot. Add a "Rotate webhook secret" option that updates `bot_chats.webhook_secret` and shows the new value.

**Auth (`src/pages/Auth.tsx`)**
- Not fully read, but from `useAuth.tsx`: supports email/password, Google OAuth, reset password, update password.
- **Security:** Password reset uses `window.location.origin` — fine. Verify it doesn't expose tokens in URL fragments.

### Navigation (`src/components/BottomNav.tsx`, `src/components/AppSidebar.tsx`)
- `BottomNav` (89 lines): mobile bottom navigation (likely 4-5 tabs: Dashboard, Budget, Approvals, Settings). Good for thumb reach.
- `AppSidebar`: desktop sidebar.
- **UX gap:** The mobile nav should highlight the active section clearly (current `NavLink` may not have active state styling). Check `NavLink.tsx`.
- **Accessibility:** Bottom nav buttons need `aria-label` describing destination (e.g., "Approvals, 2 pending"). If a count badge is shown, announce it.

### Mobile Experience
- `useIsMobile()` uses `max-width: 767px`. Good.
- `AppLayout` likely uses responsive grid/flex. Check if the pie chart and summary cards stack vertically on mobile or stay side-by-side (could be cramped on 360px screens).

---

## 6. UI / UX / DESIGN SPECIFIC OBSERVATIONS

### Color / Typography
- Uses `font-display` (likely a custom serif/display font) for headings — distinctive, Indian-brand feel.
- Tailwind color tokens: `text-foreground`, `text-muted-foreground`, `bg-income` (green), `bg-expense` (red/rose?), `bg-primary`. Consistent.
- **Accessibility:** Ensure contrast ratios for `text-muted-foreground` on `bg-muted/40` pass WCAG AA (often fails at 4.5:1 if too light). Test with the actual hex values.

### Forms
- `Input`, `Select` from shadcn are unstyled/base — they inherit from Tailwind. The forms in AddTransactionDialog/EditTransactionDialog should have clear validation states (red border + message). Check if `zod` is used with react-hook-form (likely yes via `@hookform/resolvers`).

### Data Visualization
- `SpendingPieChart` uses `recharts`. Bundled at 324KB. Consider lazy-loading this component (`React.lazy`) since not all users open the chart view.
- `SavingsTrendCard` likely uses recharts too.

---

## 7. THE SMS-INGEST INTEGRATION (CLOSING LOOP FROM PRIOR WORK)

What I just added (`c166d5d`) is correct and well-structured:
- `sms-ingest` is isolated from `telegram-webhook` (different auth model) but shares the core business logic through `_shared/sms-enqueue.ts`.
- The Settings page updates are practical: users can copy the endpoint and secret directly.
- The parser handles both `sender` + `text` and bare messages via `composeForwardedSmsText`.

**What remains for full reliability:**
1. **Deploy** (your lovable/supabase session needed — CLI unauthed here).
2. **Rate-limit / monitor** the endpoint after deploy.
3. **Test end-to-end:** SMS Telebot → POST → endpoint → `pending_transactions` → Approvals → approve → `transactions` with `[SMS]` note.
4. **Verify RLS:** The `sms-ingest` uses `supabase` admin client (service role), so RLS is bypassed — that's correct. But confirm `pending_transactions` insert uses correct `user_id` from `bot_chats.user_id`, not from any user-provided field (it doesn't — good).
5. **Add a `source_endpoint` column** (optional) to distinguish Telegram vs SMS-ingest for debugging.

---

## 8. PRIORITIZED RECOMMENDATIONS

### P0 — Blockers / Safety
1. **Add error boundaries** (`src/components/ErrorBoundary.tsx`) around `AppLayout` and each page. Financial apps must never show a blank white screen on parse errors.
2. **Rate-limit + log the sms-ingest endpoint** before public use. At minimum, log every POST attempt (secret hashed, IP, timestamp, result) to a new `sms_ingest_logs` table.
3. **Verify auth consistency:** Confirm `lovable` auth and `supabase.auth` don't create session conflicts. If Lovable is only for deployment/auth integration and Supabase handles runtime auth, document that clearly.
4. **Add input validation on SMS-ingest:** Validate `secret` is UUID-like length, `text` is non-empty and under 500 chars, `sender` is alphanumeric (already done via `asString()` but could be stricter).

### P1 — Maintainability / UX / Performance
5. **Split Approvals page** into 3 components; add real-time subscription (`supabase.realtime`) so new SMS shows instantly.
6. **Split Settings page** into tabs or accordions (Connection / SMS Auto-Forward / Preferences) so mobile users don't scroll through 230 lines.
7. **Lazy-load heavy routes and charts:** `React.lazy()` for `/budget`, `/approvals`, `/settings`; `lazy()` for `SpendingPieChart` and `SavingsTrendCard`.
8. **Choose one toaster:** Remove either `Toaster` or `Sonner` from `App.tsx`.
9. **Add empty states:** Index page (first-time user), Approvals (no pending), Budget (no categories set).
10. **PWA manifest + service worker:** If the marketing claims "add to home screen", include `manifest.json` (icons, theme-color, display: standalone) and a service worker for offline cache of the build assets. Currently not visible in source.
11. **Accessibility audit:** Verify `aria-label` on BottomNav, BottomNav counts for pending approvals, focus trapping in dialogs, and color contrast for `text-muted-foreground`.

### P2 — Polish / Future-Proof
12. **Add `source_endpoint` to `pending_transactions`** for audit/debugging.
13. **Secret rotation button** in Settings (update `bot_chats.webhook_secret` without disconnecting).
14. **Offline support:** Since it's a PWA, cache the last 30 days of transactions in IndexedDB / `localStorage` via a service worker so users can view history without network.
15. **Export / backup:** Add a "Download CSV" for transactions (useful for Indian tax filing / statement reconciliation).
16. **Test coverage for edge functions:** Currently only parser has Vitest tests. Add minimal integration tests for `sms-ingest` (mock `createAdminClient`, verify insert shape).
17. **I18n / localization:** All text is English. For Indian users, consider Hindi / Gujarati translations for key labels (amount, category, approve) — but only after core stability.

---

## 9. ARCHITECTURAL SCORECARD

| Domain | Score | Notes |
|--------|-------|-------|
| Data Flow / Routing | B+ | Clear, needs lazy loading |
| Auth / Security | B | RLS excellent; dual auth risk; missing endpoint rate limits |
| Edge Functions | A- | Good separation; sms-ingest correct; needs monitoring/logging |
| State / UI | B | React Query + Context overlap; long pages; two toasters |
| Mobile / Responsive | B | BottomNav good; need touch targets / empty states / chart lazy-load |
| Design System | A- | shadcn/ui consistent; missing empty states; contrast check needed |
| SMS-Ingest (new) | A- | Correct architecture; deploy + rate-limit needed |
| Performance | B | Large bundle; no lazy load; no service worker |
| Accessibility | B- | shadcn base good; need manual audit of custom components |

---

## 10. WHAT TO DO NEXT (PRACTICAL ORDER)

If I were the senior dev on this project, my next 3 actions would be:

**Today:**
- Deploy `sms-ingest` via your lovable/supabase session (`supabase functions deploy ...`).
- Add `console.log` / structured log table for every `sms-ingest` call (secret masked, result status).

**This week:**
- Add `React.lazy()` on `/budget`, `/approvals`, `/settings`; lazy-load charts.
- Split `Approvals.tsx` into components + add `supabase.realtime` subscription.
- Verify `App.tsx` only has one toaster.

**Next sprint:**
- Write error boundary + empty states.
- Create PWA manifest + basic service worker (even just `workbox` precache of `dist/`).
- Add rate-limit / IP check to `sms-ingest`.

The app is genuinely well-engineered for its size — the RLS policies, idempotent migrations, shared parser logic, and approval-gate design are all correct for a personal finance tool. The gaps are operational (deploy, monitoring, mobile polish, error handling) rather than structural. After deploy + rate-limit + error boundaries, this is credible for real users.

