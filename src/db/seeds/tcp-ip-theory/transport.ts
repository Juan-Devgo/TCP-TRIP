import {
  PRESENTATION_SCHEMA_VERSION,
  type PresentationDocument,
} from "@/lib/presentations/contract";

import {
  BODY_TOP,
  CONTENT_WIDTH,
  MARGIN,
  STAGE,
  arrow,
  box,
  bullets,
  contentSlide,
  fieldRow,
  table,
  text,
  titleSlide,
} from "./slides";

const DECK = "TCP/IP · Capa de transporte";

const MARKDOWN = `> **Objetivo de la sesión:** entender cómo los datos llegan al *programa* correcto dentro de un host, y las dos formas de hacerlo: UDP, simple y rápido, y TCP, fiable y ordenado. Veremos puertos, cabeceras, el *three-way handshake*, los números de secuencia y el control de flujo y de congestión.

## 1. De host a host… y de proceso a proceso

La capa de Internet entrega paquetes a un **host**. Pero en un computador corren a la vez un navegador, un cliente de correo, una videollamada… La capa de transporte entrega los datos al **proceso** correcto, y lo hace con **puertos**.

- Un **puerto** es un número de **16 bits** (0 – 65 535) que identifica un punto de comunicación dentro de un host.
- La combinación **(IP, puerto)** se llama **socket**.
- Una conexión TCP queda identificada por la **5-tupla**: protocolo, IP origen, puerto origen, IP destino, puerto destino.

Llevar los datos de varios procesos por la misma IP se llama **multiplexación**; repartir en el receptor lo que llega a cada proceso según el puerto de destino es la **demultiplexación**.

### Rangos de puertos (RFC 6335)

| Rango | Nombre | Ejemplos |
| --- | --- | --- |
| 0 – 1023 | Puertos del sistema (*bien conocidos*) | 22 SSH, 53 DNS, 80 HTTP, 443 HTTPS |
| 1024 – 49 151 | Puertos registrados | 3306 MySQL, 5432 PostgreSQL |
| 49 152 – 65 535 | Dinámicos o privados (efímeros) | Los que el sistema asigna al cliente |

Cuando tu navegador abre una página, el **servidor** escucha en el 443 y tu **cliente** usa un puerto efímero cualquiera (por ejemplo, 51 734).

## 2. UDP: lo mínimo

**UDP** (*User Datagram Protocol*, **RFC 768**) añade a IP apenas lo necesario para llegar al proceso: puertos y un checksum. Su cabecera mide **8 bytes**:

| Campo | Bits | Descripción |
| --- | --- | --- |
| Puerto origen | 16 | Puerto del emisor (opcional, 0 si no se espera respuesta). |
| Puerto destino | 16 | Puerto del proceso receptor. |
| Longitud | 16 | Cabecera + datos, en bytes (mínimo 8). |
| Checksum | 16 | Sobre cabecera, datos y una *pseudo-cabecera* IP. Opcional en IPv4, obligatorio en IPv6. |

UDP **no** establece conexión, **no** confirma la entrega, **no** reordena y **no** controla la velocidad. Eso, que parece un defecto, es justo lo que necesitan:

- **DNS**: una pregunta y una respuesta; si se pierde, se repite.
- **Voz y video en tiempo real**: un paquete que llega tarde ya no sirve; mejor perderlo que esperarlo.
- **DHCP**: el cliente todavía no tiene IP para mantener una conexión.
- **QUIC** (RFC 9000), la base de HTTP/3: implementa su propia fiabilidad *encima* de UDP.

## 3. TCP: fiable, ordenado y orientado a conexión

**TCP** (*Transmission Control Protocol*, hoy **RFC 9293**, que reemplazó al RFC 793) ofrece a la aplicación un **flujo de bytes fiable y ordenado** sobre una red que pierde y desordena paquetes. Para lograrlo:

| Mecanismo | Qué resuelve |
| --- | --- |
| Conexión (*handshake*) | Ambos extremos acuerdan números de secuencia iniciales antes de enviar datos. |
| Números de secuencia | Numeran cada **byte**: permiten reordenar y detectar huecos. |
| Confirmaciones (ACK) | El receptor indica el siguiente byte que espera. |
| Retransmisión | Lo que no se confirma a tiempo se vuelve a enviar (temporizador RTO, RFC 6298). |
| Control de flujo | El receptor anuncia cuánto puede recibir (*ventana*). |
| Control de congestión | El emisor reduce su velocidad cuando la red se satura (RFC 5681). |

### La cabecera TCP

Mide **20 bytes** sin opciones (hasta 60):

| Campo | Bits | Descripción |
| --- | --- | --- |
| Puerto origen / destino | 16 + 16 | Igual que en UDP. |
| Número de secuencia | 32 | Posición del primer byte de datos de este segmento. |
| Número de confirmación | 32 | Siguiente byte que se espera recibir (válido si ACK = 1). |
| Data offset | 4 | Longitud de la cabecera en palabras de 32 bits. |
| Reservado | 4 | En cero. |
| Flags | 8 | CWR, ECE, URG, **ACK**, PSH, **RST**, **SYN**, **FIN**. |
| Ventana | 16 | Bytes que el receptor está dispuesto a aceptar. |
| Checksum | 16 | Sobre cabecera, datos y pseudo-cabecera IP. |
| Puntero urgente | 16 | Casi en desuso. |
| Opciones | variable | MSS, escala de ventana (RFC 7323), SACK, marcas de tiempo… |

| Flag | Significado |
| --- | --- |
| SYN | Sincronizar números de secuencia: abre una conexión. |
| ACK | El campo de confirmación es válido. |
| FIN | El emisor no enviará más datos: cierre ordenado. |
| RST | Abortar la conexión de inmediato. |
| PSH | Entregar a la aplicación sin esperar a llenar el búfer. |

## 4. El *three-way handshake*

Antes de enviar datos, cliente y servidor intercambian tres segmentos:

\`\`\`plaintext
Cliente                                         Servidor (escucha en el 443)
   │ ── SYN        seq=1000 ───────────────────────▶ │
   │ ◀─ SYN, ACK   seq=5000  ack=1001 ────────────── │
   │ ── ACK        seq=1001  ack=5001 ─────────────▶ │
   │            conexión ESTABLISHED                 │
\`\`\`

- Cada extremo elige su **número de secuencia inicial** (ISN) al azar, por seguridad.
- El SYN "consume" un número de secuencia: por eso se confirma \`1000 + 1 = 1001\`.

### Secuencia y confirmación en acción

Si el cliente envía 500 bytes empezando en \`seq=1001\`, el servidor responde \`ack=1501\`: "recibí hasta el byte 1500, espero el 1501". Si un segmento se pierde, el receptor sigue pidiendo el mismo número; **tres ACK duplicados** hacen que el emisor retransmita sin esperar al temporizador (*fast retransmit*).

### Cierre de la conexión

El cierre ordenado usa **FIN** en cada dirección (cuatro segmentos: FIN, ACK, FIN, ACK). Quien cierra primero espera en **TIME-WAIT** durante 2 × MSL para que no se confundan segmentos viejos con una conexión nueva. Un **RST** corta la conexión de golpe.

## 5. Control de flujo y de congestión

Son dos problemas distintos:

- **Control de flujo** — no saturar al **receptor**. El receptor anuncia su ventana (\`rwnd\`) en cada segmento; el emisor nunca tiene más bytes sin confirmar que esa ventana.
- **Control de congestión** — no saturar la **red**. El emisor mantiene una ventana de congestión (\`cwnd\`) que ajusta según las pérdidas.

El emisor puede tener en vuelo como máximo **min(cwnd, rwnd)** bytes.

El algoritmo clásico (RFC 5681):

| Fase | Comportamiento de \`cwnd\` |
| --- | --- |
| **Arranque lento** (*slow start*) | Empieza pequeña y se **duplica** cada RTT hasta llegar a \`ssthresh\`. |
| **Evitar congestión** | Crece **1 MSS por RTT** (crecimiento lineal). |
| **Pérdida por 3 ACK duplicados** | \`ssthresh = cwnd / 2\`; retransmisión rápida y recuperación rápida. |
| **Pérdida por temporizador** | \`cwnd\` vuelve a 1 MSS y se reinicia el arranque lento. |

> [!NOTE]
> El **MSS** (*Maximum Segment Size*) es el máximo de datos por segmento. Sobre Ethernet: 1500 − 20 (IP) − 20 (TCP) = **1460 bytes**. Así TCP evita que IP tenga que fragmentar.

## 6. TCP frente a UDP

| | TCP | UDP |
| --- | --- | --- |
| Conexión | Sí (handshake) | No |
| Entrega garantizada | Sí | No |
| Orden | Sí | No |
| Control de flujo y congestión | Sí | No |
| Cabecera | 20 – 60 bytes | 8 bytes |
| Unidad | Flujo de bytes (segmentos) | Mensajes independientes (datagramas) |
| Usos | Web, correo, SSH, transferencia de archivos | DNS, DHCP, VoIP, juegos, QUIC |

## 7. Preguntas de repaso

1. ¿Por qué hacen falta los puertos si ya tenemos direcciones IP?
2. Un servidor DNS recibe una consulta desde \`192.0.2.7:53124\`. ¿A qué socket envía la respuesta?
3. Completa un handshake con ISN del cliente = 7000 e ISN del servidor = 300.
4. El emisor envía tres segmentos de 1000 bytes empezando en \`seq=1\`. Se pierde el segundo. ¿Qué ACK envía el receptor tras recibir el tercero?
5. Explica la diferencia entre control de flujo y control de congestión.
6. ¿Por qué una videollamada prefiere UDP?
`;

