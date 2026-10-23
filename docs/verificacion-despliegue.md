# Verificación para despliegue

Lista de control de la etapa de verificación para producción iniciada el 2026-10-23.
Se mantiene al día durante todo el trabajo. Un punto se marca **Verificado** solo con
evidencia reproducible (prueba, comando o archivo y línea), nunca por estar marcado en
otro documento.

- Rama: `chore/deployment-readiness-verification`. Línea base: commit `57a0a57`, que
  guarda sin cambios el trabajo local encontrado (309 archivos sobre `main` `94a7e24`).
- 2026-10-23 12:56: el árbol de trabajo volvió a tener los 16 archivos que `f0bc5ac`
  restauró, idénticos byte a byte a `57a0a57` (el rewind del editor se aplicó de nuevo).
  Se restauraron a `HEAD` con `git restore`; ambas versiones están en git.
- Alcance: las especificaciones que existen en el repositorio, 001 a 004. No hay
  especificaciones 005, 006 ni 007; si existen en otro lugar, deben agregarse aquí.
- Las «81 tareas» son el catálogo de `docs/integral-execution-backlog.md` (secciones 6 a 9),
  que remite a los hallazgos IV-01 a IV-41 de `docs/integral-verification.md`.

Estados: **Sin verificar**, **Verificado** (con evidencia), **Corregido** (con prueba que
fallaba antes y pasa después), **Pendiente** (con razón), **Requiere al propietario**.

## Línea base

| Compuerta | Resultado | Evidencia |
| --- | --- | --- |
| `pnpm check` | En curso | — |
| `pnpm build` | En curso | — |
| `pnpm test` | En curso | — |
| `pnpm test:e2e` | En curso | — |

## Las 81 tareas del catálogo

