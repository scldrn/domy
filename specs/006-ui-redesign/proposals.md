# Screen Proposals

Register of the owner's decisions per screen (FR-003, FR-004; research R4). A screen is built
only when its row says `approved`.

| Screen | Area | Proposal | Status | Decided |
| --- | --- | --- | --- | --- |
| Design system revision (`docs/design-system.md`) | Foundation | [Reference v1](https://claude.ai/artifact/GXnWCeFb4yWXqnzajGjJFW) | approved | 2026-11-02: «Apruebo en verde» (delivered in green, not lime) |
| Tablero `/` | Daily operation | [Design artifact v11](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk) | implemented | 2026-11-02: version 8 «Tablero equilibrado» after «está muy sobrecargado… busca un equilibrio»; logo option 1 in version 9; version 11 applies the approved design system (delivered in green); implemented 2026-11-03 in slice `006-us1-board-screen` |
| Wordmark | Brand | Option 1 | approved | 2026-11-02: «Opción 1» (merged in #51) |
| Nuevo envío `/envios/nuevo` | Daily operation | [Design artifact v13](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk), beside the board | approved | 2026-11-03: «Apruebo», including «El mensajero cobra», the top bar's «Nuevo envío» marked as the current page, and the summary aside |
| Registro masivo `/envios/masivo` | Daily operation | [Design artifact v15](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk), beside the board and the shipment form | approved | 2026-11-03: «Apruebo», including the tabs by row state and the lot totals of the ready rows |
| Detalle de envío `/envios/:guía` | Daily operation | [Design artifact v17](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk), beside the board, the shipment form, and bulk registration | approved | 2026-11-03: «Apruebo», shown in four moments (exception, on route, delivered, assigned), including one «Historial» for custody and changes, «Recorrido» with times, and «Registrar por mensajero» hidden while no courier can be recorded for |
| Editar envío `/envios/:guía/editar` | Daily operation | [Design artifact v13](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk), beside the board | approved | 2026-11-03: «Apruebo», including the «Cambiado» marks and the list of changes |
| Rutas `/rutas` | Daily operation | [Design artifact v19](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk), beside the shipment detail | approved | 2026-11-04: «Apruebo», route cards with the board's stop track, «Sin asignar» grouped by pickup with check rows, and «Nueva ruta» as a sticky aside (a bottom bar on phones); light and phone width |
| Detalle de ruta `/rutas/:id` | Daily operation | [Design artifact v19](https://claude.ai/artifact/CWwBmieLM6FTk6dRTdJrfk), beside «Rutas» | approved | 2026-11-04: «Apruebo», shown in three moments (in preparation, in progress, finished), including «Despachar» in slate and «Mensajero» and «Avance» replacing «Resumen» |
| Historial `/historial` | Daily operation | — | pending | — |
| Notificar clientes `/notificar` | Daily operation | — | pending | — |
| Mi ruta `/mensajero` | Courier app | — | pending | — |
| Parada `/mensajero/parada/:id` | Courier app | — | pending | — |
| Mi día `/mensajero/mi-dia` | Courier app | — | pending | — |
| Pendientes `/mensajero/pendientes` | Courier app | — | pending | — |
| Seguimiento `/seguimiento/:código` | Public | — | pending | — |
| Enlace del cliente `/cliente/:código` | Public | — | pending | — |
| Ingresar, Recuperar, Restablecer | Sign-in | — | pending | — |
| Clientes and client detail | Master data | — | pending | — |
| Mensajeros `/mensajeros` | Master data | — | pending | — |
| Transportadoras `/transportadoras` | Master data | — | pending | — |
| Barrios `/barrios` | Master data | — | pending | — |
| Tarifario `/tarifario` | Master data | — | pending | — |
| Configuración `/configuracion` | Administration | — | pending | — |
| Usuarios `/usuarios` | Administration | — | pending | — |
| Auditoría `/auditoria` | Administration | — | pending | — |
| Mi cuenta `/cuenta` | Administration | — | pending | — |
| Panel shell (rail, top bar, search, theme) | Panel shell | Part of the board proposal | approved with the board | 2026-11-02 |
