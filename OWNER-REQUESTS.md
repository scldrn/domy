# Lo que necesito de ti

Preguntas y pendientes para Samuel (propietario de Domy) y, a través de él, para Cohex. Claude
lo mantiene al día: agrega cada pregunta cuando surge y la mueve a «Resueltas» con tu respuesta
y la fecha. Responde aquí mismo o en la conversación.

Última actualización: 2026-10-16.

## Bloquean algo ahora

Nada requiere respuesta ahora. Autorizaste commit, push y apertura de una nueva PR
con T122 en `003-fix-push-validation`, para validar CI. Las cuatro compuertas locales pasan:
883 pruebas, 82 e2e sin reintentos, check y build; además 30 repeticiones de la
notificación nativa y convergencia puntual sin hallazgos. La corrección sincroniza la
prueba con la finalización real del push dentro de los mismos cinco segundos; no
cambia la aplicación ni sustituye notificaciones nativas. Fusión y US6 requieren
autorización aparte.

La PR #23 ya está fusionada como `63c5070`. Su CI posterior `38926371410` reintentó
la prueba de notificación nativa: no se considera una corrida limpia, ni la corrección
local equivale a validación remota. La causa reproducida y sus límites están documentados.

## Antes de terminar la 003 (app del mensajero)

Completar la validación física por escenarios T087/T093 en Android y iPhone, incluidas
las notificaciones con la app instalada. Las pruebas automatizadas de US5 no sustituyen
esta validación ni amplían la prueba móvil anterior de US1–US3.

## Antes de salir a producción

3. **Tarifas de Amy Tecnology**: hoy son inferidas del libro de envíos. ¿Las confirma el
   cliente?
4. **Tarifas de Caldas y Girardota**: no hay tarifa confirmada; sus envíos piden tarifa manual
   («Sin tarifa»).
5. **Autorización de los mensajeros** para mostrar su primer nombre y teléfono en la página de
   rastreo (Ley 1581 de 2012). Hace falta para la 004.
6. **Bucket de DigitalOcean Spaces a nombre del cliente** para las fotos, con regla de
   borrado a los 12 meses. Solo al desplegar.
7. **Medir con la coordinadora de despacho** los tiempos de SC-001, SC-004 y SC-006 de la 002
   (crear una ruta, despachar, reasignar) con el sistema en uso real.

## Decisiones visuales (son tuyas)

8. **El logo definitivo**: la dirección «route d» está aprobada (design-system.md §11), pero
   falta el arte. Mientras tanto, los íconos de la app son el texto provisional «domy».

## Resueltas

