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

const DECK = "TCP/IP · Capa de acceso a la red";

const MARKDOWN = `> **Objetivo de la sesión:** entender cómo se mueven los datos *dentro de una misma red local*: qué es una trama Ethernet, qué es una dirección MAC, cómo aprende un switch y cómo ARP traduce direcciones IP a direcciones MAC.

## 1. ¿Qué hace esta capa?

La capa de acceso a la red (también llamada *capa de enlace* o *capa de interfaz de red*) es la más cercana al hardware. Su alcance es **un solo enlace**: lleva datos de una interfaz a otra que esté conectada al mismo medio (el mismo cable, el mismo switch, el mismo punto de acceso Wi-Fi). Cruzar de una red a otra es trabajo de la capa de Internet.

Sus funciones principales son:

| Función | En qué consiste |
| --- | --- |
| **Enmarcado** | Delimitar dónde empieza y termina cada bloque de datos (la *trama*). |
| **Direccionamiento físico** | Identificar el emisor y el receptor dentro del enlace mediante direcciones MAC. |
| **Control de acceso al medio** | Decidir quién transmite cuando varios comparten el medio (CSMA/CD, CSMA/CA). |
| **Detección de errores** | Comprobar si la trama llegó dañada (FCS con CRC-32) y descartarla si es así. |

Debajo está la **capa física**, que convierte bits en señales eléctricas, ópticas o de radio. El modelo TCP/IP la incluye dentro de esta misma capa.

## 2. La trama Ethernet II

Ethernet (IEEE 802.3) es la tecnología de red local cableada dominante. Casi todo el tráfico IP en una LAN viaja en tramas con formato **Ethernet II** (también llamado *DIX*):

| Campo | Tamaño | Descripción |
| --- | --- | --- |
| Preámbulo | 7 bytes | \`10101010\` repetido: sincroniza los relojes del receptor. |
| SFD | 1 byte | \`10101011\`: marca el inicio de la trama. |
| MAC destino | 6 bytes | A quién va dirigida la trama. |
| MAC origen | 6 bytes | Quién la envía. |
| EtherType | 2 bytes | Qué protocolo va dentro (\`0x0800\` = IPv4). |
| Datos | 46 – 1500 bytes | El paquete de la capa superior. Se rellena (*padding*) si es menor de 46. |
| FCS | 4 bytes | CRC-32 calculado sobre la trama: detecta errores. |

> [!NOTE]
> El preámbulo y el SFD los genera y consume la tarjeta de red; por eso Wireshark no los muestra. La **cabecera** que sí ves ocupa 14 bytes (6 + 6 + 2), más los 4 del FCS al final.

### Valores comunes de EtherType

| EtherType | Protocolo |
| --- | --- |
| \`0x0800\` | IPv4 |
| \`0x0806\` | ARP |
| \`0x86DD\` | IPv6 |
| \`0x8100\` | Etiqueta VLAN IEEE 802.1Q |

### Tamaños mínimo y máximo

- **MTU = 1500 bytes**: el máximo de datos que cabe en una trama Ethernet estándar. Es el número que la capa de Internet debe respetar (y la razón por la que existe la fragmentación IP).
- **Trama mínima = 64 bytes** (de MAC destino a FCS). Viene de la época del medio compartido: una estación debía seguir transmitiendo mientras la señal recorría el cable de ida y vuelta, para poder detectar una colisión (CSMA/CD, *slot time* de 512 tiempos de bit). Por eso los datos se rellenan hasta 46 bytes: 46 + 14 + 4 = 64.

## 3. Direcciones MAC

Una dirección MAC tiene **48 bits** y se escribe en hexadecimal: \`3C:52:82:1A:9F:04\`.

- Los primeros 24 bits son el **OUI** (*Organizationally Unique Identifier*), asignado por el IEEE al fabricante.
- Los últimos 24 bits los asigna el fabricante a cada interfaz.
- El bit menos significativo del primer byte es el bit **I/G**: \`0\` = individual (unicast), \`1\` = grupo (multicast).
- El siguiente bit es **U/L**: \`0\` = asignada por el fabricante, \`1\` = administrada localmente (los teléfonos modernos usan MAC aleatorias con este bit en 1).
- \`FF:FF:FF:FF:FF:FF\` es la dirección de **difusión** (*broadcast*): la reciben todas las interfaces del enlace.

> [!TIP]
> Usa el conversor de bases de TCP-TRIP para pasar el primer byte de una MAC a binario y comprobar los bits I/G y U/L. Por ejemplo, \`3C\` = \`0011 1100\`: unicast y asignada por el fabricante.

## 4. ¿Cómo aprende un switch?

Un switch reenvía tramas usando una **tabla MAC** que construye solo, observando el tráfico:

1. **Aprende:** cuando llega una trama por el puerto *p*, anota "la MAC origen está en el puerto *p*".
2. **Reenvía:** si la MAC destino está en la tabla, envía la trama solo por ese puerto.
3. **Inunda:** si la MAC destino no está en la tabla (o es broadcast), envía la trama por todos los puertos excepto por el que llegó.
4. **Olvida:** las entradas caducan tras un tiempo sin tráfico (300 s es un valor típico).

Con switches y enlaces *full duplex* ya no hay colisiones: cada puerto es su propio dominio de colisión. Lo que sí se comparte es el **dominio de difusión**: un broadcast llega a todos los equipos de la red local (o de la VLAN).

## 5. ARP: de IP a MAC

Para enviar un paquete IP a otro equipo de la misma red, el emisor necesita su dirección MAC. El protocolo **ARP** (*Address Resolution Protocol*, **RFC 826**) la averigua:

\`\`\`plaintext
A (192.168.1.10, MAC AA:AA:AA:AA:AA:AA) quiere hablar con 192.168.1.20

1. A → FF:FF:FF:FF:FF:FF   ARP Request: "¿Quién tiene 192.168.1.20? Responde a 192.168.1.10"
2. B → AA:AA:AA:AA:AA:AA   ARP Reply:   "192.168.1.20 está en BB:BB:BB:BB:BB:BB"
3. A guarda la respuesta en su caché ARP y envía el paquete IP en una trama dirigida a B.
\`\`\`

- La **petición es broadcast**; la **respuesta es unicast**.
- Las respuestas se guardan en la **caché ARP** durante un tiempo (puedes verla con \`ip neigh\` en Linux o \`arp -a\` en Windows).
- Si el destino está **en otra red**, A no pregunta por la MAC del destino sino por la de su **puerta de enlace** (*gateway*): la trama va al router, y el router se encarga del siguiente salto.

> [!WARNING]
> ARP no tiene autenticación: cualquier equipo puede responder. Esa es la base del ataque *ARP spoofing*. IPv6 reemplaza ARP por NDP (RFC 4861).

## 6. Otras tecnologías del enlace

- **Wi-Fi (IEEE 802.11):** en el aire no se pueden detectar colisiones mientras se transmite, así que se **evitan** (CSMA/CA) con esperas aleatorias y confirmaciones.
- **VLAN (IEEE 802.1Q):** inserta una etiqueta de 4 bytes en la trama para dividir un switch en varias redes lógicas. Cada VLAN es un dominio de difusión distinto.

## 7. Preguntas de repaso

1. ¿Cuál es el tamaño mínimo y máximo de una trama Ethernet, y de dónde sale cada uno?
2. ¿Qué indica el EtherType \`0x0806\`?
3. La MAC \`01:00:5E:00:00:FB\`, ¿es unicast o multicast? Justifica con el bit I/G.
4. Un switch recién encendido recibe una trama de A hacia B. Describe qué hace y qué anota en su tabla.
5. ¿Por qué la petición ARP se envía por broadcast y la respuesta no?
6. Si el destino está en otra red, ¿por qué dirección MAC pregunta el emisor?
`;

