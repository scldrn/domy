# Verificación para despliegue

Lista de control de la etapa de verificación para producción iniciada el 2026-10-23.
Se mantiene al día durante todo el trabajo. Un punto se marca **Verificado** solo con
evidencia reproducible (prueba, comando o archivo y línea), nunca por estar marcado en
otro documento.

- Rama: `chore/release-verification`, recreada desde `main` `6a5ac78`. La línea base de la
  verificación fue `6b0256d`; `6a5ac78` unifica las correcciones de la Fase 3 que hicieron
  los subagentes de esta verificación, revisadas y completadas por el propietario
  ([revisión de cambios](archive/release-change-review-results.md)). Cada corrección se marca
  **Corregido** solo después de que el líder la revisa y corre sus pruebas.
- Historia: la verificación empezó en `chore/deployment-readiness-verification` sobre
  `f0bc5ac`. A las 12:56 el rewind del editor había vuelto a pisar 16 archivos y se
  restauraron con `git restore`. Entre las 14:32 y las 16:12 otra sesión cambió de rama en
  este mismo directorio, consolidó el candidato en `main` y borró esa rama. La primera línea
  base (corrida durante esos cambios) se descartó por contaminada.
- Alcance: las especificaciones que existen en el repositorio, 001 a 004. No hay
  especificaciones 005, 006 ni 007 (pregunta 9 de `OWNER-REQUESTS.md`).
- Decisión del propietario (`docs/archive/online-release-scope.md`): la entrega inmediata es solo en
  línea. La aceptación física sin señal queda diferida y no bloquea; el código y las
  pruebas sin señal se conservan y no deben retroceder.
- **Actualización 2026-11-02:** el propietario revierte esa decisión para la app del mensajero, que
  debe funcionar sin señal; el panel sigue solo en línea. Lo marcado abajo como «Diferido (alcance
  del propietario)» vuelve a estar abierto: 003/T087, 003/T131 y 003 US2. C003-5 se revisó en 003/T138:
  cumple FR-023, sin cambio de código. Hallazgos posteriores en
  [la auditoría](production-readiness-audit-2026-11-02.md).
- Las «81 tareas» son el catálogo de `docs/archive/integral-execution-backlog.md` (secciones 6 a 9),
  que remite a los hallazgos IV-01 a IV-41 de `docs/archive/integral-verification.md`.

Estados: **Sin verificar**, **Verificado** (con evidencia), **Corregido** (con prueba que
fallaba antes y pasa después), **Pendiente** (con razón), **Requiere al propietario**.

## Línea base

Sobre `6b0256d` el 2026-10-23, con 9 subagentes corriendo pruebas en paralelo (carga ~25).
La primera corrida, sobre el árbol que otra sesión estaba cambiando, se descartó.

| Compuerta | Resultado | Evidencia |
| --- | --- | --- |
| `pnpm check` | Aprobado | 197 s, salida 0 |
| `pnpm build` | Aprobado | 16 s, salida 0 |
| `pnpm test` | 792 aprobadas, 1 fallida, 36 omitidas | Única falla real: `courier-scale.test.ts:173` lote de 50 registros en 2094 ms (> 2000 ms) bajo carga; pasa sin contención. Los otros 4 archivos «fallidos» eran sondas borradas durante la corrida |
| `pnpm test:e2e` | 153 aprobadas, 2 fallidas | Corrida contaminada por la carga y por la otra sesión; reemplazada por la de `6a5ac78` |

Sobre `6a5ac78` (corrida del líder, máquina sin subagentes):

| Compuerta | Resultado | Evidencia |
| --- | --- | --- |
| `pnpm check` | Aprobado | 62 s, salida 0 |
| `pnpm build` | Aprobado | 6 s, salida 0 |
| `pnpm test` | 1.686/1.686 | domain 426, server 870, web 390 |
| `pnpm test:e2e --retries=0` | 155/155 | 9,8 min; rastreo público en frío con red débil 2.864,7 ms (< 3.000) |
| `pnpm audit --prod` | Sin vulnerabilidades | salida 0 |

## Las 81 tareas del catálogo

