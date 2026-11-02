# Online release scope

> **Superseded by the owner on 2026-11-02:** offline operation stays required for the courier app,
> whether installed or opened in the phone's browser. The dispatch panel stays online-only, as
> 001 already specifies. The deferral below no longer applies: physical offline acceptance
> (003/T087, T093) and the failed iPhone offline reopening again block go-live. This document
> remains the record of the 2026-10-23 decision and its evidence.

## Owner decision — 2026-10-23

The owner explicitly states that offline operation is not required by the client for
the immediate release and directs engineering to stop spending release time on it.
This decision supersedes earlier instructions to finish physical offline acceptance
before this delivery. Infrastructure and production deployment remain owner-operated.

## Immediate delivery

Deliver the existing application for use with an internet connection: registration,
dispatch, courier pickups/deliveries, photos, collections, exceptions, tracking and
merchant links. Retain current authorization, financial integrity, audit history,
private-photo access and idempotency requirements. Retain existing offline code,
outbox data and regression coverage; this decision does not authorize removing them.

Physical offline reopening, airplane-mode records, restart persistence and reconnect
acceptance are deferred from this release. Do not continue their phone exercises or
diagnostics as release prerequisites. Do not advertise offline operation as accepted.
Do not clear browser storage or reinstall over pending work.

## Evidence and limits

- The owner reports Pixel 10 testing works; no itemized Android receipt was supplied.
- iPhone 15 online native records verify two pickups, delivery with uploaded photo,
  delivery without photo, receiver/location, a COP 50,000 cash + 35,000 company transfer
  with uploaded receipt, and an 80,000 collection against 85,000 with an explanatory note.
  These effects were applied once. Human timings and OS versions were not supplied.
- Installed iPhone offline reopening displayed the application's connection error.
  Its cause is undetermined; the local CA was not installed. No data loss was established.
  Keep this failed observation; do not reclassify it as passed.
- Local candidate `9918d1` retains passing check, 1,626 tests, 155 zero-retry browser
  cases and build, with the identities and limits in the consolidation receipt.
- Follow-up read-only HTTPS probes pass on the real iPhone synthetic records: four
  anonymous tracking reads, merchant day, four merchant details and the uploaded
  delivery proof. Shared strict schemas and no-store/noindex headers pass. Merchant
  totals agree with COP 130,000 cash and 35,000 company transfer. Its six shipments
  include the two later offline fixtures. The first probe incorrectly expected four
  merchant shipments; that harness assertion is retained and corrected to six.
  These probes do not establish physical public-page rendering or mobile-data access.

## Remaining delivery work

The connected API review and release handoff documentation are complete locally;
the native HTTPS evidence and its physical-device limits are recorded above.
Real provider configuration, origin/TLS, private storage, backups and required privacy
evidence belong to the owner's deployment process; local tests do not certify them.
Physical public/mobile-data scenarios remain unverified unless separately observed.

The historical 76/81 (94%) measures the original integral catalog, including offline
acceptance. Preserve its five open task IDs and evidence; do not present that count as
the remaining implementation percentage for this narrowed online release or check off
the original full acceptance tasks using this scope decision.