export function linkDocument(): PresentationDocument {
  const slides = [
    titleSlide({
      kicker: "Unidad 2 · Capa 1 de TCP/IP",
      title: "Capa de acceso a la red",
      subtitle: "Tramas, direcciones MAC, switches y ARP: cómo se mueven los datos dentro de una LAN.",
      notes:
        "Traer un cable UTP y un switch pequeño si es posible. Pregunta inicial: ¿cómo sabe el switch por qué puerto enviar algo?",
      figure: [
        ...box(1340, 330, 440, 120, "Switch", "tertiary", { size: 44, strokeWidth: 7 }),
        ...box(1300, 640, 150, 100, "A", "foreground", { size: 40 }),
        ...box(1485, 640, 150, 100, "B", "foreground", { size: 40 }),
        ...box(1670, 640, 150, 100, "C", "foreground", { size: 40 }),
        arrow(1375, 450, 1375, 640, { kind: "line", stroke: "muted-foreground" }),
        arrow(1560, 450, 1560, 640, { kind: "line", stroke: "muted-foreground" }),
        arrow(1745, 450, 1745, 640, { kind: "line", stroke: "muted-foreground" }),
      ],
    }),

    contentSlide(DECK, {
      title: "¿Qué hace esta capa?",
      notes:
        "Remarcar el alcance: UN enlace. Lo que cruza redes es IP. La capa física queda dentro de esta capa en TCP/IP.",
      body: [
        ...box(MARGIN, BODY_TOP + 30, 820, 300, "Enmarcado\n\nDónde empieza y\ntermina cada trama", "tertiary", {
          size: 36,
          weight: 600,
        }),
        ...box(MARGIN + 860, BODY_TOP + 30, 820, 300, "Direccionamiento\n\nMAC de origen\ny de destino", "secondary", {
          size: 36,
        }),
        ...box(MARGIN, BODY_TOP + 370, 820, 300, "Acceso al medio\n\nQuién transmite:\nCSMA/CD, CSMA/CA", "primary", {
          size: 36,
        }),
        ...box(MARGIN + 860, BODY_TOP + 370, 820, 300, "Detección de errores\n\nFCS con CRC-32:\nse descarta, no se corrige", "quaternary", {
          size: 36,
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "La trama Ethernet II",
      notes:
        "Abrir una captura en Wireshark: la cabecera visible son 14 bytes. Preámbulo y SFD no aparecen porque los consume la tarjeta.",
      body: [
        ...fieldRow(MARGIN, BODY_TOP + 80, CONTENT_WIDTH, 150, 34, [
          ["Preámbulo\n7", 4],
          ["SFD\n1", 2],
          ["MAC destino\n6", 5, "secondary"],
          ["MAC origen\n6", 5, "secondary"],
          ["Tipo\n2", 3, "primary"],
          ["Datos\n46 – 1500", 11, "quaternary"],
          ["FCS\n4", 4, "tertiary"],
        ], { size: 28 }),
        text(MARGIN, BODY_TOP + 250, CONTENT_WIDTH, 40, "Tamaños en bytes · el ancho de cada caja es solo ilustrativo", {
          size: 26,
          color: "muted-foreground",
          align: "center",
        }),
        table(
          MARGIN + 240,
          BODY_TOP + 340,
          1200,
          380,
          [
            ["EtherType", "Protocolo"],
            ["0x0800", "IPv4"],
            ["0x0806", "ARP"],
            ["0x86DD", "IPv6"],
            ["0x8100", "VLAN 802.1Q"],
          ],
          { size: 34, mono: true },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "¿Por qué 64 y 1500 bytes?",
      notes:
        "64: CSMA/CD necesitaba que la trama durara al menos el viaje de ida y vuelta (512 tiempos de bit). 1500: MTU, el límite que IP tiene que respetar → fragmentación.",
      body: [
        text(MARGIN, BODY_TOP + 40, 780, 60, "Trama mínima", { size: 40, weight: 600 }),
        text(MARGIN, BODY_TOP + 110, 780, 130, "64 B", { size: 120, weight: 700, color: "primary" }),
        text(MARGIN, BODY_TOP + 270, 780, 60, "46 + 14 + 4 = 64", { size: 44, mono: true }),
        text(MARGIN, BODY_TOP + 360, 760, 220, "Detectar una colisión exigía seguir transmitiendo mientras la señal iba y volvía.", {
          size: 34,
          color: "muted-foreground",
        }),
        text(1000, BODY_TOP + 40, 800, 60, "MTU", { size: 40, weight: 600 }),
        text(1000, BODY_TOP + 110, 800, 130, "1500 B", { size: 120, weight: 700, color: "secondary" }),
        text(1000, BODY_TOP + 270, 800, 60, "datos por trama", { size: 44, mono: true }),
        text(1000, BODY_TOP + 360, 780, 220, "Un paquete IP más grande debe fragmentarse (unidad 3).", {
          size: 34,
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Anatomía de una dirección MAC",
      notes:
        "Usar el conversor de bases: 3C → 0011 1100. Último bit del primer byte = I/G, penúltimo = U/L. Mencionar las MAC aleatorias de los celulares.",
      body: [
        text(MARGIN, BODY_TOP + 40, CONTENT_WIDTH, 130, "3C:52:82 : 1A:9F:04", {
          size: 110,
          weight: 700,
          align: "center",
          mono: true,
        }),
        ...box(MARGIN + 160, BODY_TOP + 210, 660, 110, "OUI · 24 bits\nfabricante (IEEE)", "secondary", { size: 32 }),
        ...box(MARGIN + 860, BODY_TOP + 210, 660, 110, "24 bits\nasignados por el fabricante", "primary", { size: 32 }),
        table(
          MARGIN + 160,
          BODY_TOP + 390,
          1360,
          300,
          [
            ["Bit del primer byte", "0", "1"],
            ["I/G (bit 0)", "unicast", "multicast"],
            ["U/L (bit 1)", "del fabricante", "local / aleatoria"],
            ["FF:FF:FF:FF:FF:FF", "broadcast", "—"],
          ],
          { size: 32 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Un switch aprende mirando el origen",
      notes:
        "Simular en el tablero con tres estudiantes como hosts. Primera trama: inunda. Respuesta: ya conoce a ambos. Hablar de dominio de colisión vs. de difusión.",
      body: [
        ...box(MARGIN + 260, BODY_TOP + 20, 460, 120, "Switch", "tertiary", { size: 44, strokeWidth: 7 }),
        ...box(MARGIN + 20, BODY_TOP + 400, 260, 110, "A\nAA:AA…", "foreground", { size: 30 }),
        ...box(MARGIN + 360, BODY_TOP + 400, 260, 110, "B\nBB:BB…", "foreground", { size: 30 }),
        ...box(MARGIN + 700, BODY_TOP + 400, 260, 110, "C\nCC:CC…", "foreground", { size: 30 }),
        // One cable per port, from the bottom of the switch to each host.
        ...[150, 490, 830].flatMap((host, index) => {
          const port = MARGIN + 340 + index * 150;
          return [
            arrow(port, BODY_TOP + 140, MARGIN + host, BODY_TOP + 400, {
              kind: "line",
              stroke: "muted-foreground",
            }),
            text(port + 14 + (index - 1) * 26, BODY_TOP + 160, 30, 40, String(index + 1), {
              size: 30,
              mono: true,
              align: "center",
            }),
          ];
        }),
        table(
          1160,
          BODY_TOP + 20,
          640,
          230,
          [
            ["MAC", "Puerto"],
            ["AA:AA:AA:AA:AA:AA", "1"],
            ["BB:BB:BB:BB:BB:BB", "2"],
          ],
          { size: 28, mono: true },
        ),
        bullets(1160, BODY_TOP + 300, 640, [
          "Aprende la MAC origen.",
          "Destino conocido: un puerto.",
          "Desconocido: inunda.",
        ], { size: 32 }),
      ],
    }),

    contentSlide(DECK, {
      title: "ARP: ¿quién tiene esta IP?",
      notes:
        "Petición broadcast, respuesta unicast. Mostrar `ip neigh` / `arp -a`. Si el destino está fuera de la red, se pregunta por la MAC del gateway. Mencionar ARP spoofing.",
      body: [
        ...box(MARGIN, BODY_TOP + 20, 420, 130, "A\n192.168.1.10", "secondary", { size: 34 }),
        ...box(1380, BODY_TOP + 20, 420, 130, "B\n192.168.1.20", "primary", { size: 34 }),
        arrow(MARGIN + 210, BODY_TOP + 150, MARGIN + 210, BODY_TOP + 690, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        arrow(1590, BODY_TOP + 150, 1590, BODY_TOP + 690, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        arrow(MARGIN + 210, BODY_TOP + 270, 1590, BODY_TOP + 340, { stroke: "secondary" }),
        text(560, BODY_TOP + 200, 860, 50, "Request → FF:FF:FF:FF:FF:FF", { size: 32, mono: true, align: "center" }),
        text(560, BODY_TOP + 350, 860, 50, "¿Quién tiene 192.168.1.20?", { size: 32, align: "center", color: "muted-foreground" }),
        arrow(1590, BODY_TOP + 540, MARGIN + 210, BODY_TOP + 610, { stroke: "primary" }),
        text(560, BODY_TOP + 470, 860, 50, "Reply → AA:AA:AA:AA:AA:AA (unicast)", { size: 32, mono: true, align: "center" }),
        text(560, BODY_TOP + 620, 860, 50, "192.168.1.20 está en BB:BB:BB:BB:BB:BB", { size: 32, align: "center", color: "muted-foreground" }),
        text(MARGIN, BODY_TOP + 715, CONTENT_WIDTH, 50, "RFC 826 · la respuesta se guarda en la caché ARP", {
          size: 28,
          align: "center",
          color: "muted-foreground",
          mono: true,
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Para llevar",
      notes:
        "Dejar planteada la pregunta puente: si el destino está en otra red, ¿quién decide el camino? → capa de Internet.",
      body: [
        bullets(MARGIN, BODY_TOP + 20, 1100, [
          "La capa de acceso mueve tramas dentro de un enlace.",
          "Ethernet II: 14 B de cabecera, 4 B de FCS, MTU 1500.",
          "MAC de 48 bits: OUI + identificador; FF…FF es broadcast.",
          "El switch aprende orígenes; ARP traduce IP → MAC.",
        ]),
        text(1400, BODY_TOP + 20, 400, 50, "Siguiente", { size: 34, color: "muted-foreground" }),
        text(1400, BODY_TOP + 80, 400, 200, "Capa de\nInternet", { size: 52, weight: 700 }),
      ],
    }),
  ];

  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "Capa de acceso a la red",
    topic: "link-layer",
    mode: "markdown",
    markdown: MARKDOWN,
    notes:
      "Laboratorio sugerido: capturar con Wireshark el arranque de una conexión y filtrar `arp`. Que identifiquen EtherType, MAC origen/destino y el broadcast de la petición.",
    canvas: { ...STAGE },
    slides,
  };
}
