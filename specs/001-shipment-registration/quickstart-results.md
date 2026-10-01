# Quickstart Results: Shipment Registration and Dispatch Board

**Date**: 2026-09-30 · **Branch**: `001-shipment-registration-impl` · **Task**: T120

Every manual validation scenario of [quickstart.md](quickstart.md) is automated as an
end-to-end test (Playwright, real PostgreSQL 18, the API in test mode with a controllable
clock) and was also checked by hand in the development app. All scenarios pass. Every
end-to-end test also checks its final screen against WCAG 2.2 AA (axe), and
`accessibility.spec.ts` checks every panel screen at 1280 px and 600 px wide.

| # | Story | Result | Automated by |
| --- | --- | --- | --- |
| 1 | US1 | Pass | `register-shipment.spec.ts` › registers a delivery on merchant account at the standard fee |
| 2 | US1 | Pass | `register-shipment.spec.ts` › uses the merchant rate card |
| 3 | US1 | Pass | `register-shipment.spec.ts` › derives the COD amount from the payment mode |
| 4 | US1 | Pass | `register-shipment.spec.ts` › requires a manual fee with a reason for an errand |
| 5 | US2 | Pass | `dispatch-board.spec.ts` › flags a shipment at risk, then late, without reloading |
| 6 | US2 | Pass | `dispatch-board.spec.ts` › lists yesterday's undelivered shipment under the pending section |
| 7 | US2 | Pass | `dispatch-board.spec.ts` › shows a shipment registered elsewhere within 30 seconds |
| 8 | US3 | Pass | `edit-void-shipment.spec.ts` › edits the COD amount and voids another shipment |
| 9 | US3 | Pass | `edit-void-shipment.spec.ts` › refuses the second of two concurrent saves and keeps its values |
| 10 | US4 | Pass | `bulk-registration.spec.ts` › registers a pasted list, with fixes in the preview; registers an uploaded spreadsheet |
| 11 | US5 | Pass | `history-search.spec.ts` › finds shipments by recipient phone, newest first, and exports them |
| 12 | US6 | Pass | `master-data.spec.ts` › schedules a standard rate for tomorrow |
| 13 | US7 | Pass | `access.spec.ts` › gives each role its own access |
| 14 | US7 | Pass | `access.spec.ts` › locks sign-in after five failures and says when to retry |
| 15 | US1 | Pass | `register-shipment.spec.ts` › adds the express surcharge and prices a carrier handoff by its place |
| 16 | US6 | Pass | `master-data.spec.ts` › lets the dispatcher add a neighborhood for review, not change zones |
| 17 | US7 | Pass | `access.spec.ts` › refuses to deactivate the only owner |

Success criteria measured in tests:

- **SC-004**: a shipment registered in one browser appears on another open board after one
  poll (20 seconds), under the 30-second limit (`dispatch-board.spec.ts`).
- **SC-005**: at-risk from 45 minutes before the latest delivery time and late right after it
  (`shipment-flags.test.ts`, `board.test.ts`, `dispatch-board.spec.ts`).
- **SC-006**: search by tracking number, merchant reference, and recipient phone among
  100,000 shipments answers in well under 2 seconds (`search-scale.test.ts`; measured under
  70 ms on a laptop).
- **SC-001, SC-002, SC-008** (time and learnability with real users) are measured during the
  owner's acceptance with the dispatcher, before go-live.

## Go-live checklist

- [ ] Amy Tecnology rates confirmed by the owner (the seed infers them from the ledger).
- [ ] Rates for Caldas and Girardota defined by the owner (until then those shipments need a
      manual fee and are marked "Tarifa por revisar").
- [ ] Real merchants, pickup points, couriers, and carriers loaded and reviewed with the owner.
- [ ] Production `.env` complete: `APP_URL` with the public address, `RESEND_API_KEY` with a
      verified sender domain for `EMAIL_FROM`, and a new `BETTER_AUTH_SECRET`.
- [ ] The owner changes the password printed by the seed on first sign-in.
- [ ] Optional: `SENTRY_DSN` and `VITE_SENTRY_DSN` for error reporting.