| Tarea | Título | Estado declarado | Estado verificado | Evidencia |
| --- | --- | --- | --- | --- |
| 001/T128 | Spreadsheet-safe CSV serialization | COMPLETED | Verificado | `lib/export.ts:264-272`; `shipments-export` «neutralizes formula trigger characters» y casos de `operations-export` |
| 001/T129 | Development dependency advisory resolution | COMPLETED | Verificado | `pnpm-lock.yaml` solo `source-map-js@1.2.2`, `esbuild@0.25.12/0.28.2`; override `pnpm-workspace.yaml:7` |
| 001/T130 | Administrative invariant enforcement on every auth path | COMPLETED | Verificado | `account-integrity.test.ts` (dos degradaciones, ban y degradación mixtos, rol cambiado en paralelo) |
| 001/T131 | Atomic account mutation and audit | COMPLETED | Verificado | `account-integrity` «rolls back user and credentials if creation audit fails» |
| 001/T132 | Exactly-once account administration lifecycle | COMPLETED | Verificado | `account-idempotency.test.ts` 18/18; web `account-workflow.test.ts` |
| 001/T133 | Atomic bulk creation identity and event correctness | COMPLETED | Verificado (F001-5 abierto) | `routes/bulk.ts:296-301`; `bulk.test.ts` 19/19 |
| 001/T134 | Concurrent master-data creation replay | COMPLETED | Verificado | `master-data-idempotency.test.ts` cubre las 7 entidades de `auditedCreate` (`2a7a54a`) |
| 001/T135 | Truthful serialized master-data audit chains | COMPLETED | Verificado | `master-data.ts:45`; «serializes concurrent edits into a truthful A -> B -> C audit chain» |
| 001/T136 | Real inferred RPC response boundaries | ABIERTA | Verificado | `api-client.ts:74-81` infiere el tipo; `api-client.test.ts` 9/9 con `@ts-expect-error`; sin `unwrap<` en llamadores; solo falta la marca en el backlog |
| 001/T137 | Validated recoverable persisted form drafts | COMPLETED | Verificado | `use-form-draft.test.ts`, `bulk-form-draft.test.ts` |
| 001/T138 | Consistent monetary storage/validation/arithmetic | COMPLETED | Verificado | `money.ts:19-39`; `schemas/shipment.test.ts` |
| 001/T139 | Validate auth JSON and decoded cursors | COMPLETED | Verificado | Cursor: «rejects malformed decoded cursor»; cuerpos de auth: `auth-malformed-bodies.test.ts` 21/21 (`2a7a54a`) |
| 001/T140 | Spanish audit and accessible sidebar text | COMPLETED | Verificado | `audit-formatting.test.ts`, `audit-log.test.tsx` |
| 001/T142 | Accepted creation replay before later guards | COMPLETED | Verificado | «replays accepted rate entry creation tomorrow…» |
| 001/T143 | Inline neighborhood creation identity lifecycle | COMPLETED | Verificado | `neighborhood-combobox.test.tsx` |
| 001/T144 | Honest loading/failure/empty states | COMPLETED | Verificado | `directory-states.test.tsx` |
| 001/T145 | Neighborhood edit waits for authoritative detail | COMPLETED | Verificado | `neighborhood-dialogs.test.tsx` |
| 001/T146 | Concurrent five-failure per-account lock | COMPLETED | Verificado | `auth-lockout-recovery` «serializes simultaneous failures… (T146)» |
| 001/T147 | Preserve historical fee and rate-zone snapshots | COMPLETED | Verificado | `shipments.ts:1150-1180`; casos T147 de `shipments-update` 26/26 |
| 001/T148 | Concurrent name/alias uniqueness | COMPLETED | Verificado | `master-data.ts:216-219`; creación concurrente nombre/alias |
| 001/T149 | Complete authoritative previous-recipient autofill | COMPLETED | Verificado | `recipient-autofill.test.tsx` |
| 001/T150 | Native Better Auth failure log privacy | COMPLETED | Verificado | `auth.ts:30-46`; `account-integrity` rollback/redacción |
| 001/T151 | Recovery bearer removal from request-path logs | COMPLETED | Verificado | `app.ts:148`; `log-redaction` «never logs a password recovery token… (T151)» |
| 001/T152 | Native Sentry server/browser envelope privacy | COMPLETED | Verificado | `reporting-privacy.test.ts` servidor y web |
| 001/T153 | Safe fallback diagnostic projection | COMPLETED | Verificado | `errors.ts` `errorForLog`; 4 casos T153 de `log-redaction` |
| 001/T154 | Modal notification accessibility scan stabilization | COMPLETED | Verificado | `fixtures.ts`, `access.spec.ts:162-369`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 001/T155 | Development recovery mail must not log bearer URLs | COMPLETED | Verificado | `lib/email.ts:28-31`; casos T155 |
| 002/T063 | Exact financial aggregates on every route projection | COMPLETED | Verificado | `route-store.ts:450` suma en bigint con `safeIntegerCop`; `routes-aggregates.test.ts` COP 2.400.000.000 en crear, detalle, tablero y despacho; casilla de `tasks.md` por corregir (R002-1) |
| 002/T064 | Unambiguous task references and current documentation | COMPLETED | Verificado | Corregido en `6a5ac78` (R002-5): referencias calificadas en `tasks.md`/`plan.md` y adenda en `quickstart-results.md` |
| 003/T081 | Complete endpoint-to-role permission matrix | COMPLETED | Verificado | `role-permissions.test.ts` 92/92 |
| 003/T082 | Custody and exactly-once generated invariants | COMPLETED | Verificado | `routes-invariants.test.ts` semillas 7/2026/31337 (solo, sin contención) |
| 003/T083 | Accessible courier controls and ≤3-tap primary actions | COMPLETED | Verificado | `courier-action-taps.spec.ts:56` (2/3/3 toques); e2e de compuerta 155/155 sobre `6a5ac78` |
| 003/T084 | Complete courier deployment documentation | COMPLETED | Verificado (documentación) | README de producción actualizado en `6a5ac78` y `2331fd0` (variables, Docker/Caddy, migración, primer propietario, respaldos); la configuración real de proveedor, VAPID y bucket la opera el propietario |
| 003/T085 | Operational export integration RED | COMPLETED | Verificado | `operations-export.test.ts` 13/13 |
| 003/T086 | Operational export implementation and owner controls | COMPLETED | Verificado | `operations-export.test.ts` 13/13 |
| 003/T087 | Actual Android/iPhone scenario acceptance | ABIERTA | Diferido (alcance del propietario) / Requiere al propietario | Parte sin señal diferida por `online-release-scope.md`; parte en línea observada en iPhone sin recibo Android ni tiempos SC-002 |
| 003/T088 | Feature003 final complete gates | ABIERTA | Pendiente | Las cuatro compuertas pasan en local sobre `2331fd0`; faltan T087/T093 físicas, el CI del commit final y la fusión que aprueba el propietario |
| 003/T089 | Complete courier API contract verification | COMPLETED | Verificado | `courier-contract.test.ts` |
| 003/T090 | Complete courier security and payload matrix | COMPLETED | Verificado (C003-1 abierto) | `courier-security.test.ts` 8/8; no cubre al mensajero que recibe el paquete |
| 003/T091 | Busy-day courier performance evidence | COMPLETED | Verificado sin contención | `courier-scale.test.ts` solo: aprobado; con contención el lote de 50 tardó 2262 ms (> 2000 ms) |
| 003/T092 | Courier pure logic and rendered component gaps | COMPLETED | Verificado | web courier/offline 81/81; domain courier 88/88 |
| 003/T093 | Full courier interface/usability review | ABIERTA | Requiere al propietario | Revisión en teléfonos reales y tiempos SC-002; la parte sin señal está diferida |
| 003/T131 | Interrupted-session recovery readiness | COMPLETED | Diferido (alcance del propietario) | Recuperación de sesión sin señal; código en `session.ts`, e2e `courier-offline.spec.ts:228` |
| 003/T133 | Current-work photo authorization and browser cache isolation | COMPLETED | Verificado | Corregido en `6a5ac78` (C003-1): solo el autor y trabajo vigente; `photos.test.ts` 403 para quien recibe por reasignación o traspaso |
| 003/T134 | First-acknowledged proof-photo immutability | COMPLETED | Verificado | `photos.ts:85-117` (`FOR UPDATE`, mismos bytes aceptados, distintos 409); `photos.test.ts`, `storage.test.ts` |
| 003/T135 | Preserve courier-account link intent through query readiness | COMPLETED | Verificado (incluye e2e 155/155) | `courier-accounts.test.ts` 11/11 |
| 004/T001 | Validated public base URL configuration | COMPLETED | Verificado | `env.ts:44-94`; `merchant-link.test.ts` «builds tracking links from the configured public origin» |
| 004/T002 | Secret-code generation integration RED | RED VERIFIED | Verificado | `secret-codes.test.ts` 5/5 |
| 004/T003 | Public boundary/proxy/cache/header RED | RED VERIFIED | Verificado | `public-protection.test.ts` 8/8 |
| 004/T004 | Additive schema, audit/event additions and safe backfill | COMPLETED | Verificado | `0009_tired_robbie_robertson.sql:3-14`; prueba de relleno en `secret-codes.test.ts` |
| 004/T005 | Native secret-code generation at creation | COMPLETED | Verificado | `lib/secret-code.ts` `randomBytes(16)`; `secret-code.test.ts` |
| 004/T006 | Public router, limits and safe headers | COMPLETED | Verificado (F004-2 abierto) | `app.ts:213-228`, `client-address.ts`, `rate-limit.ts`; pruebas aprobadas |
| 004/T007 | Public lazy layout/routes and worker privacy | COMPLETED | Verificado | `app.tsx:46`, `sw.ts:24-31`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T008 | Owner support contact settings | COMPLETED | Verificado | `company-settings.test.ts` 5/5 |
| 004/T009 | Public tracking projection privacy/state RED | RED VERIFIED | Verificado | domain `public-tracking.test.ts` 91 casos |
| 004/T010 | Pending-stop queue estimate RED | RED VERIFIED | Verificado | domain `routes.test.ts` «deliveriesBefore», 41 casos |
| 004/T011 | Actual public tracking endpoint integration RED | RED VERIFIED | Verificado | server `public-tracking.test.ts` 10/10 |
| 004/T012 | Anonymous tracking browser/network RED | RED VERIFIED | Verificado | `tracking-page.spec.ts:286-334`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T013 | Pure public tracking view/schema | COMPLETED | Verificado | `public-tracking.ts:324-393`, `schemas/public.ts:116-199` |
| 004/T014 | Shared deliveries-before calculation | COMPLETED | Verificado | `deliveriesBefore` usado en `public.ts:506` |
| 004/T015 | Public tracking endpoint implementation | COMPLETED | Verificado | `public.ts:359-518`; 404 `link_not_found` uniforme |
| 004/T016 | Complete public tracking page | COMPLETED | Verificado | `tracking-status.tsx`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T017 | Merchant message composition RED | RED VERIFIED | Verificado | `merchant-message.test.ts` 6/6 |
| 004/T018 | Notification list/mark/detail/export integration RED | RED VERIFIED | Verificado | `notifications.test.ts` 14/14 |
| 004/T019 | Manual notification browser RED | RED VERIFIED | Verificado | `notify-merchants.spec.ts`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T020 | Shared merchant message composer/schema | VERIFIED LOCAL | Verificado | `merchant-message.ts`, `schemas/notifications.ts` |
| 004/T021 | Notification endpoints and export/detail additions | VERIFIED LOCAL | Verificado | `notifications.ts:27-174`, `export.ts:69,246`; pruebas aprobadas |
| 004/T022 | Notification UI and durable post-open/copy marking | VERIFIED LOCAL | Verificado | `notify-merchants.tsx:143-260`; pruebas web aprobadas; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T023 | Merchant list/detail financial/privacy projection RED | RED VERIFIED | Verificado | casos de vista de comercio en domain |
| 004/T024 | Merchant link isolation/photo/rotation integration RED | RED VERIFIED | Verificado | `merchant-link.test.ts` 16/16 |
| 004/T025 | Merchant portal browser RED | RED VERIFIED | Verificado | `merchant-page.spec.ts`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T026 | Pure merchant projection and schemas | VERIFIED LOCAL | Verificado | `public-tracking.ts:395-589` |
| 004/T027 | Merchant bearer endpoints and audited link replacement | VERIFIED LOCAL | Verificado | `public.ts:519-749`, `merchants.ts:103-160`; pruebas aprobadas |
| 004/T028 | Merchant page list/detail/date/totals UI | VERIFIED LOCAL | Verificado | `merchant-page.tsx`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T029 | Copy/replace merchant link panel controls | VERIFIED LOCAL | Verificado | `merchant-link-controls.tsx`; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T030 | Complete public/panel permission and read-only matrix | VERIFIED LOCAL | Verificado | `role-permissions.test.ts` aprobado |
| 004/T031 | Random-code negative scan | VERIFIED LOCAL | Verificado | `public-codes-scan.test.ts` 2/2 (1.000 códigos) |
| 004/T032 | Public and notification accessibility coverage | VERIFIED LOCAL | Verificado | `public-accessibility.spec.ts` y axe al final de cada e2e; e2e de compuerta 155/155 sobre `6a5ac78` |
| 004/T033 | Go-live privacy/configuration documentation | VERIFIED LOCAL | Verificado | Corregido en `6a5ac78` (F004-1): README con origen público, soporte y consentimiento individual |
| 004/T034 | Physical public/notification acceptance and timings | ABIERTA | Requiere al propietario | Escenarios 1–14 en teléfono real con datos móviles, WhatsApp real, tiempos; consentimiento de mensajeros |
| 004/T035 | Feature 004 final complete gates and delivery | ABIERTA | Pendiente | Las cuatro compuertas pasan en local sobre `2331fd0`; faltan T034 física, el CI del commit final y la fusión que aprueba el propietario |

