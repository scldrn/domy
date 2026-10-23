# Merchant projection artifact alignment — R19

Date: 2026-10-22, America/Bogota. Preparation only; no merchant implementation
or RED task is complete. Source remains frozen for the tracking story full QA.

Executor aligned separate merchantDayView/list/totals and merchantShipmentView
detail, exact strict wire shapes, confirmed-fee/unknown-fee semantics, non-voided
aggregates, FR014 COD eligibility without netting, current effective collections
for the shipment service-date cohort, and bounded proof/attempt provenance.
Uploaded photo metadata may still yield a missing-object404; no storage probe
is promised while projecting detail. List never loads detail notes/photos.

Independent review found a HIGH content-privacy gap in freeform notes. Root
selects the recommended projection-only redaction under existing FR020/privacy
requirements; an optional owner preference was asked but no owner approval or
answer is inferred. R19 specifies known contacts/addresses, permitted phone URL
forms/country prefixes, bounded legacy3xx fallback and numeric-reference
collision, normalization with original UTF16 spans, merged matches, and a
conservative fallback for unmappable private spans. Benign text and stored
records remain unchanged. Inputs are narrowly selected and never response
fields or logs; no broad directory/history load or semantic DLP is introduced.

Executor and root validated relative links, task marker/count agreement and
acyclic dependency ordering. Independent rereview reports no remaining
CRITICAL/HIGH; root clarified ambiguous attempt/raw-note wording, contactURL
forms and cross-attempt courier phones. T023 explicitly requires these RED
assertions along with benign text, mixed/overlapping matches and immutability.
Reviewer-owned checklists are unchanged.

Current catalog58/81 verified (72%),23open. The operational
004-merchant-contracts gate is verified; T023/T024/T025 still wait for root-verified
T016. No test/source/DB/build acceptance is claimed by this receipt.

Final SHA-256:

- research.md: 997bf5020566612412c3095f4663ee52f80cef31c9e9fb8291ed471d600ae5fc
- data-model.md: 4b3291e65be8a26c116fe322a890904cef5a9331000bedf7dd79f45b38bb7d24
- contracts/http-api.md: a1bb1f1745208cbfabad7affb49cbf94589899111fa2cb5f732ec44bdaffdf52
- tasks.md: 5b6aa504d49b71d371669234fda54ded73889d50a0850c0fc6c1d6af46cabf7a

## Superseding owner decision — 2026-10-22

The owner answered the optional question explicitly: “Mostrar un aviso de contacto
con soporte en lugar de la nota”. The earlier selective-redaction policy and its
hashes above are historical. Research, model, contract and tasks now require the
fixed support notice for all nonblank notes; absent/blank notes remain null. No
private redaction inputs or selective sanitizer are needed. Independent rereview and root N2 now pass: no HIGH/CRITICAL, spec US3/FR020
updated, 30 relative links valid. The revised operational gate is verified.

Revised artifact SHA-256 (before task closure):

- spec.md: 360962df249ce81602e7987f8b58823c1b92db6a3bfdf74b53230acb541bd35b
- research.md: 496aee8edb3af90b3045d2e271d2f9b9a1ea54763bbf3eefcb28145febea32bd
- data-model.md: 3a297fe2a50281a4e04634ee5eba6720fae676b76f383ed4e07f25800f32d727
- contracts/http-api.md: 501495aa8bee7a234d153b8baca017495175d7390c0e5ab6713ee704dc866819
- tasks.md: f0886095dee8a4c3f2dccaae5ec982d2e03a615d4008a45cd7c7bf6182521b17

## Status-time clarification — 2026-10-22

Independent T027 audit identified ambiguous event eligibility in R19. Root clarified
research and HTTP contract: prefer the effective current state-establishing record;
otherwise latest appended event causing/restoring current status (`fromStatus !==
toStatus`, any event type), output occurredAt; same-state administrative events
never restart the status clock. Initial registeredAt is not a restoration fallback.
Independent rereview and root source inspection confirm no HIGH/CRITICAL; native
T027 regressions remain required. No wire shape or closed projector behavior changed.
