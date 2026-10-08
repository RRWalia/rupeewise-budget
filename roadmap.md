# Roadmap — Audit recommendations implementation

All items below are implemented on `main` and verified by CI (lint → typecheck → tests → build, runs #20–#26).

## P0
- [x] ErrorBoundary around app/pages (no blank white screen)
- [x] sms-ingest hardening: rate limit (30 req / 60 s sliding window per bot, HTTP 429), attempt logging table (`sms_ingest_logs`), stricter validation (secret min length, 2 KB text cap)

## P1
- [x] Lazy-load routes (/budget, /approvals, /settings) + charts
- [x] Remove redundant toaster (keep one)
- [x] Approvals: realtime subscription for new pending SMS
- [x] Empty states: Index (first use), Approvals, Budget
- [x] PWA manifest + icons (home-screen install, no service worker)
- [x] BottomNav: pending-approvals count badge + a11y

## P2 (selected)
- [x] CSV export of transactions in Settings
- [x] Clipboard copy fallback in Settings

## Deploy notes (Lovable Cloud)
- Migrations and edge functions deploy via Lovable's GitHub sync — after sync, verify `sms_ingest_logs` exists and `sms-ingest` returns 429 under burst, then run one end-to-end forwarded-SMS test.