## Funcionalidades planeadas (historias de usuario)

| Etapa | Historia | Estado | Evidencia |
| --- | --- | --- | --- |
| 001 Registro de envíos | US1 Registrar un envío | Verificado (incluye e2e 155/155) | `shipments-create` 22/22, `lookups` 7/7, domain 424/424, web 220/220 |
| 001 Registro de envíos | US2 Tablero de despacho del día | Verificado | `board.test.ts` 12/12 |
| 001 Registro de envíos | US3 Corregir o anular un envío | Verificado | `shipments-update.test.ts` 26/26 (incluye reenvío concurrente y conflicto de versión) |
| 001 Registro de envíos | US4 Registro masivo | Verificado (F001-5 abierto) | `bulk.test.ts` 19/19 |
| 001 Registro de envíos | US5 Buscar en el historial | Verificado (F001-3 abierto) | `shipments-search` 13/13, `shipments-export` 5/5, `search-scale` y `export-scale` 5/5 |
| 001 Registro de envíos | US6 Datos maestros y tarifario | Verificado | `merchants`, `neighborhoods`, `rate-card`, `master-data-idempotency` 20/20, `master-data-export` 3/3 |
| 001 Registro de envíos | US7 Acceso por rol | Verificado | `users`, `auth-sessions`, `auth-lockout-recovery` 9/9, `account-idempotency` 18/18, `role-permissions` 92/92, `auth-origin-policy` 3/3 |
| 002 Rutas y despacho | US1 Armar y despachar una ruta | Verificado (R002-2, R002-3, R002-4 abiertos) | `routes-create`, `routes-order-courier`, `routes-dispatch` aprobados; e2e `route-build-dispatch.spec.ts` |
| 002 Rutas y despacho | US2 Seguir las rutas del día | Verificado | `routes-board.test.ts` 7/7; e2e `routes-board.spec.ts` |
| 002 Rutas y despacho | US3 Ajustar una ruta | Verificado | `routes-adjust.test.ts` 12/12; e2e `route-adjust.spec.ts` |
| 002 Rutas y despacho | US4 Reasignar a otro mensajero | Verificado | `shipments-reassign`, `handovers`, `routes-reassign`, `custody-history` aprobados; e2e `route-reassign.spec.ts` |
| 002 Rutas y despacho | US5 Cancelar ruta o deshacer despacho | Verificado | `routes-cancel-undo.test.ts` 7/7; e2e `route-cancel-undo.spec.ts` |
| 003 App del mensajero | US1 Hacer la ruta | Verificado (incluye e2e 155/155) | `courier-route`, `courier-records`, `courier-records-apply`; web 81/81 |
| 003 App del mensajero | US2 Trabajar sin señal | Verificado en código y pruebas; aceptación física diferida (alcance del propietario) | `sync.ts:205-263`, `outbox.ts:144`; pruebas offline aprobadas |
| 003 App del mensajero | US3 Reportar lo que no se pudo hacer | Verificado | `courier-exceptions.test.ts` 14/14 |
| 003 App del mensajero | US4 Decidir después de una novedad | Verificado | `exception-decision`, `office-receipt` 18/18 |
| 003 App del mensajero | US5 Seguir cambios y confirmar traspasos | Verificado | `courier-notices`, `notifications`, `handovers` 7/7, `courier-late-records` 15/15 |
| 003 App del mensajero | US6 Registrar a nombre del mensajero y corregir | Verificado | `records-on-behalf` 10/10, `records-correct-revert` 27/27 |
| 003 App del mensajero | US7 Mi día | Verificado | `courier-summary.test.ts`, domain `day-summary.test.ts` |
| 004 Rastreo y enlace del cliente | US1 Seguir un envío | Verificado (incluye e2e 155/155) | `public-tracking` (domain 91, server 10), `public-protection` 8/8, `public-codes-scan` 2/2 |
| 004 Rastreo y enlace del cliente | US2 Enviar al cliente sus enlaces de rastreo | Verificado (incluye e2e 155/155); F004-3, F004-5 abiertos | `notifications.test.ts` 14/14, `merchant-message.test.ts` 6/6 |
| 004 Rastreo y enlace del cliente | US3 Ver todos mis envíos | Verificado (incluye e2e 155/155) | `merchant-link.test.ts` 16/16 |

