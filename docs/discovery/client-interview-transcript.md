# Entrevista de levantamiento de procesos — Carrera 90

**Materia:** operación diaria de una empresa de mensajería urbana y procesos que hoy
se ejecutan de forma manual.
**Grabaciones:** dos audios, 7 min 38 s y 2 min 24 s (10 min 02 s en total).
**Participantes:** un entrevistador y el responsable del negocio.

---

## Nota metodológica

Este documento concilia cuatro transcripciones independientes del mismo material:

| Fuente | Motor | Aporte |
| --- | --- | --- |
| Qwen, diarizada | `qwen-audio-3.0-asr-flash-filetrans` | Tiempos por palabra, hablantes, terminología del negocio |
| Qwen, contraste | `qwen-audio-3.0-asr-flash` | Segunda lectura independiente del audio |
| Qwen, escucha | `qwen3.5-omni-plus` | Verificación de tramos dudosos contra el audio |
| OpenAI | `gpt-transcribe`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize` | Transcripción y diarización previas |
| Local | `whisper-large-v3-turbo` | Lectura de referencia |

**Criterios de edición.** El contenido es íntegro: no se ha resumido ni omitido
ninguna idea del hablante. Se ha intervenido la forma:

- Eliminadas las muletillas de apoyo (*cierto*, *sí o qué*, *como tal*, *pues*,
  *eh*) y las repeticiones por titubeo.
- Normalizado el registro coloquial a español profesional, conservando los
  términos propios del negocio (recaudo, contraentrega, planilla, cartera,
  conciliación, liquidación, trazabilidad, domicilio), que son vocabulario
  técnico del sector y no jerga.
- Reordenadas las frases interrumpidas para que cada intervención se lea seguida.
- Apartada la conversación paralela ajena al tema (ver anexo B).

Las decisiones sobre pasajes en los que las fuentes no coincidían están
documentadas en el anexo A. La versión literal, con muletillas, pausas medidas y
tiempos por palabra, se conserva en `Transcripción Qwen con hablantes.md`.

---

## Audio 1 — La operación de principio a fin

**[00:00] Entrevistador**

Quiero que me hable de todo su negocio, desde que consigue un cliente hasta que le
entregan el paquete, indicando también los procesos manuales que usted realiza.

**[00:13] Responsable del negocio**

Le voy a contar toda la operación.

Nuestra operación empieza a las ocho de la mañana, que es cuando abrimos a recibir
servicios de mensajería. Los clientes nos escriben por WhatsApp. Tenemos una
persona que es el coordinador logístico: recibe los mensajes y los digita en una
planilla para empezar a armar las rutas de los mensajeros.

Según las rutas que salgan en un tiempo establecido, vamos evacuando los
servicios. Tratamos de armar rutas de ocho o nueve servicios, porque la idea es
que el mensajero tenga un buen recorrido y podamos volver a tenerlo activo
mientras entran más servicios.

El coordinador es el encargado de asignar las rutas según los destinos y la
cantidad de mensajeros que haya. Cada mensajero tiene la responsabilidad de
recoger y entregar los paquetes que el coordinador le asigne.

Hay paquetes que se recogen todos en el mismo lugar, y también puede haber varios
puntos de recogida porque son clientes diferentes. Por lo general son ocho
entregas distintas, pero esas ocho entregas se pueden resumir en dos recogidas, o
en tres. Sí o sí tienen que ser ocho puntos específicos en los que se debe
entregar.

La idea es que, cuando los mensajeros llegan a los puntos, nos manden una foto
como evidencia de que se realizó la entrega. Sobre todo para evitar
inconvenientes: que no se entregó el paquete, que el paquete no ha llegado, una
cosa o la otra. Así el coordinador sabe que el paquete ya llegó y le informa al
cliente que su paquete fue entregado.

Una cosa que omití: cuando el cliente nos escribe, nos da las indicaciones
específicas del lugar de entrega. La dirección de recogida generalmente es la
misma, porque nos la dan cuando empiezan a trabajar con nosotros; si la cambian,
nos informan. Entonces nos entregan información de recogida e información de
entrega.

En la información de entrega manejamos varios tipos de paquete. Uno es
contraentrega: se va a entregar y me pagan el recaudo de lo que valga ese paquete.
Otro es solamente ir a entregar, y me pagan únicamente el domicilio. Y otro es ir
a entregar cuando el cliente ya lo pagó todo y después me lo cancela a mí. Esos
son los tres tipos de entrega que hacemos.

Con base en esa información se les asigna a los mensajeros. Ellos hacen las
entregas, nos comparten la evidencia fotográfica, nosotros le informamos al
cliente que ya fue entregada y ahí finaliza cada entrega.

¿Qué es lo que pasa? Que a veces el volumen de trabajo le impide al coordinador
informarle al cliente que el pedido ya está en ruta. O, si la ruta se demora
mucho, el cliente empieza a generar ansiedad porque no sabe nada del paquete.
Después de que el coordinador asigna, la información queda solamente para
nosotros.

**[03:51] Entrevistador**

¿Queda solamente para ustedes?

**[03:53] Responsable del negocio**

Eso. Queda solamente para nosotros: ni el cliente que solicitó el servicio ni la
persona a la que se le va a entregar tienen información al respecto.

Ese es uno de los aspectos que más quiero que mejore con esto, porque al final es
importante que nuestro cliente sepa que el pedido ya está coordinado, y que el
cliente de él sepa que el pedido ya está en ruta. Aunque todavía no haya salido,
aunque todavía no lo hayan recogido, que de una u otra manera sepa que ya está en
ruta y que el paquete va camino a su destino.

Ese sería un resumen de cómo funciona la operación. En cuanto a los procesos
manuales: al finalizar el día tenemos que hacer una conciliación con el mensajero.

**[04:48] Entrevistador**

La conciliación con el mensajero, ¿en qué consiste?

**[04:50] Responsable del negocio**

En mirar cuántos servicios hizo y que estén registrados, porque al final con base
en eso le pago; y cuál es el recaudo del día. La idea es que el recaudo del día me
lo consignen para yo poder transferírselo a los clientes, porque ese es dinero
directamente de los clientes y no nuestro.

Al finalizar la semana les pago lo que hicieron durante la semana. A algunos
mensajeros les pago el mismo día. Genero una tabla —se la voy a mostrar— en la que
les indico cuánto se ganaron: el total de servicios, este se ganó ciento
veinticuatro mil, recaudó ochocientos treinta y seis.

El campo «se pagó» es para las veces en que les toca pagar a ellos transportadoras,
o pagar paquetes: un cliente nos mandó a reclamar algo pero no se podía
transferir, entonces mandan a uno a pagar el paquete. Eso obviamente se lo
descuento de la liquidación, porque ese es el efectivo que ellos me deben entregar
a mí. En caso de que sea un mensajero al que le pago por día, a este valor se le
resta esto y me entrega la diferencia.

Ese es el otro proceso manual que hacemos. Y con base en esta información yo ya
tengo un archivo madre en el que mantengo todo.

**[06:43] Responsable del negocio**

En ese archivo madre está la relación que les mando a los clientes. Por ejemplo,
esta es una relación que le mando a un cliente: yo asiento todo en otro cuadro y
les mando este, donde está el cliente, que es el mío, y el nombre del cliente de
ellos, para que también puedan hacer trazabilidad; dónde fue realizada la entrega;
si hubo recaudo o no, porque a unos les recaudé y a otros no; y cuánto es el valor
de cada servicio. Este valor menos este, y le consigno la diferencia.

Ese es otro de los procesos que hago manual, que es el tema de la cartera. Y ahí
finaliza la operación.

**[07:34] Entrevistador**

Bien. Lo veo bastante viable.

---

## Audio 2 — El archivo madre y el control de cartera

**[00:00] Responsable del negocio**

…para volver y saber qué mensajero lo hizo. Es la trazabilidad diaria, el día a
día. Está la planilla que hace John: esa planilla me la comparte él, y yo igual
guardo una trazabilidad por si se presenta cualquier novedad.

Aparte tengo mi cuadro contable, que es donde llevo quién me debe y quién no.
Por ejemplo, «pendiente al cliente» es porque yo se lo debo a él: le recaudé y
todavía no le he pagado. Los que dicen «servicios» es porque ellos me deben a mí.
Y el que está «cancelado» es porque ya me lo pagaron.

Otro estado que pongo acá es «esperando pago». Es cuando le mandé la cartera
indicándole que me debe determinado valor y estoy esperando que me hagan la
consignación para poder bajarlos de cartera. Cuando digo «esperando pago» es
porque ya le mandé la conciliación.

Porque también tenemos casos en los que los clientes solo nos mandan a entregar
pero no recaudamos nada, así que no tenemos con qué cruzar. En esos casos les
mando la cartera. Ese es el otro campo que manejo.

Básicamente, ¿qué cargo yo? El nombre del cliente. En la partida, a este cliente en
específico le pongo el lugar, pero a la mayoría les pongo los nombres de las
personas a las que les entregamos, sobre todo por temas de trazabilidad. Además:
el destino, el recaudo, el valor del servicio, quién fue el mensajero que lo hizo
y la transferencia.

En este mismo archivo tengo la liquidación de los mensajeros. Acá es donde pego la
información para compartírsela a ellos: ese fue el cuadro de conciliación de
mensajeros que le mostré; el cuadro de la relación de los clientes, que es el que
le comparto al cliente para realizar la relación; y la nómina de ellos.

La nómina va también con la fecha y la cantidad de servicios que hizo cada uno.
«Préstamos» son dineros que ellos pidieron durante la semana como anticipo: se los
cruzo y les pago el total. Eso es básicamente lo que hago manual.

**[02:18] Entrevistador**

Bien, ese es el archivo madre.

**[02:20] Responsable del negocio**

Sí, ese es el archivo madre.

---

## Anexo A — Decisiones sobre pasajes discutidos

Puntos en los que las transcripciones no coincidían y cómo se resolvieron.

| Tiempo | Lectura adoptada | Motivo |
| --- | --- | --- |
| 1 · 00:28 | «los digita en una **planilla**» | Qwen y el audio 2 usan *planilla*; OpenAI leyó *plantilla*. El audio 2 confirma el término («la planilla que hace John»). |
| 1 · 01:17 | «los paquetes que el **coordinador** le asigne» | Descartado «que John», que fue un falso positivo del hotword. |
| 1 · 01:22 | «varios puntos de **recogida**» | Confirmado por la verificación contra audio; una pasada anterior leyó *recaudo*. |
| 1 · 03:27 | «ahí finaliza **cada entrega**» | Qwen y verificación por audio; OpenAI leyó *finalizamos una entrega*. |
| 1 · 04:56 | «al final **con base en eso** le pago» | Ambas pasadas de Qwen produjeron ruido aquí; OpenAI y la verificación coinciden. |
| 1 · 07:20 | «y **le consigno** la diferencia» | Qwen produjo ruido; OpenAI y la verificación coinciden. |
| 2 · 00:00 | «…para **volver y saber** qué mensajero lo hizo» | Reconstrucción a partir de tres lecturas divergentes. El audio empieza con la frase ya iniciada. |
| 2 · 00:56 | «ya le mandé la **conciliación**» | OpenAI y Whisper; Qwen leyó *consignación*, que no encaja con el sentido. |
| 2 · 02:18 | «ese es el **archivo madre**» | La verificación contra audio lo da con seguridad alta, y coincide con el término que el hablante usa en el audio 1. OpenAI leyó *archivo manual*. |

**Pendiente de confirmar con el entrevistado:**

- **Las cifras del ejemplo de liquidación** (minuto 5:36 del audio 1): «se ganó
  ciento veinticuatro mil, recaudó ochocientos treinta y seis». La segunda cifra
  se escucha sin la unidad de mil, y las cuatro fuentes la transcriben igual, así
  que se dejó tal cual. Conviene verificar si son 836 u 836.000.
- **El término «fechado»** en la nómina (audio 2). Se interpretó como la fecha del
  período liquidado.

---

## Anexo B — Fragmento apartado

Entre los minutos 6:25 y 6:43 del audio 1 se cruza una conversación con una
tercera persona, ajena al tema de la entrevista: un intercambio sobre el envío de
un archivo por teléfono («¿usted ya no vuelve?», «cuando llegue se lo mando»). Se
apartó del cuerpo del documento por no aportar información sobre la operación. La
frase del responsable que quedó cortada por esa interrupción («…ya tengo un
archivo como…») se reconstruyó y se unió con su continuación.

---

## Anexo C — Procesos manuales identificados

Extraído del contenido de la entrevista. No es transcripción: es un índice de
trabajo derivado de ella.

1. **Recepción de pedidos.** Los clientes escriben por WhatsApp; el coordinador
   logístico transcribe cada pedido a una planilla.
2. **Armado y asignación de rutas.** El coordinador agrupa los servicios en rutas
   de ocho o nueve, según destinos y mensajeros disponibles.
3. **Evidencia de entrega.** El mensajero envía foto al entregar; el coordinador
   la recibe y avisa al cliente.
4. **Conciliación diaria con el mensajero.** Servicios realizados, recaudo del día
   y descuentos por pagos que el mensajero asumió (transportadoras, paquetes).
5. **Liquidación y nómina.** Semanal, o diaria para algunos mensajeros, con
   descuento de préstamos y anticipos.
6. **Relación al cliente.** Cuadro con destino, recaudo, valor por servicio y
   trazabilidad, que se envía a cada cliente.
7. **Control de cartera.** Estados *pendiente al cliente*, *servicios*,
   *cancelado* y *esperando pago* sobre el archivo madre.
8. **Consignación y transferencia.** El recaudo se consigna y se transfiere al
   cliente, descontando el valor de los servicios.

**Necesidad declarada explícitamente por el responsable:** que tanto su cliente
como el destinatario final puedan saber que el pedido está coordinado y en ruta,
sin depender de que el coordinador tenga tiempo de avisar. Hoy esa información
queda únicamente en poder de la empresa.
