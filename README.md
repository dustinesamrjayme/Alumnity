# PLV Alumni Events — Ionic Angular (standalone)

Ionic 8 + Angular 19 standalone port of the HTML/CSS/JS prototype. No NgModules; every page is a lazy-loaded standalone component.

## Run
```bash
npm install
npx ng serve          # or: ionic serve
```
Log in with any valid email and any non-empty password.

## Native (Capacitor)
```bash
npm run build
npx cap add android   # and/or ios
npx cap sync
npx cap open android
```

## Structure
- `src/app/app.routes.ts` — two tab shells: `/tabs` (attendee: Events, My Tickets, Profile) and `/admin` (organizer: Dashboard, Events, Check-in). Organizer workspace is reachable from Profile.
- `src/app/core/demo-store.service.ts` — signal-based store persisted to localStorage (session, events, tickets, attendees, pending sync). Replace with real API services when a backend exists.
- `src/app/components/` — `shell.page` (tab bar), `app-header` (logo, avatar, online/pending bar).
- `src/global.scss` — the prototype's styles, ported as-is.

## Changes from the prototype
- Real QR codes (`qrcode` package) and working PNG download on the ticket page.
- Registration, event create/edit, close/reopen registration, check-in, and the scanner's ticket-code entry all update shared state.
- Check-ins made while offline raise the pending count; "Sync now" clears it.

## Still prototype-level
No backend or real auth, no camera QR scanning (the "Open camera" button is a placeholder; add `@capacitor-mlkit/barcode-scanning`), and sync is simulated.
