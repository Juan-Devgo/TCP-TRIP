import {
  PRESENTATION_SCHEMA_VERSION,
  type PresentationDocument,
  type PresentationElement,
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
  rect,
  table,
  text,
  titleSlide,
} from "./slides";

const DECK = "TCP/IP · Visión general";

const MARKDOWN = `> **Objetivo de la sesión:** entender por qué las redes se organizan en capas, cuáles son las cuatro capas del modelo TCP/IP, qué hace cada una y cómo viaja un mensaje de una aplicación a otra a través de todas ellas.

## 1. ¿Por qué un modelo de capas?

Enviar un mensaje por Internet implica resolver muchos problemas a la vez: convertir bits en señales, decidir por qué camino viaja un paquete, recuperar lo que se pierde, entregar los datos al programa correcto… Resolverlos todos en un solo bloque de software sería inmanejable.

La solución es **dividir el problema en capas**. Cada capa:

- **Ofrece un servicio** a la capa de arriba (por ejemplo, *"entrego este paquete a esa dirección IP"*).
- **Usa el servicio** de la capa de abajo, sin saber cómo está implementado.
- **Habla con su capa par** en el otro extremo mediante un **protocolo**: un conjunto de reglas sobre el formato y el orden de los mensajes.

Esta separación permite cambiar una capa sin tocar las demás: una página web se descarga igual por Wi-Fi que por fibra óptica, porque HTTP no sabe (ni le importa) qué medio físico hay debajo.

## 2. Un poco de historia

| Año | Hito |
| --- | --- |
| 1969 | ARPANET conecta sus primeros cuatro nodos. |
| 1974 | Vinton Cerf y Robert Kahn publican el diseño de TCP (*A Protocol for Packet Network Intercommunication*). |
| 1981 | Se publican **RFC 791** (IP) y **RFC 793** (TCP). |
| 1983 | El 1 de enero ARPANET migra por completo a TCP/IP (*flag day*). |
| 1989 | **RFC 1122** y **RFC 1123** fijan los requisitos de los hosts y describen el modelo en capas. |

El modelo TCP/IP **nació de la implementación**: primero funcionaron los protocolos y luego se describió el modelo. Por eso encaja tan bien con la Internet real.

## 3. Las cuatro capas

El RFC 1122 describe cuatro capas. De arriba hacia abajo:

| Capa | ¿Qué hace? | Protocolos típicos | Unidad de datos (PDU) | Dirección que usa |
| --- | --- | --- | --- | --- |
| **Aplicación** | Ofrece servicios al usuario y a los programas. | HTTP, DNS, SMTP, DHCP, SSH | Mensaje | Nombre (p. ej. \`www.uniquindio.edu.co\`) |
| **Transporte** | Comunica *procesos* de extremo a extremo; puede garantizar entrega y orden. | TCP, UDP, QUIC | Segmento (TCP) / Datagrama (UDP) | Puerto (16 bits) |
| **Internet** | Lleva paquetes entre redes distintas, eligiendo la ruta. | IPv4, IPv6, ICMP | Paquete (datagrama IP) | Dirección IP (32 o 128 bits) |
| **Acceso a la red** | Mueve tramas dentro de un mismo enlace físico. | Ethernet, Wi-Fi (802.11), ARP | Trama | Dirección MAC (48 bits) |

> [!NOTE]
> Muchos libros usan un modelo **híbrido de cinco capas** que separa la capa de acceso a la red en *enlace de datos* y *física*. Es la misma idea con un nivel más de detalle; en este curso lo mencionaremos cuando sea útil.

## 4. TCP/IP frente a OSI

El modelo **OSI** (ISO/IEC 7498-1) tiene siete capas y se diseñó *antes* que los protocolos, como un marco de referencia. TCP/IP es más pragmático. Esta es la correspondencia habitual:

| OSI | TCP/IP |
| --- | --- |
| 7. Aplicación · 6. Presentación · 5. Sesión | Aplicación |
| 4. Transporte | Transporte |
| 3. Red | Internet |
| 2. Enlace de datos · 1. Física | Acceso a la red |

OSI sigue siendo útil como **vocabulario** ("un switch de capa 2", "un balanceador de capa 7"), pero los protocolos que usamos todos los días son los de TCP/IP.

## 5. Encapsulamiento

Cuando una aplicación envía datos, cada capa **añade su propia cabecera** delante de lo que recibe de la capa superior. Ese proceso se llama **encapsulamiento**; en el receptor ocurre lo contrario (**desencapsulamiento**): cada capa lee y retira su cabecera y entrega el resto hacia arriba.

\`\`\`plaintext
Aplicación                              [ Datos HTTP ]
Transporte                 [ Cab. TCP ][ Datos HTTP ]                    → segmento
Internet         [ Cab. IP ][ Cab. TCP ][ Datos HTTP ]                    → paquete
Acceso a la red  [ Cab. Eth ][ Cab. IP ][ Cab. TCP ][ Datos HTTP ][ FCS ] → trama
\`\`\`

Cada cabecera solo tiene sentido para su capa par: un router mira la cabecera IP para decidir la ruta, pero no abre el segmento TCP; un switch mira la cabecera Ethernet y no sabe nada de IP.

### ¿Cuánto cuesta encapsular?

Supongamos una petición HTTP de **500 bytes** enviada por Ethernet, con cabeceras mínimas:

| Elemento | Bytes |
| --- | --- |
| Datos de aplicación | 500 |
| Cabecera TCP | 20 |
| Cabecera IPv4 | 20 |
| Cabecera Ethernet (14) + FCS (4) | 18 |
| **Total en el cable** | **558** |

La eficiencia es 500 / 558 ≈ **89,6 %**. Con mensajes pequeños el porcentaje de cabeceras crece mucho: por eso protocolos como DNS prefieren UDP (8 bytes de cabecera) en lugar de TCP.

## 6. El reloj de arena y el principio extremo a extremo

Arriba hay decenas de protocolos de aplicación y abajo decenas de tecnologías de enlace, pero en el medio hay **un solo protocolo obligatorio: IP**. Esta forma de *reloj de arena* es la clave del éxito de Internet: cualquier aplicación funciona sobre cualquier red, siempre que ambas hablen IP.

Además, Internet sigue el **principio extremo a extremo** (*end-to-end*): la red se limita a mover paquetes (*best effort*) y la inteligencia —fiabilidad, orden, cifrado— vive en los hosts. Por eso los routers son relativamente simples y TCP corre en tu computador, no en la red.

## 7. ¿Quién define los protocolos?

Los protocolos de Internet los publica la **IETF** (*Internet Engineering Task Force*) como documentos llamados **RFC** (*Request for Comments*). Cada RFC tiene un número que nunca cambia: si un protocolo se actualiza, se publica un RFC nuevo que *deja obsoleto* al anterior (por ejemplo, el RFC 9293 de 2022 reemplazó al RFC 793 de TCP).

> [!TIP]
> Cuando una herramienta de TCP-TRIP rechace un valor, el mensaje cita el RFC y la sección que impone la regla. Ábrelo: aprender a leer RFCs es parte del curso.

## 8. Preguntas de repaso

1. ¿Qué ventaja concreta obtiene una aplicación web del hecho de que las capas sean independientes?
2. Nombra la PDU y el tipo de dirección de cada una de las cuatro capas.
3. ¿Qué capas de OSI quedan agrupadas en la capa de aplicación de TCP/IP?
4. Calcula la eficiencia de enviar 100 bytes de datos por UDP sobre IPv4 y Ethernet.
5. ¿Por qué se dice que IP es la "cintura" del reloj de arena?
`;

