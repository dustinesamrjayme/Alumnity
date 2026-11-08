# Alumnity: Change Plan and Ranked Fixes

2026-11-06

Nothing is implemented yet. This ranks the five requested changes plus 18 further fixes, found after reading the app code, `schema_v2.sql` and `package.json`. Stack: Angular 19, Ionic 8, Capacitor 7, Supabase.

## Your five requested changes

| # | Change | How it will be done |
| --- | --- | --- |
| A | Remove the admin button; add mock accounts | Delete "Organizer tools" from the alumni and volunteer profiles, and "Switch to attendee view" from the dashboard. Add three mock accounts: `maria.santos@plv.edu.ph` (alumni), `admin@plv.edu.ph`, `volunteer@plv.edu.ph`. Login redirects by role and a `roleGuard` blocks other areas. The mock session carries the same `user_role` claim the Supabase JWT will. |
| B | Cut boilerplate | One shared profile page, one shared scanner, one event-card component. Header moves into the shell. Formatting helpers become pipes. Volunteer "Events" becomes a list of events to scan instead of an alumni copy. |
| C | Reorganize | `core/` (services, guards, models), `shared/` (pipes, UI components), `features/{auth,alumni,admin,volunteer}`, `layout/shell`, `styles/` partials. |
| D | Integrate, Supabase-ready | A repository layer: each service (`Auth`, `Events`, `Registrations`, `CheckIn`) is an abstract class with a `Mock` and a `Supabase` implementation. Switching is one provider line driven by `environment.useMock`; pages never know which is active. |
| E | Sharper cards | Cut the global radius `--r` from 20px to about 6px, and apply the same radius to buttons, inputs, pills and the tab bar so nothing looks mismatched. |

## Tier 1: the app is broken without these

1. **Tab bar and layout.** `ion-app { width: 30% }` must go; it is the likely reason the tab bar is hidden.
2. **Slots left can't work on Supabase.** RLS lets alumni read only their own registrations, so they can't count remaining seats. Add a small `get_event_availability()` function (security definer, returns event id and registered count). Without it the backend swap fails on the first screen.
3. **Registration form doesn't match the schema.** `register_for_event` takes only an event id; phone, department, program and batch live on the `users` row. Registration becomes "confirm your profile, then register", and profile completion moves to the profile and sign-up screens. Sign-up also needs a real form with `username` (required, unique).
4. **Payment and check-in are two backend steps.** The UI treats "Payment collected" as the check-in. Supabase needs `confirm_payment` then `sync_check_ins`, so the mock should follow the same two-step flow.
5. **Store bugs.** Closed events accept registrations, duplicates go through, check-in isn't idempotent, and the "Cancelled" tile shows the pending count. The mock will copy the SQL rules: closed rejects, full rejects, one active registration per user per event.

## Tier 2: needed for a clean Supabase handoff

6. **One model.** Use the backend's shape (numeric ids, `name`, `event_date`, `price`, and `capacity` that can be null for unlimited) and drop the duplicate types. Route ids get parsed to numbers.
7. **Real offline queue.** Store `PendingCheckIn` rows (`client_id` UUID, `device_time`) through `@capacitor/preferences`, and derive the pending count from the queue. Scanning looks up the QR token in the cached attendee list, so it works offline.
8. **QR holds the UUID `qr_token`**, not a guessable ticket ID, and is rendered on the device (works offline).
9. **Drop the QR image upload to Storage.** The SQL has no `registration-qr` bucket or storage policies, so the upload would fail. Item 8 makes it unnecessary.
10. **Per-user tickets.** Filter tickets by the signed-in user, and clear or namespace user data on logout so the next login doesn't inherit it.
11. **Derived values, not stored counters.** Registered, checked-in and slots left are computed. "Past" and "open" derive from `status` and `event_date`, so the hard-coded past-events list goes. The event `theme` isn't in the schema, so it rotates by id or comes from the banner image.

## Tier 3: quality and safety

12. **Fix `searchUsers()` filter injection.** Replace the string-built `.or()` with a safer query.
13. **Drop `users.password_hash`** (a SQL change). Supabase Auth already stores credentials and the schema's own comment says the column is unused; a second copy of password hashes is a liability.
14. **One storage service** (Capacitor Preferences) instead of scattered `window` and `localStorage` use.
15. **Real camera scanning.** `package.json` has no barcode plugin, so add `@capacitor-mlkit/barcode-scanning` for devices, with manual entry as a fallback.
16. **Config and tooling.** Move `environment.ts` to `src/environments/` with a prod file; self-host fonts via `@fontsource`; add ESLint, Prettier and strict TypeScript flags; add a test runner, since `package.json` has none.
17. **Accessibility pass.** Alt text, label-to-input links, zoom allowed in the viewport meta, and real links or buttons instead of bare `<a (click)>`.
18. **No event delete in the UI.** `events_admin_write` allows deletes, but registrations reference events, so a delete would fail; offer close and reopen only.

## Decisions needed before implementation

- [ ] **Mock passwords:** one shared dev password for all three accounts (e.g. `demo1234`), or email only as the login works now?
- [ ] **Card radius:** is about 6px sharp enough, or closer to 2 to 4px?
- [ ] **Extra SQL:** include `get_event_availability` and dropping `password_hash` as a `schema_v3.sql` file in the same pass?
- [ ] **Ranking:** add, drop or reorder any items above.
