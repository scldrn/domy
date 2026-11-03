# Lo que necesito de ti

Preguntas y pendientes para Samuel (propietario de Domy) y, a través de él, para Cohex. Claude
lo mantiene al día: agrega cada pregunta cuando surge y la mueve a «Resueltas» con tu respuesta
y la fecha. Responde aquí mismo o en la conversación.

Última actualización: 2026-11-02 (America/Bogota).

## Bloquean algo ahora

**Auditoría de producción — 2026-11-02:** los bloqueos de software están corregidos en `main`, con
CI en verde. Falta lo que depende de ti: las pruebas físicas y los datos de esta lista. Detalle en
[la auditoría](docs/production-readiness-audit-2026-11-02.md).

**Modo sin conexión — tu decisión del 2026-11-02:** la app del mensajero sí lo conserva, instalada o
en el navegador del teléfono; el panel sigue solo en línea. Esto anula el aplazamiento del
2026-10-23: la prueba física sin señal (T087, T093) y el fallo de reapertura en iPhone vuelven a
bloquear la salida. Para probarlo hace falta HTTPS con un certificado de confianza en los teléfonos.


**Revisión de cambios locales completada — 2026-10-23:** se revisaron las correcciones
nuevas frente a `main`, se corrigieron dos cambios que debilitaban la conservación de
fotos y los límites de solicitudes, y se conciliaron los documentos antiguos. Pasan
check, **1.686 pruebas**, **155 escenarios web sin reintentos**, build, auditoría de
dependencias sin avisos y la imagen nueva con arranque local. [Entrega vigente](docs/engineering-handoff.md).
Se conserva el alcance con conexión y la responsabilidad de despliegue del propietario.

**Salida con conexión — decisión del propietario, 2026-10-23:** «No necesito que
el sistema funcione sin conexión [...] no es algo que el cliente necesita en este
momento». Se retiran de esta salida las pruebas físicas sin conexión y su diagnóstico;
se continúa con la entrega para uso con internet. Se conserva el código, los datos
pendientes y las pruebas automatizadas. El fallo observado en iPhone queda aplazado,
sin declararlo aprobado. [Alcance vigente y evidencia](docs/online-release-scope.md).
El 94% corresponde al catálogo original, no al desarrollo restante de esta salida.
Infraestructura y despliegue siguen a cargo del propietario.

**Consolidación del repositorio — 2026-10-23:** pediste dejar el repositorio y
GitHub limpios, con una sola versión. La entrega canónica es `main`, mediante una
PR squash; se retiran las ramas incorporadas conservando un respaldo recuperable.
La revisión no detectó archivos de producción idénticos, funciones completas
repetidas de 80+ tokens ni copias `.bak/.old`. Se recuperó la corrección de transporte
pendiente y se corrigió una carrera de preparación de la prueba de fotos.
Pasan check, **1.626 pruebas**, **155 escenarios web sin reintentos** y build.
[Entrega actual](docs/engineering-handoff.md). El catálogo sigue en **76/81 (94%)**;
la aceptación física y el despliegue conservan su alcance anterior.


**Cierre técnico local — 2026-10-23:** continué sin subagentes, con la otra
sesión terminada. Recuperé ocho archivos y corregí fallos de bloqueo concurrente,
reintentos UUID, cursores, exportaciones grandes e historial con fechas empatadas.
Pasan check, **1.626 pruebas**, **154 escenarios web sin reintentos** y build sobre
el mismo código. La imagen nueva pasa su inspección y el ensayo de actualización:
se conservan cuentas, sesión, 29 tablas previas y valores COP; la base inicial
permanece idéntica tras el ensayo. [Entrega técnica](docs/engineering-handoff.md).

**76/81 tareas cerradas (94%).** Las cinco restantes son las pruebas físicas que
aplazaste y los cierres que dependen de ellas. No queda una pregunta que impida
este cierre técnico local. Infraestructura/despliegue siguen a tu cargo; las
configuraciones reales de proveedores y la aceptación física no se certifican con
estos ensayos. Los párrafos siguientes son evidencia histórica.