| Fecha | Pregunta | Respuesta |
| --- | --- | --- |
| 2026-10-16 | ¿Hacer commit, push y abrir la PR de T122 para validar CI? | «Si». Autorizada publicación y revisión del CI del último commit; no fusión ni iniciar US6 |
| 2026-10-16 | ¿Investigar/corregir primero la inestabilidad de notificación nativa posterior a la fusión, en una rama nueva y con compuertas estrictas? | «Si». Autorizada corrección local T122; publicación/PR/merge y US6 requieren aprobación aparte |
| 2026-10-16 | ¿Investigar/corregir T121, repetir compuertas/convergencia y después realizar la fusión autorizada? | «Si». Sin ampliar tiempos, relajar pruebas ni iniciar US6 |
| 2026-10-16 | ¿Investigar/corregir los avisos de GitHub y fusionar US5 respetando la metodología? | Corregir si es sencillo; si no afecta al sistema y requiere un cambio desproporcionado, documentar y dejarlo. Después fusionar con último CI verde. No incluye comenzar US6 |
| 2026-10-15 | ¿Hacer commit, push y abrir la PR de US5 (T061–T070 y T113–T119)? | «Si». Autorizada la publicación y revisión de CI; no la fusión ni comenzar US6 |
| 2026-10-15 | ¿Completar la implementación local y corregir todos los hallazgos de US5 siguiendo la metodología estricta? | «Arregla todo, con la mayor calidad y sin deuda tecnica». T061–T070 y T113–T119 completas y verificadas; publicación, fusión y US6 pendientes de autorización |
| 2026-10-15 | ¿Explicitar `GET /api/courier/push-config` y alinear contrato, plan y T061/T066/T068 antes de implementar US5? | «autorizo». Solo mensajeros vinculados; `{ publicKey: string \| null }`, sin clave privada, migración ni variable de compilación web |
| 2026-10-15 | ¿Continuar con US5 desde `main` actualizado? | «ok, continuemos». Implementación local siguiendo la metodología obligatoria; sin autorización de publicación o fusión |
| 2026-10-15 | ¿Fusionar la PR #22 mediante squash con el último CI limpio? | «Autorizo». Fusionada como `34875ba`; CI del head `d3e3830` y CI posterior de `main` aprobados |
| 2026-10-15 | ¿Publicar T111/T112 mediante commit y push en la PR #22 para validar un CI nuevo? | «Autorizo». Solo publicar la corrección y revisar CI; no fusionar ni continuar US5 |
| 2026-10-15 | Investigar y corregir la inestabilidad encontrada al revisar la PR #22 | «Investiga y Arreglalo». T111/T112 reproducidas y corregidas localmente; cuatro compuertas y convergencia puntual aprobadas. Publicar la corrección requiere aprobación; sin autorización de fusión ni continuación a US5 |
| 2026-10-15 | ¿Hacer commit, push y abrir la PR de US4 después de las cuatro compuertas y la convergencia? | «Sí». Autorizada la publicación de T053–T060/T103–T110. La fusión y continuar US5 requieren autorización aparte y CI verde |
| 2026-10-14 | Íconos de la app instalable mientras no hay logo | Provisional «domy» |
| 2026-10-14 | ¿Avisar al mensajero cuando se edita un envío de su ruta? | Sí, con aviso |
| 2026-10-14 | ¿Dónde se vincula la cuenta de un mensajero con su ficha? | En «Usuarios», solo el propietario, al crear o editar una cuenta con rol Mensajero (T094) |
| 2026-10-14 | Dirección real de la oficina | Carrera 90 # 65C-10, Urbanización Mirador de Barcelona, barrio Robledo, Medellín |
| 2026-10-14 | Teléfonos para la validación manual (T087) | Samuel tiene un Android y un iPhone |
| 2026-10-14 | ¿Fusionar la PR #19 con CI verde y continuar US2 desde `main` actualizado? | Sí; fusionar mediante squash y continuar US2 |
| 2026-10-14 | ¿Explicitar la dependencia de la validación offline de «Novedad»? | Sí; US2 valida recogidas y entregas en la interfaz y todos los registros técnicamente. US3 completa el escenario visual de «Novedad» |
| 2026-10-14 | ¿Hacer commit, push y abrir la PR de US2? | Aprobado. La fusión de esta PR y continuar US3 requieren autorización aparte |
| 2026-10-14 | ¿Fusionar la PR #20 mediante squash con CI verde y continuar US3 desde `main` actualizado? | Autorizado; fusionada como `93fdf09` y US3 continúa en `003-us3-exceptions` |
| 2026-10-14 | ¿Explicitar `returnDecided` por fila del tablero y una regla compartida para lista y conteo de «Novedades por decidir»? | Sí; excluir devoluciones ya decididas, sin adelantar acciones de US4 |
| 2026-10-14 | ¿Hacer commit, push y abrir la PR de US3 (T048–T052 y T099–T101)? | Sí. La fusión y continuar US4 requieren autorización aparte y CI verde |
| 2026-10-14 | ¿Publicar el registro de la prueba móvil, fusionar la PR #21 mediante squash con CI verde y continuar US4? | Autorizado. Probado en iOS y Android con Chrome y Safari: funcionamiento esperado |
| 2026-10-14 | ¿Alinear spec, modelo, plan y tareas de US4 para permitir «Recogido» → «Registrado» exclusivamente al recibir en oficina un paquete fuera de ruta, con prueba de regresión y sin relajar las rutas? | Sí. Alineación e implementación locales en `003-us4-decisions`, con pruebas de dominio y PostgreSQL pasando. La prohibición de la transición genérica sigue intacta. La interfaz y las compuertas finales de US4 siguen pendientes |
| 2026-10-14 | ¿Hacer commit y push de T102 en la PR #21 para repetir el CI? | Sí. No fusionar mientras queden compuertas pendientes |
| 2026-10-15 | ¿Cerrar la convergencia de T102, registrar el CI verde, publicar el cierre y fusionar la PR #21 con el nuevo CI verde para continuar US4? | «ok, hazlo». Cierre publicado como `64f9622`; CI `38684623497` verde; PR #21 fusionada como `4910f76`. US4 inicia desde ese `main`. Se mantiene documentado el timeout local, sin declararlo resuelto |
| 2026-10-15 | ¿Precisar las pruebas de reintentos de decisiones y las respuestas GET/PATCH de configuración antes de T053? | «Ok continuemos con tu recomendacion». Tareas, contrato y plan ajustados antes de implementar. Las pruebas de decisiones, configuración y reintentos pasan localmente; US4 aún no está terminada ni publicada |
| 2026-10-15 | ¿Aislar rendimiento e invariantes del resto de la suite manteniendo todos los casos, semillas, pasos, aserciones y límites? | «Sí, aislar esas pruebas conservando cobertura y límites». Plan, tareas y quickstart alineados antes de configurar los proyectos nativos de Vitest. El resto mantiene su paralelismo; no se añaden archivos de capacidad aún no implementados |