## Áreas transversales

| Área | Estado | Evidencia |
| --- | --- | --- |
| Datos y transacciones (atomicidad, rollback, restricciones, concurrencia, migraciones) | Verificado (4 bajos abiertos) | `drizzle-kit generate` sin cambios y `check` OK sobre `6b0256d`; `migration-toolchain.test.ts` 2/2; sondas con triggers que fuerzan fallo en la segunda escritura (`saveChange`, `insertShipments`, `auditedCreate/Change`, `applyCourierRecord`, cuentas): 500 sin filas parciales; concurrencia: 3 ediciones con la misma versión → [200,409,409]; 5 reenvíos del mismo `actionId` → un evento; 6 creaciones con el mismo id → un 201 y cinco 200; 12 contraseñas erradas en paralelo → 423; 66 FK sin cascada; `shipments-update`, `auth-lockout-recovery`, `master-data-idempotency` 55/55 |
| Diseño y código limpio | Verificado (4 medios, 6 bajos abiertos) | Sin `new Date()` en handlers, rutas encadenadas, sin `.skip/.only`, sin `any`/`@ts-ignore`, `unwrap` sin genéricos del llamador, todos los FR citados existen; ver DESIGN-1 a DESIGN-10 |
| Robustez (entradas inválidas, límites, errores de red y base de datos, carga) | Verificado; ROB-1 a ROB-6 corregidos (`6a5ac78`, `2bc9d62`) | Sondas sobre `6b0256d`: JSON malformado/vacío/`null` → 400 en español; cuerpo > 1 MB → 413; foto vacía o PNG → 400; cursores manipulados → 400; 5 creaciones paralelas con el mismo id → 201+200×4; correo caído → 200 sin rechazo no manejado; error boundary en `app.tsx:14` |
| Seguridad (autenticación, roles, validación, secretos, dependencias) | Verificado sin críticos ni altos; SEC-1 y SEC-2 medios abiertos | 85 endpoints con guardia y denegación probada (`role-permissions` 92/92); registro deshabilitado; cookies HttpOnly/Lax; bloqueo tras 5 fallos (paralelo incluido); `auth-origin-policy` 3/3 en modo producción; sin secretos en git ni historia; redacción de logs 24/24; `pnpm audit --prod`: 1 alto (zod) |
| Preparación para despliegue (entorno, configuración, logs, monitoreo, respaldos, build) | Verificado en ingeniería; plataforma, dominio, proveedores y calendario de respaldos: Requiere al propietario | Arranque real con `NODE_ENV=production`: `/health/live` 200, `/health/ready` 503 sin base, `/api/test/clock` 404, `DOMY_FAKE_NOW` ignorado, apagado limpio con SIGTERM; variables obligatorias en `env.ts:74-125` (`env.test.ts`); Dockerfile con lockfile congelado e imágenes fijadas por digest; CI corre las cuatro compuertas |