/** The four layers, top to bottom, with an accent each — reused by several slides. */
const LAYERS = [
  { name: "Aplicación", detail: "HTTP · DNS · SMTP · DHCP", pdu: "Mensaje", accent: "secondary" },
  { name: "Transporte", detail: "TCP · UDP · QUIC", pdu: "Segmento", accent: "primary" },
  { name: "Internet", detail: "IPv4 · IPv6 · ICMP", pdu: "Paquete", accent: "quaternary" },
  { name: "Acceso a la red", detail: "Ethernet · Wi-Fi · ARP", pdu: "Trama", accent: "tertiary" },
] as const;

function layerStack(x: number, y: number, width: number, height: number) {
  const gap = 16;
  const each = (height - gap * (LAYERS.length - 1)) / LAYERS.length;
  return LAYERS.flatMap((layer, index) =>
    box(x, Math.round(y + index * (each + gap)), width, Math.round(each), layer.name, layer.accent, {
      size: 34,
      strokeWidth: 6,
    }),
  );
}

export function overviewDocument(): PresentationDocument {
  const slides = [
    titleSlide({
      kicker: "Unidad 1 · Fundamentos",
      title: "El modelo TCP/IP",
      subtitle: "Cuatro capas, un objetivo: que cualquier aplicación funcione sobre cualquier red.",
      notes:
        "Abrir preguntando: ¿qué pasa entre que escriben una URL y aparece la página? Anotar respuestas en el tablero y volver a ellas al final.",
      figure: layerStack(1340, 260, 440, 560),
    }),

    contentSlide(DECK, {
      title: "¿Por qué organizar la red en capas?",
      notes:
        "Analogía del correo postal: quien escribe la carta no sabe si viaja en avión o en camión. Insistir en servicio (vertical) vs. protocolo (horizontal).",
      body: [
        bullets(MARGIN, BODY_TOP + 20, 900, [
          "Cada capa ofrece un servicio a la de arriba.",
          "Usa la capa de abajo sin conocer su implementación.",
          "Habla con su capa par mediante un protocolo.",
          "Cambiar una capa no obliga a cambiar las demás.",
        ]),
        ...box(1180, BODY_TOP + 40, 560, 130, "Capa N  (emisor)", "secondary"),
        ...box(1180, BODY_TOP + 460, 560, 130, "Capa N − 1", "muted-foreground"),
        arrow(1460, BODY_TOP + 175, 1460, BODY_TOP + 450, { stroke: "muted-foreground" }),
        text(1480, BODY_TOP + 280, 300, 100, "usa el\nservicio", {
          size: 30,
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Las cuatro capas (RFC 1122)",
      notes:
        "Recorrer de arriba hacia abajo. Pedir un ejemplo de protocolo de cada capa antes de mostrar la columna derecha.",
      body: [
        ...LAYERS.flatMap((layer, index) => {
          const y = BODY_TOP + 20 + index * 185;
          return [
            ...box(MARGIN, y, 560, 160, layer.name, layer.accent, { size: 40, strokeWidth: 7 }),
            text(MARGIN + 620, y + 30, 760, 50, layer.detail, { size: 40, weight: 600 }),
            text(MARGIN + 620, y + 90, 760, 44, `PDU: ${layer.pdu}`, {
              size: 32,
              color: "muted-foreground",
              mono: true,
            }),
          ];
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "TCP/IP frente a OSI",
      notes:
        "OSI = vocabulario (capa 2, capa 7); TCP/IP = lo que realmente corre. Presentación y sesión no tienen capa propia en TCP/IP: las resuelve la aplicación (p. ej. TLS).",
      body: (() => {
        const osi = [
          "7 · Aplicación",
          "6 · Presentación",
          "5 · Sesión",
          "4 · Transporte",
          "3 · Red",
          "2 · Enlace de datos",
          "1 · Física",
        ];
        const rowHeight = 96;
        const top = BODY_TOP + 20;
        const tcpIp = [
          { label: "Aplicación", from: 0, span: 3, accent: "secondary" },
          { label: "Transporte", from: 3, span: 1, accent: "primary" },
          { label: "Internet", from: 4, span: 1, accent: "quaternary" },
          { label: "Acceso a la red", from: 5, span: 2, accent: "tertiary" },
        ] as const;

        return [
          text(MARGIN + 150, top - 10, 560, 40, "OSI", { size: 32, weight: 700, align: "center" }),
          text(1100, top - 10, 560, 40, "TCP/IP", { size: 32, weight: 700, align: "center" }),
          ...osi.flatMap((label, index) =>
            box(MARGIN + 150, top + 40 + index * rowHeight, 560, rowHeight - 12, label, "muted-foreground", {
              size: 32,
              weight: 400,
              strokeWidth: 3,
            }),
          ),
          ...tcpIp.flatMap((layer) =>
            box(
              1100,
              top + 40 + layer.from * rowHeight,
              560,
              layer.span * rowHeight - 12,
              layer.label,
              layer.accent,
              { size: 36, strokeWidth: 7 },
            ),
          ),
        ];
      })(),
    }),

    contentSlide(DECK, {
      title: "Encapsulamiento",
      notes:
        "Dibujar en el tablero cómo el receptor quita las cabeceras en orden inverso. Preguntar: ¿qué cabecera lee un switch? ¿y un router?",
      body: (() => {
        const unit = 1300 / 6;
        const rows = [
          { label: "Aplicación", fields: [["Datos", 2, "secondary"]] },
          { label: "Transporte", fields: [["TCP", 1, "primary"], ["Datos", 2, "secondary"]] },
          {
            label: "Internet",
            fields: [["IP", 1, "quaternary"], ["TCP", 1, "primary"], ["Datos", 2, "secondary"]],
          },
          {
            label: "Acceso",
            fields: [
              ["Eth", 1, "tertiary"],
              ["IP", 1, "quaternary"],
              ["TCP", 1, "primary"],
              ["Datos", 2, "secondary"],
              ["FCS", 1, "tertiary"],
            ],
          },
        ] as const;
        const right = 1800;

        return rows.flatMap((row, index) => {
          const y = BODY_TOP + 30 + index * 180;
          const total = row.fields.reduce((sum, field) => sum + field[1], 0);
          // Aligned on the data block: each layer grows to the left, and the
          // frame's trailer (FCS) is the one field that lands on its right.
          const end = row.label === "Acceso" ? right : right - unit;
          let cursor = end - total * unit;
          const elements: PresentationElement[] = [
            text(MARGIN, y + 40, 360, 50, row.label, { size: 38, weight: 600 }),
          ];
          for (const [label, units, accent] of row.fields) {
            const width = Math.round(units * unit);
            elements.push(...box(Math.round(cursor), y, width, 120, label, accent, { size: 34 }));
            cursor += width;
          }
          return elements;
        });
      })(),
    }),

    contentSlide(DECK, {
      title: "Cada capa, su PDU y su dirección",
      notes: "Que lo copien: esta tabla vuelve en todas las unidades.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          560,
          [
            ["Capa", "PDU", "Dirección", "Ejemplo"],
            ["Aplicación", "Mensaje", "Nombre", "www.uniquindio.edu.co"],
            ["Transporte", "Segmento / datagrama", "Puerto (16 bits)", "443"],
            ["Internet", "Paquete", "IP (32 / 128 bits)", "192.0.2.15"],
            ["Acceso a la red", "Trama", "MAC (48 bits)", "3C:52:82:1A:9F:04"],
          ],
          { size: 36 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "¿Cuánto cuesta encapsular?",
      notes:
        "Hacer el cálculo con ellos. Luego pedir el de 100 bytes por UDP (pregunta 4 del repaso): 100 / (100+8+20+18) ≈ 68,5 %.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          900,
          600,
          [
            ["Elemento", "Bytes"],
            ["Datos HTTP", "500"],
            ["Cabecera TCP", "20"],
            ["Cabecera IPv4", "20"],
            ["Ethernet + FCS", "18"],
            ["Total en el cable", "558"],
          ],
          { size: 36 },
        ),
        text(1120, BODY_TOP + 120, 680, 60, "Eficiencia", { size: 40, weight: 600 }),
        text(1120, BODY_TOP + 200, 680, 80, "500 / 558", { size: 64, mono: true }),
        text(1120, BODY_TOP + 300, 680, 120, "≈ 89,6 %", { size: 110, weight: 700, color: "primary" }),
        text(1120, BODY_TOP + 470, 680, 140, "Con mensajes pequeños,\nlas cabeceras pesan más.", {
          size: 34,
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "El reloj de arena de Internet",
      notes:
        "IP es la única pieza obligatoria. Conectar con el principio extremo a extremo: la red es simple (best effort) y la inteligencia vive en los hosts.",
      body: (() => {
        const centre = STAGE.width / 2;
        const rows = [
          { label: "HTTP · DNS · SMTP · SSH · DHCP · …", width: 1500, accent: "secondary" },
          { label: "TCP · UDP · QUIC", width: 900, accent: "primary" },
          { label: "IP", width: 300, accent: "quaternary" },
          { label: "Ethernet · Wi-Fi · fibra · 4G/5G · …", width: 1500, accent: "tertiary" },
        ] as const;

        return rows.flatMap((row, index) =>
          box(
            Math.round(centre - row.width / 2),
            BODY_TOP + 40 + index * 170,
            row.width,
            130,
            row.label,
            row.accent,
            { size: row.label === "IP" ? 56 : 38, strokeWidth: 7 },
          ),
        );
      })(),
    }),

    contentSlide(DECK, {
      title: "Para llevar",
      notes:
        "Volver a las respuestas del inicio y ubicar cada paso en una capa. Anunciar que la próxima sesión empieza por la capa de acceso a la red.",
      body: [
        bullets(MARGIN, BODY_TOP + 20, 1100, [
          "Cuatro capas: aplicación, transporte, internet, acceso a la red.",
          "Cada capa añade su cabecera: encapsulamiento.",
          "IP es la cintura común de todas las redes.",
          "Los protocolos se definen en RFCs de la IETF.",
        ]),
        rect(1340, BODY_TOP + 20, 4, 600, { fill: "muted", stroke: "muted", strokeWidth: 0 }),
        text(1400, BODY_TOP + 20, 400, 50, "Siguiente", { size: 34, color: "muted-foreground" }),
        text(1400, BODY_TOP + 80, 400, 200, "Capa de\nacceso a\nla red", { size: 52, weight: 700 }),
      ],
    }),
  ];

  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "El modelo TCP/IP: visión general",
    topic: "tcp-ip-model",
    mode: "markdown",
    markdown: MARKDOWN,
    notes:
      "Sesión de 2 horas. 1ª hora: capas, OSI y encapsulamiento con las diapositivas. 2ª hora: repaso en grupos (preguntas al final de la lectura) y cálculo de eficiencia con la herramienta de checksum/fragmentación para anticipar la unidad de IP.",
    canvas: { ...STAGE },
    slides,
  };
}