**Avance actual (2026-10-19 UTC):** T141 ya está fusionada. T153 tiene pruebas que
reproducen la filtración en diagnósticos y21 casos focalizados aprobados; pasan check,
967 pruebas,91 e2e al primer intento y build. Falta revisión/convergencia y publicación.
La PR #32 falló en CI:95 aprobadas, una fallida y una intermitente; sigue sin fusionarse.
#30/#31 siguen retenidas y la corrección de cuentas está preservada aparte.
También confirmé en un entorno desechable que el correo de desarrollo registra su
enlace con token: se añadió T155, pendiente, sin afirmar un incidente de datos reales.
No se requiere una nueva decisión de alcance para cumplir la prohibición de registrar
secretos. El documento `docs/integral-execution-backlog.md` detalla las81 tareas abiertas,
dependencias, pruebas y condiciones de cierre, además de los pendientes operativos.
Ya aprobaste CSV seguro para Excel y fotos propias del trabajo aún disponible en la app;
no son preguntas pendientes. Los demás párrafos de ejecución conservan evidencia histórica.

**Objetivo continuo autorizado (2026-10-19 UTC):** con «autorizo» aprobaste commit,
push, PR y fusión squash de cada porción, únicamente con revisión, compuertas locales
y CI limpio del último commit. Se retoma el objetivo de las 75 tareas; no incluye
desplegar ni modificar infraestructura de producción. Primero se publica/cierra T141,
después se abre la siguiente rama. La investigación D4 aporta seis casos exploratorios
con PostgreSQL real, no una implementación ni una tarea adicional completada.

**Ejecución autorizada:** con «Empieza, todo lo recomendado» y «continúa» aprobaste
iniciar las correcciones locales. El plan está en `docs/integral-remediation-plan.md`:
76 tareas pendientes al iniciar, ordenadas por dependencias y riesgo. La rama actual
es `001-fix-keyboard-readiness`; el primer alcance es T141, no todos los arreglos en
una sola rama. La prueba controlada reprodujo el fallo y la corrección de navegación
por teclado pasa 20 ejecuciones. Pasan check, 948 pruebas, 91 e2e al primer intento y
build; T141 queda completada localmente y siguen abiertas 75 tareas. Ya está autorizada
su publicación y fusión condicionada a CI limpio. No se ha publicado ni se cambió la
aplicación. Las decisiones de CSV y fotos siguientes siguen
pendientes. Los párrafos de revisión conservan el estado histórico anterior al arreglo.

**Revisión profunda consolidada:** hay 34 entradas en el informe: 9 críticas, 16
altas, 7 medias y 2 brechas de verificación/preparación. Se reprodujeron, entre otros,
cambios administrativos sin las protecciones necesarias, auditoría incorrecta bajo
concurrencia, reintentos con efectos tardíos, sustitución de fotos y cambios de datos
no elegidos desde formularios. Se añadieron 24 tareas nuevas sin modificar las
históricas. Check, 948 pruebas y build pasan; la corrida completa de navegador da
89 aprobadas y 1 fallida en el registro por teclado. La traza se conserva y no se
sustituyó por otra corrida. No hay arreglos de aplicación ni publicación en esta revisión.

**Etapa integral actual:** pediste verificar el proyecto completo, incluidas las ideas
aprobadas, incidencias históricas, conexiones y deuda técnica, y confirmaste incluir
también terminar la 004. El informe local está en `docs/integral-verification.md`, rama
`chore/integral-verification`. No está declarado todo listo ni hay cambios de aplicación
o publicación en esta revisión. La PR #28 ya fue fusionada como `9006db3` y su CI de
main pasó limpio; los párrafos siguientes conservan el contexto histórico.