## Hallazgos nuevos

| ID | Severidad | Área | Archivo y línea | Descripción | Estado |
| --- | --- | --- | --- | --- | --- |
| DEPLOY-1 | Alto | Despliegue | `docs/local-recovery-runbook.md:63`, decisión #28 | No hay respaldo automático ni restauración probada de base y fotos; solo un procedimiento manual sintético con ayudantes fuera de git | Corregido en ingeniería (`6a5ac78`): `scripts/backup.sh`, `scripts/restore.sh`; `backup-restore.test.ts` 5 casos (suma de verificación, restauración con filas y totales COP, nunca sobre la base viva). Calendario, retención, destino externo y fotos: Requiere al propietario |
| DEPLOY-3 | Medio | Despliegue | `routes/health.ts:10` | `/health/ready` responde 200 con migraciones pendientes | Corregido (`6a5ac78`): `runtime-health.test.ts` «reports unavailable while a shipped migration is not applied» |
| DEPLOY-4 | Medio | Despliegue | `db/seed/index.ts:238` | No hay forma documentada de crear el primer propietario en producción | Corregido (`2331fd0`): README, `docker compose … run --rm --no-deps app node src/db/seed/index.ts` y cambio de correo y contraseña al primer ingreso |
| DEPLOY-5 | Medio | Despliegue | `app.ts:258` | En producción, `GET /api/<inexistente>` y `/health/<inexistente>` responden 200 con el HTML de la app | Corregido (`6a5ac78`): `production-routing.test.ts` (404 JSON en `/api/*` y `/health/*`) |
| DEPLOY-6 | Bajo | Despliegue | `README.md:76` | Sección de producción desactualizada (`pnpm db:migrate`, falta `PUBLIC_BASE_URL`, no menciona Docker) | Corregido (`6a5ac78`): sección de producción del README actualizada |
| DEPLOY-7 | Bajo | Despliegue | `env.ts:113` | Llaves VAPID aceptadas sin validar formato | Corregido (`6a5ac78`): `env.test.ts` VAPID |
| DEPLOY-8 | Bajo | Despliegue | `lib/email.ts:17` | Sin `RESEND_API_KEY` en producción sale con traza cruda en vez del mensaje de `readEnv` | Corregido (`6a5ac78`): `env.test.ts` «requires the Resend key in production» |
| DEPLOY-9 | Bajo | Pruebas | `tests/runtime-health.test.ts:111` | Caso con contenedor propio excede 30 s bajo carga de Docker | Corregido (`2a7a54a`): presupuesto de 120 s propio del caso; `runtime-health.test.ts` 8/8 |
| DEPLOY-10 | Bajo | Despliegue | `env.ts:40`, `.nvmrc`, `ci.yml` | `NODE_ENV` por defecto development; `.nvmrc` solo mayor; CI no construye la imagen | No se corrige: el Dockerfile y compose fijan `NODE_ENV=production`; `.nvmrc` mayor y el build de imagen en CI son mejoras de CI, no de la app (la imagen se construyó y revisó localmente en `6a5ac78`) |
| F001-1 | Medio | 001 | `routes/auth.ts:48-63` | Sin prueba permanente de cuerpos de auth malformados (IV-14); sonda 21/21 < 500 | Corregido (`2a7a54a`): `auth-malformed-bodies.test.ts` 21/21 (sin 500; recuperación conserva la forma nativa de Better Auth que permite el contrato) |
| F001-2 | Bajo | Pruebas | `tests/auth-sessions.test.ts:31` | Caso de vencimiento sensible a carga | Corregido (`2a7a54a`): vencimiento tomado de la fila guardada; RED con 1,5 s de espera → 200, GREEN 4/4 |
| F001-3 | Bajo | 001 | `specs/001-shipment-registration/contracts/http-api.md:223` | FR-025 exige documentar la neutralización de fórmulas del CSV | Corregido (`d9525c9`): `contracts/http-api.md:224-231` |
| F001-4 | Bajo | 001 | `lib/master-data.ts` | T134 probada en 2 de 7 llamadores de `auditedCreate` | Corregido (`2a7a54a`): `master-data-idempotency.test.ts` 25/25, las 7 entidades |
| F001-5 | Bajo | 001 | `routes/bulk.ts:264` | Un lote nuevo que reutiliza ids existentes los reporta como creados, aun de otro comercio | Corregido (`8f2f28f`): `bulk-foreign-ids.test.ts` (400 y nada creado) |
| F001-6 | Bajo | Docs | `docs/archive/integral-execution-backlog.md:614` | T136 sin marca `[COMPLETED]` | Corregido (`d9525c9`) |
| C003-1 | Alto | 003 / privacidad | `routes/photos.ts:170-193`, `tests/photos.test.ts:300` | Un mensajero que recibe el paquete por traspaso o reasignación descarga fotos de otro mensajero (entregas, novedades, recibos); FR-036 y D2 dicen «solo las propias»; la prueba fija el comportamiento incorrecto | Corregido (`6a5ac78`): `photos.ts` exige autor del registro; `photos.test.ts` «refuses the courier who received the package through a handover» y Beto 403 tras reasignar (`:316`) |
| C003-2 | Medio | 003 | web `lib/offline/sync.ts:155` | Un 409 `photo_immutable` al subir una foto aborta la sincronización: los registros aceptados no salen de la bandeja y la instantánea no se refresca | Corregido (`6a5ac78`): `sync.test.ts` «C003-2 retains a conflicting photo while committing records and refreshing the route» |
| C003-3 | Medio | 003 | `routes/courier.ts:343` | Un registro que lanza error bloquea el lote completo (mismo defecto que ROB-3) | Corregido con ROB-3 (`2bc9d62`) |
| C003-4 | Bajo | 003 | `lib/courier-records.ts:179` | Mismo id de registro con distinto envío en paralelo → 500 por violación de llave primaria | Corregido (`6a5ac78`): `courier-records-robustness.test.ts` «answers the stored outcome when one record id races on two shipments» |
| C003-5 | Bajo | 003 | web `sync.ts:233` | El borrado de datos personales a las 24 h solo ocurre al sincronizar | Diferido (alcance del propietario, sin señal) |
| C003-6 | Bajo | 003 | `lib/courier-records.ts:301` | Por API un mensajero puede recoger cualquier envío registrado (permitido por FR-025, marcado «Por revisar») | Informar al propietario |
| SEC-1 | Medio | Seguridad | `routes/auth.ts:300-332`, `db/client.ts:6` | El inicio de sesión toma conexión y bloqueo antes del límite por IP: 60 intentos anónimos llevan una consulta de oficina de 12 ms a 5.286 ms | Corregido (`6a5ac78`): `auth-sign-in-flood.test.ts` «does not hold the database pool…» y límite por dirección. Riesgo residual: una inundación repartida (~60 direcciones) puede dar 429 en el inicio de sesión, no en el resto de la API |
| SEC-2 | Medio | Seguridad | dependencia zod 4.6.5 | Aviso alto GHSA-mrhx-c7xc-m3w5 (corregido en 4.6.6); cuerpos limitados a 1 MB | Corregido (`6a5ac78`): zod 4.6.6 y fast-uri 3.1.9; `pnpm audit --prod` sin vulnerabilidades (corrida del líder sobre `6a5ac78`) |
| SEC-3 | Bajo | Seguridad | `env.ts:42`, `.env.example:8` | El marcador de `BETTER_AUTH_SECRET` de ejemplo se acepta en producción | Corregido (`6a5ac78`): `env.test.ts` «refuses the .env.example placeholder secret in production only» |
| SEC-4 | Bajo | Seguridad | `app.ts` | Respuestas JSON autenticadas sin `Cache-Control: no-store` | Corregido (`6a5ac78`): `production-routing.test.ts` «marks authenticated API data no-store» |
| SEC-5 | Bajo | Seguridad | `app.ts` | Mutaciones propias sin verificación de `Origin` (protegidas por SameSite=Lax y JSON) | No se corrige: defensa en profundidad opcional; SameSite=Lax, cuerpos solo JSON sin CORS y `X-Domy-Actor-Id` ya bloquean el envío entre sitios (`routes-security` «refuses a cross-site form post») |
| SEC-6 | Bajo | Seguridad | `routes/photos.ts:54` | No se verifica la firma JPEG | Corregido (`6a5ac78`): `photos.test.ts` «refuses a body that is not a JPEG…» |
| SEC-7 | Bajo | Seguridad | `routes/shipments.ts:424`, `merchants.ts:452` | Comodines LIKE sin escapar en búsquedas de oficina | Corregido (`8f2f28f`): `shipments-search-wildcards.test.ts` 2/2 (los demás buscadores ya pasan por `normalizeText`) |
| SEC-8 | Bajo | Seguridad | `auth.ts` | El limitador de Better Auth usa `X-Forwarded-For` sin atarse a `DOMY_TRUSTED_PROXY_IP` | Corregido (`6a5ac78`): `auth-sign-in-flood.test.ts` «reads X-Domy-Client-IP only from the configured proxy peer» |
| F004-1 | Medio | 004 | `README.md:76` | Falta la documentación de salida a producción de T033 (`PUBLIC_BASE_URL`, contacto de soporte, consentimiento de mensajeros por Ley 1581); el archivo de resultados afirma un hash que ningún commit tuvo | Corregido (`6a5ac78`): README con `PUBLIC_BASE_URL` y consentimiento individual de mensajeros |
| F004-2 | Medio | 004 | `lib/rate-limit.ts:38` | Con 10.000 direcciones vivas todo visitante nuevo recibe 429; IPv6 no se agrupa por /64, así que un atacante con un /64 bloquea las páginas públicas | Mitigado (`6a5ac78`): IPv6 agrupado por /64 (`rate-limit.test.ts`); se conserva el rechazo al llenarse porque desalojar cupos vivos deja reiniciar el presupuesto. Riesgo residual: un /48 aún llena los 10.000 cupos |
| F004-3 | Bajo | 004 | web `notify-merchants.tsx:304` | Se puede notificar una fecha futura cuyo enlace de comercio responde `date_out_of_range` | Corregido (004/T037, decisión del propietario 2026-11-02): la fecha se limita a hoy o antes |
| F004-4 | Bajo | 004 | `docs/status.md:18` | Dice que la 004 no ha empezado | Corregido (`6a5ac78`): `docs/status.md` refleja 33/35 de la 004 |
| F004-5 | Bajo | 004 | `routes/notifications.ts:129` | Envíos anulados se pueden marcar como notificados por API directa | Sin cambio, por contrato: FR-017/R8 conserva el acuse de un aviso ya copiado aunque el envío se anule después; listado y composición sí excluyen anulados (`notifications.test.ts` FR-017) |
| ROB-1 | Alto | Robustez | `routes/photos.ts:62-118`, `lib/storage.ts`, `db/client.ts:6` | La subida a S3 ocurre dentro de la transacción con bloqueo y sin tiempo límite; 10 subidas colgadas agotan el pool y congelan toda la API (sonda: búsqueda sin respuesta tras 5 s) | Corregido (`6a5ac78`): S3 fuera de la transacción, tiempos límite en S3 y pool; `photos-storage-stall.test.ts` (2 casos), `storage.test.ts` «gives up on a bucket that… never answers». Riesgo: inmutabilidad con candado en memoria, válida con un solo proceso |
| ROB-2 | Alto | Robustez | web `lib/offline/sync.ts:148` | Un 5xx o error de red al subir una foto aborta la sincronización antes de refrescar la ruta: con S3 caído el mensajero no ve paradas nuevas | Corregido (`6a5ac78`): `sync.test.ts` casos de 5xx/red y «waits up to 60 s for a photo upload, then keeps it and refreshes the route» |
| ROB-3 | Medio | Robustez | `routes/courier.ts:334`, web `sync.ts:85`, `schemas/courier.ts:63,121` | Un registro que lanza error hace fallar todo el lote; el teléfono reenvía el mismo lote para siempre y los posteriores se encolan (sin pérdida) | Corregido (`2bc9d62`): el registro que no cumple se guarda como «No aplicado» (`invalid_for_shipment`) con su efectivo, nota y fotos; `courier-records-batch.test.ts`, T114 en `courier-notices.test.ts`, `courier-records-apply.test.ts`; el teléfono replica la decisión (`outbox.test.ts` «…as the server keeps it (ROB-3)»). Migración 0010 aditiva |
| ROB-4 | Medio | Robustez | web `sync.ts:34`, `lib/api-client.ts` | Sin tiempo límite en `fetch`: una conexión móvil a medias deja la sincronización y el cierre de sesión esperando | Corregido (`6a5ac78`): `sync.test.ts` 20 s y abort ignorado; `api-client.test.ts` 30 s |
| ROB-5 | Bajo | Robustez | `schemas/courier.ts:63,121` | Montos y precisión fuera de rango dan 500 (desbordamiento de entero) en vez de 400 | Corregido (`6a5ac78`): `courier-records-robustness.test.ts` y domain `schemas/courier.test.ts` (400, no 500) |
| ROB-6 | Bajo | Robustez | `apps/server/src/index.ts` | Sin manejadores de `unhandledRejection`/`uncaughtException` ni SIGINT | Corregido (`6a5ac78`): `process-failures.test.ts` (SIGINT y fallas de proceso) |
| ROB-7 | Bajo | Robustez | `routes/shipments.ts:555` | Reenvíos concurrentes de una edición darían 409 | No reproducido: la sonda P2 de datos dio cinco 200 y un evento |
| R002-1 | Medio | 002 | `specs/002-routes-dispatch/tasks.md:339` | T063 verificada pero su casilla quedó sin marcar (la revirtió `57a0a57`); backlog y `tasks.md` se contradicen | Corregido (`6a5ac78`): `specs/002-routes-dispatch/tasks.md` |
| R002-2 | Medio | 002 | `routes/routes.ts:635` | El despacho no exige mensajero activo: un mensajero desactivado después de asignarlo recibe la ruta (sonda: 200, `in_progress`) | Corregido (`6a5ac78`): `routes-dispatch.test.ts` «refuses dispatching to a courier deactivated after assignment» |
| R002-3 | Medio | 002 | `routes/routes.ts:131`, `lib/route-store.ts:56` | Dos peticiones simultáneas con el mismo `actionId` dan 200 y 409; el cliente ve «Esta ruta cambió» por su propia acción | Corregido (`6a5ac78`): `routes-dispatch.test.ts` «answers two simultaneous identical dispatches as one» y «…removals as one» |
| R002-4 | Bajo | 002 | `routes/routes.ts:808` | `/join` acepta como destino la ruta en curso de otro mensajero (la interfaz no lo ofrece) | Corregido (`6a5ac78`): `routes-dispatch.test.ts` «joins only into the route in progress of the same courier» |
| R002-5 | Bajo | 002 | `specs/002-routes-dispatch/tasks.md:113`, `plan.md:81` | T064 no está hecha: referencias T057/T058 ambiguas y resultados del quickstart desactualizados | Corregido (`6a5ac78`): referencias calificadas y adenda en `quickstart-results.md` |
| R002-6 | Bajo | 002 | `specs/002-routes-dispatch/tasks.md:72` | T015 nombra un archivo de prueba que no existe | Corregido (`6a5ac78`): ruta de T015 corregida |
| DATA-1 | Bajo | Datos | `lib/courier-records.ts:186` | Tras bloquear rutas y recargar, no comprueba que las rutas recargadas estén bloqueadas; posible deadlock (500) que el teléfono reintenta | No se corrige: no reproducido en 4 carreras; si ocurre, PostgreSQL devuelve deadlock y el teléfono reintenta sin pérdida (exactamente una vez por id) |
| DATA-2 | Bajo | Datos | `routes/courier.ts:312` | Instantánea del mensajero con cuatro lecturas en paralelo fuera de una transacción; puede mezclar dos estados | Corregido (`2bc9d62`): `courier-route-snapshot.test.ts` (una transacción de solo lectura REPEATABLE READ) |
| DATA-3 | Bajo | Datos | `routes/photos.ts:62` | Subida a S3 dentro de la transacción con bloqueo; posible objeto huérfano si falla el COMMIT | Corregido (`6a5ac78`): S3 fuera de la transacción y borrado del objeto si falla el acuse |
| DATA-4 | Bajo | Datos | `db/seed/index.ts:185` | El seed carga tarifas sin evento de auditoría y tarifas de Amy Tecnology sin confirmar (pregunta 3) | Requiere al propietario: tarifas de Amy Tecnology (pregunta 3); la carga inicial sin auditoría ocurre una sola vez antes del uso real |
| DESIGN-1 | Medio | Diseño | `lib/reassignment.ts:313`, `routes/shipments.ts:1005`, `routes/routes.ts:451`, web `shipment-detail.tsx:172` | Estado al unirse a una ruta y qué estados pueden cambiar de ruta, reimplementados fuera de domain | Corregido (`8f2f28f`): `statusOnJoiningRoute`, `canMoveBetweenRoutes` en domain; `routes.test.ts` 43/43 |
| DESIGN-2 | Medio | Diseño | `routes/photos.ts:173`, `shipments.ts:690`, `merchants.ts:205`, `courier.ts:201`, web `day-sentence.ts:6` | Lista de estados finales copiada cinco veces; una es control de acceso a fotos | Corregido (`8f2f28f`): `finalStatuses` exportado; `shipment-lifecycle.test.ts` 22/22 |
| DESIGN-3 | Medio | Diseño | `lib/registration.ts:211`, `shipments.ts:1202`, `bulk.ts:226`, web `delivery-rules.ts:22` | Regla de confirmación de montos grandes duplicada; solo los umbrales viven en domain | Corregido (`8f2f28f`): `needsAmountConfirmation` en `money.ts`; `money.test.ts` 26/26 con límites y edición sin cambios |
| DESIGN-4 | Medio | Diseño | `routes/shipments.ts` (1407 líneas) 913–1272 | Orquestación de custodia en handlers de ruta; propuesta: `lib/exception-decisions.ts` | No se corrige antes de salir: dividir la orquestación de custodia es un refactor del código más riesgoso, sin defecto asociado; queda como deuda documentada |
| DESIGN-5 | Bajo | Diseño | web `dispatch-board.tsx:35`, `clear-review-dialog.tsx:34`, `lib/offline/push.ts` | Llamadas al servidor fuera de `features/<área>/api.ts` | No se corrige: tres llamadas fuera de `api.ts`, tipadas con `hc<AppType>`; cosmético |
| DESIGN-6 | Bajo | Diseño | web `day-sentence.ts:27`, `delivery-rules.ts:8` | Totales del tablero y valor por defecto de «recibido por» calculados en web | No se corrige: cálculos de presentación que el servidor no impone; sin riesgo de datos |
| DESIGN-7 | Bajo | Diseño | pruebas del servidor `as unknown as T` | Respuestas sin tipo en ayudantes de prueba | No se corrige: tipado débil solo en ayudantes de prueba |
| DESIGN-8 | Bajo | Diseño | `shipments.ts:458,479,607,829`, `auth.ts:48` | Esquemas locales en rutas y mapeo de errores duplicado | No se corrige: esquemas locales de parámetros y el mapeo de errores de `auth.ts`, justificado porque el cuerpo se reenvía a Better Auth |
| DESIGN-9 | Bajo | Diseño | `components/ui/dialog.tsx:29`, `sheet.tsx:29`, `alert-dialog.tsx:24` | `bg-black/10` en lugar del token `scrim` | Corregido (`dddf9e8`): `bg-scrim/10` |
| DESIGN-10 | Bajo | Diseño | `packages/domain/src/schemas/*` | 14 tipos exportados sin uso | No se corrige: tipos exportados sin uso, cosmético |