| Tarea | Título | Estado declarado | Estado verificado | Evidencia |
| --- | --- | --- | --- | --- |
| 001/T128 | Spreadsheet-safe CSV serialization | COMPLETED | Sin verificar | — |
| 001/T129 | Development dependency advisory resolution | COMPLETED | Sin verificar | — |
| 001/T130 | Administrative invariant enforcement on every auth path | COMPLETED | Sin verificar | — |
| 001/T131 | Atomic account mutation and audit | COMPLETED | Sin verificar | — |
| 001/T132 | Exactly-once account administration lifecycle | COMPLETED | Sin verificar | — |
| 001/T133 | Atomic bulk creation identity and event correctness | COMPLETED | Sin verificar | — |
| 001/T134 | Concurrent master-data creation replay | COMPLETED | Sin verificar | — |
| 001/T135 | Truthful serialized master-data audit chains | COMPLETED | Sin verificar | — |
| 001/T136 | Real inferred RPC response boundaries | ABIERTA | Sin verificar | — |
| 001/T137 | Validated recoverable persisted form drafts | COMPLETED | Sin verificar | — |
| 001/T138 | Consistent monetary storage/validation/arithmetic | COMPLETED | Sin verificar | — |
| 001/T139 | Validate auth JSON and decoded cursors | COMPLETED | Sin verificar | — |
| 001/T140 | Spanish audit and accessible sidebar text | COMPLETED | Sin verificar | — |
| 001/T142 | Accepted creation replay before later guards | COMPLETED | Sin verificar | — |
| 001/T143 | Inline neighborhood creation identity lifecycle | COMPLETED | Sin verificar | — |
| 001/T144 | Honest loading/failure/empty states | COMPLETED | Sin verificar | — |
| 001/T145 | Neighborhood edit waits for authoritative detail | COMPLETED | Sin verificar | — |
| 001/T146 | Concurrent five-failure per-account lock | COMPLETED | Sin verificar | — |
| 001/T147 | Preserve historical fee and rate-zone snapshots | COMPLETED | Sin verificar | — |
| 001/T148 | Concurrent name/alias uniqueness | COMPLETED | Sin verificar | — |
| 001/T149 | Complete authoritative previous-recipient autofill | COMPLETED | Sin verificar | — |
| 001/T150 | Native Better Auth failure log privacy | COMPLETED | Sin verificar | — |
| 001/T151 | Recovery bearer removal from request-path logs | COMPLETED | Sin verificar | — |
| 001/T152 | Native Sentry server/browser envelope privacy | COMPLETED | Sin verificar | — |
| 001/T153 | Safe fallback diagnostic projection | COMPLETED | Sin verificar | — |
| 001/T154 | Modal notification accessibility scan stabilization | COMPLETED | Sin verificar | — |
| 001/T155 | Development recovery mail must not log bearer URLs | COMPLETED | Sin verificar | — |
| 002/T063 | Exact financial aggregates on every route projection | COMPLETED | Sin verificar | — |
| 002/T064 | Unambiguous task references and current documentation | COMPLETED | Sin verificar | — |
| 003/T081 | Complete endpoint-to-role permission matrix | COMPLETED | Sin verificar | — |
| 003/T082 | Custody and exactly-once generated invariants | COMPLETED | Sin verificar | — |
| 003/T083 | Accessible courier controls and ≤3-tap primary actions | COMPLETED | Sin verificar | — |
| 003/T084 | Complete courier deployment documentation | COMPLETED | Sin verificar | — |
| 003/T085 | Operational export integration RED | COMPLETED | Sin verificar | — |
| 003/T086 | Operational export implementation and owner controls | COMPLETED | Sin verificar | — |
| 003/T087 | Actual Android/iPhone scenario acceptance | ABIERTA | Sin verificar | — |
| 003/T088 | Feature003 final complete gates | ABIERTA | Sin verificar | — |
| 003/T089 | Complete courier API contract verification | COMPLETED | Sin verificar | — |
| 003/T090 | Complete courier security and payload matrix | COMPLETED | Sin verificar | — |
| 003/T091 | Busy-day courier performance evidence | COMPLETED | Sin verificar | — |
| 003/T092 | Courier pure logic and rendered component gaps | COMPLETED | Sin verificar | — |
| 003/T093 | Full courier interface/usability review | ABIERTA | Sin verificar | — |
| 003/T131 | Interrupted-session recovery readiness | COMPLETED | Sin verificar | — |
| 003/T133 | Current-work photo authorization and browser cache isolation | COMPLETED | Sin verificar | — |
| 003/T134 | First-acknowledged proof-photo immutability | COMPLETED | Sin verificar | — |
| 003/T135 | Preserve courier-account link intent through query readiness | COMPLETED | Sin verificar | — |
| 004/T001 | Validated public base URL configuration | COMPLETED | Sin verificar | — |
| 004/T002 | Secret-code generation integration RED | RED VERIFIED | Sin verificar | — |
| 004/T003 | Public boundary/proxy/cache/header RED | RED VERIFIED | Sin verificar | — |
| 004/T004 | Additive schema, audit/event additions and safe backfill | COMPLETED | Sin verificar | — |
| 004/T005 | Native secret-code generation at creation | COMPLETED | Sin verificar | — |
| 004/T006 | Public router, limits and safe headers | COMPLETED | Sin verificar | — |
| 004/T007 | Public lazy layout/routes and worker privacy | COMPLETED | Sin verificar | — |
| 004/T008 | Owner support contact settings | COMPLETED | Sin verificar | — |
| 004/T009 | Public tracking projection privacy/state RED | RED VERIFIED | Sin verificar | — |
| 004/T010 | Pending-stop queue estimate RED | RED VERIFIED | Sin verificar | — |
| 004/T011 | Actual public tracking endpoint integration RED | RED VERIFIED | Sin verificar | — |
| 004/T012 | Anonymous tracking browser/network RED | RED VERIFIED | Sin verificar | — |
| 004/T013 | Pure public tracking view/schema | COMPLETED | Sin verificar | — |
| 004/T014 | Shared deliveries-before calculation | COMPLETED | Sin verificar | — |
| 004/T015 | Public tracking endpoint implementation | COMPLETED | Sin verificar | — |
| 004/T016 | Complete public tracking page | COMPLETED | Sin verificar | — |
| 004/T017 | Merchant message composition RED | RED VERIFIED | Sin verificar | — |
| 004/T018 | Notification list/mark/detail/export integration RED | RED VERIFIED | Sin verificar | — |
| 004/T019 | Manual notification browser RED | RED VERIFIED | Sin verificar | — |
| 004/T020 | Shared merchant message composer/schema | VERIFIED LOCAL | Sin verificar | — |
| 004/T021 | Notification endpoints and export/detail additions | VERIFIED LOCAL | Sin verificar | — |
| 004/T022 | Notification UI and durable post-open/copy marking | VERIFIED LOCAL | Sin verificar | — |
| 004/T023 | Merchant list/detail financial/privacy projection RED | RED VERIFIED | Sin verificar | — |
| 004/T024 | Merchant link isolation/photo/rotation integration RED | RED VERIFIED | Sin verificar | — |
| 004/T025 | Merchant portal browser RED | RED VERIFIED | Sin verificar | — |
| 004/T026 | Pure merchant projection and schemas | VERIFIED LOCAL | Sin verificar | — |
| 004/T027 | Merchant bearer endpoints and audited link replacement | VERIFIED LOCAL | Sin verificar | — |
| 004/T028 | Merchant page list/detail/date/totals UI | VERIFIED LOCAL | Sin verificar | — |
| 004/T029 | Copy/replace merchant link panel controls | VERIFIED LOCAL | Sin verificar | — |
| 004/T030 | Complete public/panel permission and read-only matrix | VERIFIED LOCAL | Sin verificar | — |
| 004/T031 | Random-code negative scan | VERIFIED LOCAL | Sin verificar | — |
| 004/T032 | Public and notification accessibility coverage | VERIFIED LOCAL | Sin verificar | — |
| 004/T033 | Go-live privacy/configuration documentation | VERIFIED LOCAL | Sin verificar | — |
| 004/T034 | Physical public/notification acceptance and timings | ABIERTA | Sin verificar | — |
| 004/T035 | Feature 004 final complete gates and delivery | ABIERTA | Sin verificar | — |