Antes de elegir correcciones que cambien el contrato, quedan planteadas estas dos
decisiones: si el mensajero accede solo a fotos propias del trabajo aún en su app o
también a todo su historial, y si el CSV prioriza apertura segura en Excel o texto
exacto para importación con XLSX para consulta. No se ha reproducido una filtración
de caché ni un ataque real en Excel; sí hay una inconsistencia de alcance de fotos
y una celda de fórmula sin neutralizar. La aceptación física T087/T093 sigue pendiente.

### Contexto previo de la PR diagnóstica

La [PR #27](https://github.com/scldrn/domy/pull/27) ya está fusionada como `f4f124d`,
con árbol idéntico al head aprobado y CI previo limpio `39059903192` (948 pruebas/90 e2e
al primer intento). El CI posterior `39071328672` pasó check/build y 948 pruebas, pero
tuvo 89 e2e directos y uno con reintento: recuperación tras indisponibilidad temporal del
servidor, esperando el enlace de la parada. No es una corrida limpia ni se conoce aún
la causa. El [recibo](https://github.com/scldrn/domy/pull/27#issuecomment-6241871750)
conserva la evidencia; no hay traza subida. Autorizaste investigar y corregir localmente
con «Si» (2026-10-17), T131 en `003-fix-offline-recovery`. La autorización posterior
de T132 permitió publicar el cambio diagnóstico; la posterior aprobación de fusión
descrita abajo permite solo su squash y verificar main, no comenzar el pulido.
La validación física T087/T093 sigue pendiente.

La investigación local no reprodujo el timeout: 20 repeticiones (10 normales y 10 con
CPU ralentizada), tres órdenes de sesión/red controlados y los 90 e2e originales pasan.
Al terminar esa investigación se retiró toda la instrumentación temporal y no había
cambios de aplicación, prueba, helper ni CI. No hay un arreglo confirmado ni T131
terminada; la evidencia queda conservada. T132 cambia ahora solo el CI y su documentación.
Autorizaste con «Si» (2026-10-17) preparar, hacer commit/push y publicar una PR
diagnóstica que conserve las trazas de CI, incluso si un reintento deja el job en verde,
sin cambiar tiempos, reintentos, workers ni cobertura: T132. Se subirán solo trazas,
con caducidad de siete días, y se revisará el CI real del último commit. Una corrida
limpia sin trazas no demuestra la subida de una traza fallida ni soluciona T131.
La [PR #28](https://github.com/scldrn/domy/pull/28), source `393e5c7`, pasó el CI
`39077701647`: check/build, 948 pruebas y 90 e2e al primer intento (13,7 min).
El paso de trazas se ejecutó sin archivos ni artefactos; no hubo un fallo cuya traza
se pudiera subir. El [recibo](https://github.com/scldrn/domy/pull/28#issuecomment-6243133009)
mantiene esta limitación y el fallo histórico. Después autorizaste con «Si» fusionar
mediante squash, solo con CI limpio del último commit, y comprobar el CI posterior
de main. Este registro documental debe pasar también CI antes de la fusión. La PR
registra hashes y resultados reales; no se declara una fusión antes de realizarla.
T131 sigue abierta; no implica comenzar el pulido ni completar la validación física.

Contexto histórico de T130 (no repetir su fusión):

PR #26 ya está fusionada como `e43ea1e`. Su CI final previo `39040911443` pasó limpio;
el posterior de main `39043360351` pasó check/build y 948 pruebas, pero los e2e fueron
89 al primer intento y uno con reintento: notificaciones expandidas interceptaron el
enlace de la parada antes del formulario de novedad. No es una corrida limpia.
Autorizaste investigar y corregirlo localmente con «Si» (2026-10-17), en
`003-fix-exception-navigation`, T130.
T130 ya está corregida y convergida localmente: reproducción determinista conservada,
10 repeticiones aprobadas, check/build, 948 pruebas y 90 e2e al primer intento (5,2 min).
Solo cambia la navegación de esa prueba y fortalece las verificaciones de avisos;
la aplicación y los límites no cambian. Autorizaste commit, push y abrir la PR con «Si»
(2026-10-17), incluida la revisión del CI del último commit. La [PR #27](https://github.com/scldrn/domy/pull/27)
está publicada: `bf26d7b` pasó CI `39057471380` con check/build, 948 pruebas y 90 e2e
al primer intento (10,8 min), incluidas instalación y tareas posteriores. El recibo
conserva los fallos históricos y los avisos esperados de autenticación/infraestructura.
Después autorizaste fusionarla mediante squash con «Si» (2026-10-17), solo con CI limpio
del último commit y posterior verificación del CI del squash en main. La PR registra
los hashes y resultados reales al retomar; no se declara una fusión antes de realizarla.
**Continuar con el pulido no está autorizado**; requiere otra decisión.
La validación física y el cierre global de la 003 siguen pendientes.

US6 y T126/T127 ya están fusionadas en la [PR #25](https://github.com/scldrn/domy/pull/25)
como `525ca94`; el CI posterior `39008252312` pasó check, build, 938 pruebas y 88 e2e
al primer intento. El recibo está en la PR. Se conservan tus dos opciones A y los
fallos históricos; no hay que repetir esa fusión.

T122 ya está fusionada en la PR #24 como `18c832c`. El CI posterior `38945702324`
pasó 883 pruebas y 82 e2e al primer intento, check y build; el recibo está en la PR.
El antiguo CI `38926371410` de la PR #23 conserva su fallo con reintento como evidencia
histórica, no como corrida limpia.

## Antes de terminar la 003 (app del mensajero)

Completar la validación física por escenarios T087/T093 en Android y iPhone, incluidas
las notificaciones con la app instalada. Las pruebas automatizadas de US5 no sustituyen
esta validación ni amplían la prueba móvil anterior de US1–US3.

## Antes de salir a producción

3. **Tarifas de Amy Tecnology**: hoy son inferidas del libro de envíos. ¿Las confirma el
   cliente?
5. **Autorización de los mensajeros** para mostrar su primer nombre y teléfono en la página de
   rastreo (Ley 1581 de 2012). Hace falta para la 004.
6. **Bucket de DigitalOcean Spaces a nombre del cliente** para las fotos, con regla de
   borrado a los 12 meses. Solo al desplegar.
7. **Medir con la coordinadora de despacho** los tiempos de SC-001, SC-004 y SC-006 de la 002
   (crear una ruta, despachar, reasignar) con el sistema en uso real.
9. **Etapas 005 a 007** (2026-10-23): la verificación para despliegue pide revisar las etapas
   001 a 007, pero el repositorio solo tiene especificaciones de la 001 a la 004 (`specs/`) y
   ningún documento, rama ni tarea menciona una 005, 006 o 007. ¿Existen en otro lugar o el
   alcance es 001–004? Mientras tanto se verifica 001–004.
    **Actualización 2026-11-02:** existe la rama local `005-merchant-portal`, sin ningún commit
    propio y con `specs/005-merchant-portal/` vacía. El portal del cliente con inicio de sesión
    (I-08) está fuera de la Fase 1. ¿Es trabajo para después de la salida o entra en esta entrega?
11. **Plataforma y respaldos** (2026-10-24): elegir proveedor y arquitectura (la imagen se
    probó en arm64), dominio y certificado, y para los respaldos el horario, cuántos guardar,
    dónde se copian fuera del servidor, quién recibe la alerta si fallan y cómo se respaldan
    las fotos. `scripts/backup.sh` y `scripts/restore.sh` existen y están probados, pero no se
    programan solos. Detalle en `docs/verificacion-despliegue.md`.

## Resueltas

| Fecha | Pregunta | Respuesta |
| --- | --- | --- |
| 2026-11-02 | ¿Apruebas la revisión del sistema de diseño del rediseño (006)? | «Apruebo en verde»: lima como único acento, superficies de pizarra, tema claro y oscuro en el panel; «Entregados» y las paradas hechas en verde, no en lima |
| 2026-11-02 | ¿Cómo se dibuja la palabra «domy» junto al logo? | «Opción 1»: toda la palabra con el trazo de la «d», de la «d» a la «y», en un solo color. Reemplaza el nombre como texto en la interfaz y en la vista previa |
| 2026-11-02 | ¿Qué logo «route d» se usa? (pregunta 8) | «Elijo el logo A», la curva cerrada. Íconos, favicon y vista previa generados con `pnpm icons`; el nombre en la interfaz sigue como texto |
| 2026-11-02 | ¿Qué hacemos con los avisos de una fecha futura? (pregunta 10) | «Usa tus recomendaciones»: se limitan a hoy o antes (004/T037) |
| 2026-11-02 | ¿Qué tarifa tienen Caldas y Girardota? (pregunta 4) | «Usa tus recomendaciones»: siguen con tarifa manual y motivo, marcadas «Tarifa por revisar», hasta que el cliente las dé |
| 2026-11-02 | ¿Aceptar el riesgo de `glob` y `minimatch`, avisos moderados que solo trae un plugin de Sentry que el servidor no carga? | «Sí, lo acepto». Revisar cuando Sentry publique una versión sin ellos |
| 2026-11-02 | ¿Corregir los bloqueos de la auditoría en ramas cortas, con PR y fusión con CI verde? | «Sí, corrige todo». PR #44, #45, #46 y la de documentos |
| 2026-11-02 | ¿Dónde se conserva el modo sin conexión? | «Descarta el modo sin conexion para la app web si para la movil»; aclarado como «App del mensajero sí», instalada o en el navegador del teléfono. El panel sigue solo en línea. Vuelve a exigir la prueba física sin señal |
| 2026-10-19 | ¿Priorizar CSV seguro para Excel, neutralizando fórmulas y documentando la transformación? | «Sí, CSV seguro para Excel». Mantener los valores monetarios/fechas correctos y documentar la transformación del texto; decisión incorporada al documento de ejecución |
| 2026-10-19 | ¿Mantener fotos del mensajero solo de su propio trabajo aún disponible en la app? | «Sí, solo trabajo vigente en la app». Conservar003 FR-036; falta definir/probar la frontera técnica sin impedir subir pruebas offline pendientes |
| 2026-10-19 | ¿Autorizar commit, push, PR y squash por porción del plan integral, con revisión y compuertas locales/CI limpias? | «autorizo». Incluye cerrar T141 y continuar las 75 tareas por ramas pequeñas; excluye despliegues e infraestructura de producción y no resuelve las decisiones de CSV/fotos |
| 2026-10-17 | ¿Incluir en la etapa integral terminar la 004 o cerrar solo lo desarrollado en 001–003? | «Incluir también la implementación de 004». La verificación/cierre abarca las cuatro funcionalidades; no equivale a una certificación de calidad ni a autorización de commit, push o fusión |
| 2026-10-17 | ¿Fusionar la PR #28 diagnóstica mediante squash y verificar después el CI de main? | «Si». Autorizada fusión solo con CI limpio del último commit y verificación posterior; sin cerrar T131 ni comenzar el pulido |
| 2026-10-17 | ¿Preparar y publicar una PR diagnóstica que conserve las trazas de CI incluso tras un reintento exitoso? | «Si». Autorizados preparación, commit, push, PR y revisión del CI del último commit para T132; sin cambiar límites/cobertura, fusionar, cerrar T131 ni comenzar el pulido |
| 2026-10-17 | ¿Investigar y corregir localmente la nueva inestabilidad offline posterior a la PR #27, antes del pulido? | «Si». Autorizada investigación/corrección local T131 con metodología estricta y pruebas primero; sin publicación, fusión ni pulido |
| 2026-10-17 | ¿Fusionar la PR #27 mediante squash y verificar después el CI de main? | «Si». Autorizada fusión con CI limpio del último commit y comprobación posterior del squash; sin comenzar el pulido |
| 2026-10-17 | ¿Hacer commit, push y abrir la PR de T130 para verificar CI? | «Si». Autorizada publicación y revisión del CI del último commit; sin fusionar ni comenzar el pulido |
| 2026-10-17 | ¿Investigar y corregir la inestabilidad e2e posterior a la fusión de US7, antes del pulido? | «Si». Autorizada corrección local T130 con reproducción, pruebas primero y metodología estricta; publicación, fusión y pulido requieren otra aprobación |
| 2026-10-17 | ¿Fusionar la PR #26 mediante squash después de su CI limpio? | «Si». Autorizada fusión con último head verificado y comprobación posterior de main; sin continuar con el pulido |
| 2026-10-17 | ¿Hacer commit, push y abrir la PR de US7? | «sI». Autorizada publicación de T077–T080/T128/T129 y revisión del CI del último commit; no fusión ni continuar con el pulido |
| 2026-10-17 | ¿Iniciar US7 después de verificar la fusión de US6 y el CI de main? | «Inicia». Autorizada implementación local T077–T080 con análisis, pruebas primero y convergencia; sin commit, push, PR ni fusión |
| 2026-10-17 | ¿Fusionar la PR #25 mediante squash tras el CI final limpio? | «Si». Autorizada fusión con último head verificado y revisión posterior de main; sin iniciar US7 |
| 2026-10-16 | ¿Hacer commit y push de T127 en la PR #25 para comprobar el nuevo instalador en GitHub CI? | «Si». Autorizada publicación y revisión del CI del último commit; sin fusión ni iniciar US7 |
| 2026-10-16 | ¿Investigar y corregir el aviso de PNPM_HOME manteniendo versiones y compuertas? | «Si». Autorizada investigación/corrección local T127; sin commit/push, fusión ni iniciar US7 |
| 2026-10-16 | ¿Hacer commit y push de T126 en la PR #25 para validar el CI del nuevo commit? | «Si». Autorizada publicación y revisión del CI del último commit, incluidos e2e al primer intento; no fusión ni iniciar US7 |
| 2026-10-16 | ¿Investigar y corregir el e2e inestable de registro por teclado antes de proponer la fusión de US6? | «si». Autorizada investigación y corrección local T126 con metodología estricta y sin flexibilizar pruebas; publicación, fusión y US7 requieren aprobación aparte |
| 2026-10-16 | ¿Hacer commit, push y abrir la PR de US6? | «Si». Autorizada publicación de T071–T076/T123–T125 y revisión del CI del último commit; no fusión ni iniciar US7 |
| 2026-10-16 | ¿Impedir revertir un registro de paquete si después hubo otra decisión de despacho o cambió su custodia? | «A». Rechazar la reversión con conflicto, explicar los cambios posteriores y conservarlos; no deshacerlos implícitamente |
| 2026-10-16 | ¿Qué ocurre al revertir un mandado terminado por error? | «A». En ruta con parada pendiente si la ruta original sigue en curso con el mismo mensajero; de lo contrario Registrado sin asignar. En ambos casos sin custodia de paquete; spec, modelo, contrato, plan, investigación, quickstart y T072/T073/T075 alineados |
| 2026-10-16 | ¿Iniciar US6 localmente, sin publicar ni fusionar? | «Autorizo». Autorizada rama local desde main actualizado, análisis previo, pruebas primero, implementación y convergencia; decisiones de negocio no definidas se consultan antes de codificar |
| 2026-10-16 | ¿Fusionar la PR #24 mediante squash con el último CI limpio? | «Si». Fusionada como `18c832c`; CI previo `38934535031` y posterior `38945702324` limpios, con 883 pruebas/82 e2e al primer intento |
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
