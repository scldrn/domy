# Lo que necesito de ti

Preguntas y pendientes para Samuel (propietario de Domy) y, a través de él, para Cohex. Claude
lo mantiene al día: agrega cada pregunta cuando surge y la mueve a «Resueltas» con tu respuesta
y la fecha. Responde aquí mismo o en la conversación.

Última actualización: 2026-10-14.

## Bloquean algo ahora

Autorizados el commit y push del registro de prueba móvil, la fusión squash de la PR #21
con CI verde y la continuación de US4 desde `main` actualizado.

Autorizados también el commit y push de T102 en la misma PR. Queda pendiente completar
el CI del commit de cierre antes de fusionar. T102 pasó sus pruebas y convergencia; el
timeout local de invariantes sigue documentado sin una causa confirmada. La aprobación
no permite fusionar con compuertas pendientes.

## Antes de terminar la 003 (app del mensajero)

Nada pendiente por ahora.

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
| 2026-10-14 | ¿Alinear spec, modelo, plan y tareas de US4 para permitir «Recogido» → «Registrado» exclusivamente al recibir en oficina un paquete fuera de ruta, con prueba de regresión y sin relajar las rutas? | Sí. Aplicar en la rama de US4 tras fusionar US3; todavía no implementado |
| 2026-10-14 | ¿Hacer commit y push de T102 en la PR #21 para repetir el CI? | Sí. No fusionar mientras queden compuertas pendientes |
| 2026-10-15 | ¿Cerrar la convergencia de T102, registrar el CI verde, publicar el cierre y fusionar la PR #21 con el nuevo CI verde para continuar US4? | «ok, hazlo». Mantener documentado el timeout local, sin declararlo resuelto |
