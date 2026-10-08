# Roadmap — Audit recommendations implementation

## P0
- [ ] ErrorBoundary around app/pages (no blank white screen)
- [ ] sms-ingest hardening: rate limit, attempt logging table, stricter validation

## P1
- [ ] Lazy-load routes (/budget, /approvals, /settings) + charts
- [ ] Remove redundant toaster (keep one)
- [ ] Approvals: realtime subscription for new pending SMS
- [ ] Empty states: Index (first use), Approvals, Budget
- [ ] PWA manifest + icons (home-screen install, no service worker)
- [ ] BottomNav: pending-approvals count badge + a11y

## P2 (selected)
- [ ] CSV export of transactions in Settings
- [ ] Clipboard copy fallback in Settings