## Definición de terminado

Compuertas finales del líder sobre `2331fd0` (rama `chore/release-verification`), 2026-10-24:
`pnpm check` aprobado (sin errores ni advertencias de formato, lint ni tipos), `pnpm build`
aprobado, `pnpm test` 1.726/1.726 (domain 433, server 902, web 391), `pnpm test:e2e --retries=0`
155/155 con axe en cada caso, y `pnpm audit --prod` sin vulnerabilidades (sobre `6a5ac78`, sin
cambios de dependencias después). El único cambio posterior a la corrida fue el formato de
`outbox.ts` (prettier) y Markdown; `check` y `outbox.test.ts` se repitieron después y pasaron.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Las 81 tareas y todas las funcionalidades de 001 a 004 verificadas con evidencia | Cumplido salvo 6 tareas que no son código | 75/81 verificadas (70 ya resueltas en la línea base, 5 corregidas: 001/T134 y T139 en cobertura, 002/T064, 003/T133, 004/T033). Las 22 historias de usuario verificadas. Quedan 003/T087, T093 y 004/T034 (aceptación física), 003/T131 (diferida por el alcance en línea) y 003/T088, 004/T035 (dependen de las anteriores, CI y fusión) |
| Pruebas, build, lint y tipos sin errores ni advertencias | Cumplido | Ver arriba |
| Ningún hallazgo crítico ni alto abierto; medios y bajos no corregidos, documentados con su razón | Cumplido | 0 críticos. 4 altos corregidos (C003-1, ROB-1, ROB-2, DEPLOY-1 en ingeniería). Cada medio y bajo está Corregido, Mitigado, Requiere al propietario o No se corrige con su razón en «Hallazgos nuevos» |
| Flujos críticos con pruebas de integración o e2e, incluidos errores y concurrencia | Cumplido | Registro, despacho, registros del mensajero, fotos, inicio de sesión, rastreo y enlaces del comercio: integración con PostgreSQL real y e2e; concurrencia (`shipments-update`, `routes-dispatch` FR-020, `courier-records-robustness`, `auth-lockout-recovery` T146, `master-data-idempotency`), fallas (`photos-storage-stall`, `process-failures`, `runtime-health`, `courier-records-batch`, `auth-sign-in-flood`, `backup-restore`) |