## Funcionalidades planeadas (historias de usuario)

| Etapa | Historia | Estado | Evidencia |
| --- | --- | --- | --- |
| 001 Registro de envíos | US1 Registrar un envío | Sin verificar | — |
| 001 Registro de envíos | US2 Tablero de despacho del día | Sin verificar | — |
| 001 Registro de envíos | US3 Corregir o anular un envío | Sin verificar | — |
| 001 Registro de envíos | US4 Registro masivo | Sin verificar | — |
| 001 Registro de envíos | US5 Buscar en el historial | Sin verificar | — |
| 001 Registro de envíos | US6 Datos maestros y tarifario | Sin verificar | — |
| 001 Registro de envíos | US7 Acceso por rol | Sin verificar | — |
| 002 Rutas y despacho | US1 Armar y despachar una ruta | Sin verificar | — |
| 002 Rutas y despacho | US2 Seguir las rutas del día | Sin verificar | — |
| 002 Rutas y despacho | US3 Ajustar una ruta | Sin verificar | — |
| 002 Rutas y despacho | US4 Reasignar a otro mensajero | Sin verificar | — |
| 002 Rutas y despacho | US5 Cancelar ruta o deshacer despacho | Sin verificar | — |
| 003 App del mensajero | US1 Hacer la ruta | Sin verificar | — |
| 003 App del mensajero | US2 Trabajar sin señal | Sin verificar | — |
| 003 App del mensajero | US3 Reportar lo que no se pudo hacer | Sin verificar | — |
| 003 App del mensajero | US4 Decidir después de una novedad | Sin verificar | — |
| 003 App del mensajero | US5 Seguir cambios y confirmar traspasos | Sin verificar | — |
| 003 App del mensajero | US6 Registrar a nombre del mensajero y corregir | Sin verificar | — |
| 003 App del mensajero | US7 Mi día | Sin verificar | — |
| 004 Rastreo y enlace del cliente | US1 Seguir un envío | Sin verificar | — |
| 004 Rastreo y enlace del cliente | US2 Enviar al cliente sus enlaces de rastreo | Sin verificar | — |
| 004 Rastreo y enlace del cliente | US3 Ver todos mis envíos | Sin verificar | — |

## Áreas transversales

| Área | Estado | Evidencia |
| --- | --- | --- |
| Datos y transacciones (atomicidad, rollback, restricciones, concurrencia, migraciones) | Sin verificar | — |
| Diseño y código limpio | Sin verificar | — |
| Robustez (entradas inválidas, límites, errores de red y base de datos, carga) | Sin verificar | — |
| Seguridad (autenticación, roles, validación, secretos, dependencias) | Sin verificar | — |
| Preparación para despliegue (entorno, configuración, logs, monitoreo, respaldos, build) | Sin verificar | — |

## Hallazgos nuevos

| ID | Severidad | Área | Archivo y línea | Descripción | Estado |
| --- | --- | --- | --- | --- | --- |

## Definición de terminado

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Las 81 tareas y todas las funcionalidades de 001 a 004 verificadas con evidencia | Sin verificar | — |
| Pruebas, build, lint y tipos sin errores ni advertencias | Sin verificar | — |
| Ningún hallazgo crítico ni alto abierto; medios y bajos no corregidos, documentados con su razón | Sin verificar | — |
| Flujos críticos con pruebas de integración o e2e, incluidos errores y concurrencia | Sin verificar | — |