export function transportDocument(): PresentationDocument {
  const slides = [
    titleSlide({
      kicker: "Unidad 4 · Capa 3 de TCP/IP",
      title: "Capa de transporte",
      subtitle: "Puertos, UDP y TCP: cómo los datos llegan al programa correcto, completos y en orden.",
      notes:
        "Pregunta inicial: tengo Spotify, el navegador y WhatsApp abiertos con una sola IP. ¿Cómo sabe el sistema a quién le toca cada paquete?",
      figure: [
        ...box(1340, 300, 440, 110, "TCP", "primary", { size: 48, strokeWidth: 7 }),
        ...box(1340, 450, 440, 110, "UDP", "secondary", { size: 48, strokeWidth: 7 }),
        ...box(1340, 640, 440, 110, "IP", "quaternary", { size: 48, strokeWidth: 7 }),
        arrow(1450, 560, 1450, 640, { strokeWidth: 5 }),
        arrow(1670, 560, 1670, 640, { strokeWidth: 5 }),
      ],
    }),

    contentSlide(DECK, {
      title: "Puertos: de host a proceso",
      notes:
        "Socket = (IP, puerto). La 5-tupla identifica una conexión TCP. Demultiplexar = mirar el puerto de destino.",
      body: [
        ...box(MARGIN, BODY_TOP + 420, 1680, 120, "IP 192.168.1.10", "quaternary", { size: 40, strokeWidth: 7 }),
        ...box(MARGIN, BODY_TOP + 40, 480, 160, "Navegador\n:51734", "secondary", { size: 36, mono: true }),
        ...box(MARGIN + 600, BODY_TOP + 40, 480, 160, "Servidor web\n:443", "primary", { size: 36, mono: true }),
        ...box(MARGIN + 1200, BODY_TOP + 40, 480, 160, "Cliente DNS\n:53124", "secondary", { size: 36, mono: true }),
        arrow(MARGIN + 240, BODY_TOP + 420, MARGIN + 240, BODY_TOP + 200),
        arrow(MARGIN + 840, BODY_TOP + 420, MARGIN + 840, BODY_TOP + 200),
        arrow(MARGIN + 1440, BODY_TOP + 420, MARGIN + 1440, BODY_TOP + 200),
        text(MARGIN, BODY_TOP + 560, 1680, 50, "demultiplexación por puerto de destino", {
          size: 32,
          align: "center",
          color: "muted-foreground",
        }),
        text(MARGIN, BODY_TOP + 660, 1680, 60, "Socket = (IP, puerto)   ·   Conexión = (proto, IP₁, puerto₁, IP₂, puerto₂)", {
          size: 36,
          align: "center",
          mono: true,
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Rangos de puertos (RFC 6335)",
      notes: "El cliente casi siempre usa un puerto efímero; el servidor, uno bien conocido.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          420,
          [
            ["Rango", "Nombre", "Ejemplos"],
            ["0 – 1023", "Sistema (bien conocidos)", "22 · 53 · 80 · 443"],
            ["1024 – 49151", "Registrados", "3306 · 5432"],
            ["49152 – 65535", "Dinámicos (efímeros)", "51734"],
          ],
          { size: 36 },
        ),
        text(MARGIN, BODY_TOP + 520, CONTENT_WIDTH, 60, "16 bits  →  2¹⁶ = 65 536 puertos por protocolo", {
          size: 40,
          align: "center",
          mono: true,
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "UDP: una cabecera de 8 bytes (RFC 768)",
      notes:
        "Mostrar que UDP solo agrega puertos y checksum a IP. Usos: DNS, DHCP, VoIP, QUIC. El checksum es opcional en IPv4 y obligatorio en IPv6.",
      body: [
        text(MARGIN, BODY_TOP + 10, 200, 40, "0", { size: 26, mono: true, color: "muted-foreground" }),
        text(MARGIN + CONTENT_WIDTH - 200, BODY_TOP + 10, 200, 40, "31", {
          size: 26,
          mono: true,
          color: "muted-foreground",
          align: "right",
        }),
        ...fieldRow(MARGIN, BODY_TOP + 55, CONTENT_WIDTH, 110, 32, [
          ["Puerto origen", 16, "secondary"],
          ["Puerto destino", 16, "secondary"],
        ], { size: 34 }),
        ...fieldRow(MARGIN, BODY_TOP + 165, CONTENT_WIDTH, 110, 32, [
          ["Longitud", 16],
          ["Checksum", 16, "primary"],
        ], { size: 34 }),
        ...fieldRow(MARGIN, BODY_TOP + 275, CONTENT_WIDTH, 110, 32, [["Datos", 32, "quaternary"]], { size: 34 }),
        bullets(MARGIN, BODY_TOP + 450, CONTENT_WIDTH, [
          "Sin conexión, sin confirmaciones, sin orden: mínimo retardo.",
          "Ideal para DNS, DHCP, voz/video en tiempo real y QUIC.",
        ], { size: 38, gap: false }),
      ],
    }),

    contentSlide(DECK, {
      title: "La cabecera TCP (RFC 9293 §3.1)",
      notes:
        "Comparar con UDP: secuencia, confirmación, flags y ventana son lo que hace a TCP fiable. 20 bytes mínimo.",
      body: (() => {
        const rowHeight = 112;
        const top = BODY_TOP + 10;
        const rows = [
          [["Puerto origen", 16, "secondary"], ["Puerto destino", 16, "secondary"]],
          [["Número de secuencia", 32, "primary"]],
          [["Número de confirmación", 32, "primary"]],
          [["Offset", 4], ["Res.", 4], ["Flags", 8, "quaternary"], ["Ventana", 16, "quaternary"]],
          [["Checksum", 16], ["Puntero urgente", 16]],
          [["Opciones (si offset > 5)", 32]],
        ] as const;

        return [
          text(MARGIN, top, 200, 40, "0", { size: 26, mono: true, color: "muted-foreground" }),
          text(MARGIN + CONTENT_WIDTH - 200, top, 200, 40, "31", {
            size: 26,
            mono: true,
            color: "muted-foreground",
            align: "right",
          }),
          ...rows.flatMap((row, index) =>
            fieldRow(MARGIN, top + 45 + index * rowHeight, CONTENT_WIDTH, rowHeight - 10, 32, row, { size: 30 }),
          ),
        ];
      })(),
    }),

    contentSlide(DECK, {
      title: "Los flags de TCP",
      notes: "SYN abre, FIN cierra ordenadamente, RST aborta. ACK está activo en casi todos los segmentos tras el primero.",
      body: [
        ...fieldRow(MARGIN, BODY_TOP + 30, CONTENT_WIDTH, 110, 8, [
          ["CWR", 1],
          ["ECE", 1],
          ["URG", 1],
          ["ACK", 1, "primary"],
          ["PSH", 1],
          ["RST", 1, "secondary"],
          ["SYN", 1, "primary"],
          ["FIN", 1, "secondary"],
        ], { size: 34 }),
        table(
          MARGIN,
          BODY_TOP + 200,
          CONTENT_WIDTH,
          460,
          [
            ["Flag", "Significado"],
            ["SYN", "Sincroniza números de secuencia: abre la conexión"],
            ["ACK", "El número de confirmación es válido"],
            ["FIN", "No enviaré más datos: cierre ordenado"],
            ["RST", "Aborta la conexión de inmediato"],
            ["PSH", "Entrega a la aplicación sin esperar"],
          ],
          { size: 34 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "El three-way handshake",
      notes:
        "Dos estudiantes representan cliente y servidor. El SYN consume un número de secuencia: por eso ack = ISN + 1. ISN aleatorio por seguridad.",
      body: (() => {
        const left = MARGIN + 260;
        const right = 1540;
        return [
          ...box(left - 200, BODY_TOP + 10, 400, 110, "Cliente", "secondary", { size: 40 }),
          ...box(right - 200, BODY_TOP + 10, 400, 110, "Servidor :443", "primary", { size: 40 }),
          arrow(left, BODY_TOP + 120, left, BODY_TOP + 720, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
          arrow(right, BODY_TOP + 120, right, BODY_TOP + 720, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
          arrow(left, BODY_TOP + 200, right, BODY_TOP + 290, { stroke: "secondary" }),
          text(left + 120, BODY_TOP + 150, right - left - 240, 50, "SYN  seq=1000", { size: 36, mono: true, align: "center" }),
          arrow(right, BODY_TOP + 370, left, BODY_TOP + 460, { stroke: "primary" }),
          text(left + 120, BODY_TOP + 320, right - left - 240, 50, "SYN, ACK  seq=5000  ack=1001", { size: 36, mono: true, align: "center" }),
          arrow(left, BODY_TOP + 540, right, BODY_TOP + 630, { stroke: "secondary" }),
          text(left + 120, BODY_TOP + 490, right - left - 240, 50, "ACK  seq=1001  ack=5001", { size: 36, mono: true, align: "center" }),
          text(MARGIN, BODY_TOP + 700, CONTENT_WIDTH, 50, "ESTABLISHED", { size: 36, weight: 700, align: "center", mono: true }),
        ];
      })(),
    }),

    contentSlide(DECK, {
      title: "Secuencia, confirmación y retransmisión",
      notes:
        "Los números cuentan BYTES, no segmentos. El ACK es acumulativo: 'espero el byte N'. Tres ACK duplicados = fast retransmit.",
      body: [
        ...fieldRow(MARGIN, BODY_TOP + 40, CONTENT_WIDTH, 120, 3, [
          ["seq=1 · 1000 B", 1, "primary"],
          ["seq=1001 · perdido", 1, "secondary"],
          ["seq=2001 · 1000 B", 1, "primary"],
        ], { size: 34 }),
        table(
          MARGIN,
          BODY_TOP + 230,
          CONTENT_WIDTH,
          360,
          [
            ["El receptor recibe", "Responde"],
            ["bytes 1 – 1000", "ack=1001"],
            ["bytes 2001 – 3000 (hueco)", "ack=1001  (duplicado)"],
            ["… 3 ACK duplicados", "el emisor retransmite seq=1001"],
          ],
          { size: 34, mono: true },
        ),
        text(MARGIN, BODY_TOP + 640, CONTENT_WIDTH, 60, "Sin ACK antes del RTO → retransmisión por temporizador (RFC 6298)", {
          size: 32,
          align: "center",
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Control de flujo y de congestión",
      notes:
        "rwnd protege al receptor; cwnd protege a la red. Se envía min(cwnd, rwnd). Dibujar la curva diente de sierra de cwnd en el tablero.",
      body: [
        ...box(MARGIN, BODY_TOP + 30, 820, 220, "Control de flujo\n\nrwnd · protege al receptor", "secondary", { size: 36 }),
        ...box(MARGIN + 860, BODY_TOP + 30, 820, 220, "Control de congestión\n\ncwnd · protege a la red", "primary", { size: 36 }),
        table(
          MARGIN,
          BODY_TOP + 300,
          CONTENT_WIDTH,
          340,
          [
            ["Fase (RFC 5681)", "cwnd"],
            ["Arranque lento", "se duplica cada RTT"],
            ["Evitar congestión", "+1 MSS por RTT"],
            ["3 ACK duplicados", "ssthresh = cwnd / 2"],
            ["Expira el RTO", "vuelve a 1 MSS"],
          ],
          { size: 32 },
        ),
        text(MARGIN, BODY_TOP + 680, CONTENT_WIDTH, 60, "En vuelo ≤ min(cwnd, rwnd)   ·   MSS en Ethernet = 1460 B", {
          size: 34,
          align: "center",
          mono: true,
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "TCP frente a UDP",
      notes: "Pedir que clasifiquen: Netflix, Zoom, DNS, SSH, un juego en línea, descarga de un archivo.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          620,
          [
            ["", "TCP", "UDP"],
            ["Conexión", "Sí", "No"],
            ["Entrega y orden", "Garantizados", "No"],
            ["Flujo y congestión", "Sí", "No"],
            ["Cabecera", "20 – 60 B", "8 B"],
            ["Unidad", "Flujo de bytes", "Datagramas"],
            ["Usos", "Web, correo, SSH", "DNS, VoIP, QUIC"],
          ],
          { size: 34 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Para llevar",
      notes: "Puente: ya llegamos al proceso. ¿Qué se dicen los procesos? → capa de aplicación.",
      body: [
        bullets(MARGIN, BODY_TOP + 20, 1150, [
          "Los puertos llevan los datos al proceso correcto.",
          "UDP: 8 bytes, sin garantías, mínimo retardo.",
          "TCP: handshake, secuencia por byte, ACK, retransmisión.",
          "rwnd cuida al receptor; cwnd cuida a la red.",
        ]),
        text(1400, BODY_TOP + 20, 400, 50, "Siguiente", { size: 34, color: "muted-foreground" }),
        text(1400, BODY_TOP + 80, 400, 200, "Capa de\naplicación", { size: 52, weight: 700 }),
      ],
    }),
  ];

  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "Capa de transporte",
    topic: "transport-layer",
    mode: "markdown",
    markdown: MARKDOWN,
    notes:
      "Laboratorio: capturar en Wireshark la apertura de una página y usar 'Follow TCP Stream'. Identificar el handshake, los números relativos de secuencia y el cierre con FIN. Comparar con una consulta DNS (UDP).",
    canvas: { ...STAGE },
    slides,
  };
}