## Riesgos y decisiones del propietario antes de desplegar

- Un solo proceso del servidor: la inmutabilidad de fotos (T134) y los límites de peticiones
  viven en memoria. Escalar a varios procesos exige rediseñarlos.
- Límites ante ataques repartidos: un /48 de IPv6 puede llenar los 10.000 cupos del rastreo
  público (F004-2), y ~60 direcciones pueden dar 429 en el inicio de sesión (SEC-1). El resto de
  la API ya no se afecta.
- Un registro del mensajero para un envío inexistente no puede guardarse (llave foránea); solo
  queda en el log. Desde el teléfono no ocurre porque los ids vienen de su instantánea.
- Decisiones: plataforma y arquitectura (la imagen se probó en arm64), dominio y TLS,
  proveedor de fotos privado con borrado a 12 meses, calendario, retención y destino externo de
  los respaldos (los scripts no programan nada ni copian fotos), dominio de Resend y llaves
  VAPID de producción, Sentry sí o no, entrega segura de la primera contraseña, consentimiento
  individual de los mensajeros (Ley 1581), tarifas de Amy Tecnology, Caldas y Girardota,
  fecha futura en avisos (F004-3), aceptación física T087/T093/T034 y CI más fusión de esta rama.
- Pregunta 9 de `OWNER-REQUESTS.md`: no existen especificaciones 005 a 007.
