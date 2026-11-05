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

const DECK = "TCP/IP · Capa de Internet";

const MARKDOWN = `> **Objetivo de la sesión:** entender cómo un paquete cruza redes distintas hasta su destino: la cabecera IPv4, el direccionamiento y las subredes, la fragmentación, el checksum, el enrutamiento por prefijo más largo e ICMP. Al final, una mirada rápida a IPv6.

## 1. ¿Qué hace esta capa?

La capa de acceso a la red solo llega hasta el borde del enlace. La capa de Internet resuelve el problema de **interconectar redes** (*inter-net*): llevar un paquete desde un host hasta otro que puede estar al otro lado del mundo, atravesando decenas de routers y tecnologías distintas.

Su protocolo central es **IP** (*Internet Protocol*, **RFC 791** para IPv4), y sus características definen a toda Internet:

| Característica | Significado |
| --- | --- |
| **Sin conexión** | Cada paquete se trata de forma independiente; no hay un "circuito" previo. |
| **Mejor esfuerzo** (*best effort*) | IP intenta entregar, pero no garantiza nada: los paquetes pueden perderse, duplicarse o llegar desordenados. |
| **Direccionamiento lógico** | Cada interfaz tiene una dirección IP que indica *en qué red* está, no solo *quién* es. |
| **Enrutamiento** | Los routers deciden, salto a salto, por dónde sigue cada paquete. |

Recuperar pérdidas y ordenar es trabajo de la capa de transporte (TCP), no de IP.

## 2. La cabecera IPv4

La cabecera tiene **20 bytes** sin opciones (hasta 60 con ellas). El RFC 791, sección 3.1, la dibuja en filas de 32 bits:

| Campo | Bits | Para qué sirve |
| --- | --- | --- |
| Versión | 4 | Siempre \`4\` en IPv4. |
| IHL | 4 | Longitud de la cabecera en palabras de 32 bits (mínimo 5 = 20 bytes, máximo 15 = 60 bytes). |
| DSCP / ECN | 6 / 2 | Calidad de servicio y notificación explícita de congestión (antes "Tipo de servicio"). |
| Longitud total | 16 | Tamaño del paquete completo (cabecera + datos) en bytes; máximo 65 535. |
| Identificación | 16 | Número común a todos los fragmentos de un mismo paquete. |
| Flags | 3 | Bit reservado, **DF** (*Don't Fragment*) y **MF** (*More Fragments*). |
| Desplazamiento | 13 | Posición del fragmento dentro de los datos originales, **en unidades de 8 bytes**. |
| TTL | 8 | Saltos restantes: cada router lo decrementa y descarta el paquete al llegar a 0. |
| Protocolo | 8 | Qué lleva dentro: \`1\` = ICMP, \`6\` = TCP, \`17\` = UDP. |
| Checksum de cabecera | 16 | Detecta errores **solo en la cabecera**. |
| Dirección origen | 32 | IP del emisor. |
| Dirección destino | 32 | IP del receptor. |
| Opciones | variable | Rara vez usadas hoy. |

## 3. Direcciones IPv4

Una dirección IPv4 tiene **32 bits** y se escribe en **notación decimal con puntos**: cuatro bytes separados por puntos, cada uno de 0 a 255.

\`\`\`plaintext
192.168.10.77  =  11000000.10101000.00001010.01001101
\`\`\`

Cada dirección tiene dos partes: la **red** (los bits de la izquierda) y el **host** (el resto). La frontera la marca el **prefijo** o la **máscara**:

\`\`\`plaintext
192.168.10.77/26
Máscara:   255.255.255.192  =  11111111.11111111.11111111.11000000
Red:       192.168.10.64      (dirección AND máscara)
Broadcast: 192.168.10.127     (todos los bits de host en 1)
Hosts:     192.168.10.65 – 192.168.10.126   →  2^6 − 2 = 62 hosts
\`\`\`

> [!TIP]
> La calculadora IPv4 de TCP-TRIP hace exactamente este cálculo y muestra cada paso en binario. Úsala para comprobar tus subredes antes de preguntar.

### De las clases a CIDR

Al principio las direcciones se repartían por **clases** (A = /8, B = /16, C = /24). Era un desperdicio enorme: una empresa que necesitaba 300 direcciones recibía una clase B de 65 534. Desde 1993 se usa **CIDR** (*Classless Inter-Domain Routing*, hoy **RFC 4632**): el prefijo puede tener cualquier longitud, y varias redes contiguas se pueden **agregar** en una sola ruta.

### Direcciones especiales

| Bloque | Uso | Referencia |
| --- | --- | --- |
| \`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\` | Direcciones privadas: no se enrutan en Internet. | RFC 1918 |
| \`127.0.0.0/8\` | *Loopback*: el propio equipo. | RFC 1122 §3.2.1.3 |
| \`169.254.0.0/16\` | Enlace local: autoasignada cuando no hay DHCP. | RFC 3927 |
| \`100.64.0.0/10\` | Espacio compartido para NAT del operador (CGNAT). | RFC 6598 |
| \`255.255.255.255\` | Difusión limitada a la red local. | RFC 919 |

### Subredes: un ejemplo

Hay que dividir \`192.168.10.0/24\` en **4 subredes iguales**. Se necesitan 2 bits prestados (2² = 4), así que el nuevo prefijo es **/26** y cada subred tiene 2⁶ = 64 direcciones (62 hosts):

| Subred | Red | Primer host | Último host | Broadcast |
| --- | --- | --- | --- | --- |
| 1 | 192.168.10.0/26 | .1 | .62 | .63 |
| 2 | 192.168.10.64/26 | .65 | .126 | .127 |
| 3 | 192.168.10.128/26 | .129 | .190 | .191 |
| 4 | 192.168.10.192/26 | .193 | .254 | .255 |

## 4. Fragmentación

Cada enlace tiene una **MTU** (en Ethernet, 1500 bytes). Si un paquete es más grande que la MTU del siguiente enlace, IPv4 lo **fragmenta**: lo divide en paquetes más pequeños que se reensamblan **solo en el destino**.

Reglas (RFC 791 §2.3 y §3.2):

- Todos los fragmentos llevan la misma **Identificación**.
- Los datos de cada fragmento (salvo el último) deben ser **múltiplo de 8 bytes**, porque el desplazamiento se mide en bloques de 8.
- **MF = 1** en todos los fragmentos menos el último.
- Si el paquete tiene **DF = 1**, el router no fragmenta: lo descarta y avisa con ICMP (la base de *Path MTU Discovery*).

**Ejemplo:** un paquete de 4000 bytes (20 de cabecera + 3980 de datos) debe cruzar un enlace con MTU 1500. Cada fragmento puede llevar 1500 − 20 = **1480 bytes** de datos (1480 / 8 = 185 ✓).

| Fragmento | Datos | Longitud total | Desplazamiento | MF |
| --- | --- | --- | --- | --- |
| 1 | 1480 | 1500 | 0 | 1 |
| 2 | 1480 | 1500 | 185 | 1 |
| 3 | 1020 | 1040 | 370 | 0 |

> [!TIP]
> La calculadora de fragmentación de TCP-TRIP genera esta tabla para cualquier tamaño y MTU, y te dice qué regla del RFC incumple un valor inválido.

## 5. El checksum de cabecera

El checksum es el **complemento a uno de la suma en complemento a uno** de todas las palabras de 16 bits de la cabecera, calculado con el campo checksum en cero (RFC 791 §3.1; algoritmo en RFC 1071).

\`\`\`plaintext
4500 0073 0000 4000 4011 [0000] c0a8 0001 c0a8 00c7
Suma:              0x2479C
Acarreo plegado:   0x479C + 0x2 = 0x479E
Complemento:       ~0x479E = 0xB861   ← checksum
\`\`\`

El receptor suma todas las palabras **incluido** el checksum: si el resultado es \`0xFFFF\`, la cabecera está bien. Como el TTL cambia en cada salto, **cada router recalcula el checksum**.

## 6. Enrutamiento

Un router decide el siguiente salto consultando su **tabla de rutas**. Si varias entradas coinciden con el destino, gana la de **prefijo más largo** (*longest prefix match*): es la más específica.

| Destino | Siguiente salto | Interfaz |
| --- | --- | --- |
| 192.168.10.0/24 | directamente conectada | eth0 |
| 10.0.0.0/8 | 192.168.10.254 | eth0 |
| 10.20.0.0/16 | 192.168.10.253 | eth0 |
| 0.0.0.0/0 | 192.168.10.1 | eth0 |

- Un paquete a \`10.20.5.9\` coincide con \`/8\` y con \`/16\` → gana **/16** (via .253).
- Un paquete a \`8.8.8.8\` solo coincide con \`0.0.0.0/0\`, la **ruta por defecto** → va al .1.

Las tablas se llenan a mano (rutas estáticas) o con protocolos de enrutamiento: OSPF dentro de una organización y BGP entre organizaciones.

## 7. ICMP

**ICMP** (**RFC 792**) es el protocolo de mensajes de control y error de IP. Viaja dentro de paquetes IP (Protocolo = 1).

| Tipo | Mensaje | Lo usa… |
| --- | --- | --- |
| 8 / 0 | *Echo request* / *Echo reply* | \`ping\` |
| 3 | Destino inalcanzable (código 4 = fragmentación necesaria y DF activo) | Path MTU Discovery |
| 11 | Tiempo excedido (TTL llegó a 0) | \`traceroute\` |

\`traceroute\` envía paquetes con TTL = 1, 2, 3… y cada router que descarta uno responde con un *Tiempo excedido*: así se descubre el camino salto a salto.

## 8. NAT

Las direcciones privadas no se enrutan en Internet. Un router con **NAT** (RFC 3022) reemplaza la IP privada de origen por su IP pública (y normalmente también el puerto) y recuerda la traducción para devolver las respuestas. Así, toda una casa o una universidad sale a Internet con una o pocas IP públicas.

## 9. IPv6 en una mirada

Las ~4300 millones de direcciones IPv4 se agotaron (IANA entregó los últimos bloques en 2011). **IPv6** (**RFC 8200**) es la respuesta:

| | IPv4 | IPv6 |
| --- | --- | --- |
| Tamaño de dirección | 32 bits | 128 bits |
| Notación | \`192.0.2.1\` | \`2001:db8::1\` (RFC 5952) |
| Cabecera | 20 – 60 bytes, variable | 40 bytes, fija |
| Checksum de cabecera | Sí | No (lo hacen las otras capas) |
| Fragmentación | Emisor y routers | Solo el emisor |
| Saltos restantes | TTL | Hop Limit |
| Resolución de MAC | ARP | NDP (ICMPv6) |

## 10. Preguntas de repaso

1. ¿Por qué se dice que IP es un servicio de "mejor esfuerzo"? ¿Qué capa compensa sus carencias?
2. Para \`172.16.45.200/20\`, calcula red, broadcast y rango de hosts.
3. Divide \`10.0.0.0/24\` en 8 subredes iguales. ¿Cuántos hosts tiene cada una?
4. Un paquete de 2400 bytes (cabecera de 20) cruza un enlace con MTU 1000. Escribe la tabla de fragmentos.
5. ¿Por qué cada router debe recalcular el checksum de cabecera?
6. Con la tabla de rutas de la sección 6, ¿a dónde va un paquete hacia \`10.99.1.1\`?
`;

export function internetDocument(): PresentationDocument {
  const slides = [
    titleSlide({
      kicker: "Unidad 3 · Capa 2 de TCP/IP",
      title: "Capa de Internet",
      subtitle: "Direcciones, subredes, fragmentación y enrutamiento: cómo un paquete cruza redes.",
      notes:
        "Pregunta inicial: ¿cuántos routers cruza un paquete hasta google.com? Hacer un traceroute en vivo y volver a él en la diapositiva de ICMP.",
      figure: [
        ...box(1320, 360, 200, 110, "Host", "secondary", { size: 36 }),
        ...box(1600, 360, 200, 110, "R1", "quaternary", { size: 36 }),
        ...box(1600, 620, 200, 110, "R2", "quaternary", { size: 36 }),
        ...box(1320, 620, 200, 110, "Host", "primary", { size: 36 }),
        arrow(1520, 415, 1600, 415, { strokeWidth: 5 }),
        arrow(1700, 470, 1700, 620, { strokeWidth: 5 }),
        arrow(1600, 675, 1520, 675, { strokeWidth: 5 }),
      ],
    }),

    contentSlide(DECK, {
      title: "IP: sin conexión y de mejor esfuerzo",
      notes:
        "IP no garantiza nada: pérdida, duplicados, desorden. Y aun así funciona porque TCP compensa en los extremos (principio extremo a extremo).",
      body: [
        ...box(MARGIN, BODY_TOP + 30, 820, 280, "Sin conexión\n\nCada paquete viaja\npor su cuenta", "quaternary", { size: 36 }),
        ...box(MARGIN + 860, BODY_TOP + 30, 820, 280, "Mejor esfuerzo\n\nPuede perder, duplicar\no desordenar", "primary", { size: 36 }),
        ...box(MARGIN, BODY_TOP + 350, 820, 280, "Direccionamiento lógico\n\nLa IP dice en qué\nred está el host", "secondary", { size: 36 }),
        ...box(MARGIN + 860, BODY_TOP + 350, 820, 280, "Enrutamiento\n\nCada router elige\nel siguiente salto", "quaternary", { size: 36 }),
      ],
    }),

    contentSlide(DECK, {
      title: "La cabecera IPv4 (RFC 791 §3.1)",
      notes:
        "Ancho a escala: 32 bits por fila. Señalar los campos que cambian en cada salto (TTL y checksum) y los de fragmentación (identificación, flags, desplazamiento).",
      body: (() => {
        const rowHeight = 112;
        const top = BODY_TOP + 10;
        const rows = [
          [["Versión", 4], ["IHL", 4], ["DSCP / ECN", 8], ["Longitud total", 16]],
          [["Identificación", 16, "primary"], ["Flags", 3, "primary"], ["Desplazamiento", 13, "primary"]],
          [["TTL", 8, "secondary"], ["Protocolo", 8], ["Checksum de cabecera", 16, "secondary"]],
          [["Dirección IP de origen", 32, "quaternary"]],
          [["Dirección IP de destino", 32, "quaternary"]],
          [["Opciones (si IHL > 5)", 32]],
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
      title: "Dirección, máscara y prefijo",
      notes:
        "Hacer el AND bit a bit en el tablero. Luego comprobar con la calculadora IPv4. Fórmula de hosts: 2^(32−prefijo) − 2.",
      body: [
        text(MARGIN, BODY_TOP + 20, CONTENT_WIDTH, 80, "192.168.10.77/26", {
          size: 72,
          weight: 700,
          align: "center",
          mono: true,
        }),
        table(
          MARGIN,
          BODY_TOP + 140,
          CONTENT_WIDTH,
          540,
          [
            ["", "Decimal", "Binario (último byte)"],
            ["Dirección", "192.168.10.77", "01001101"],
            ["Máscara", "255.255.255.192", "11000000"],
            ["Red (AND)", "192.168.10.64", "01000000"],
            ["Broadcast", "192.168.10.127", "01111111"],
            ["Hosts", ".65 – .126", "2⁶ − 2 = 62"],
          ],
          { size: 36, mono: true },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Subredes: 192.168.10.0/24 en 4 partes",
      notes:
        "2 bits prestados → /26 → saltos de 64. Que completen la fila 4 antes de mostrarla. Ejercicio para casa: pregunta 3 del repaso.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          520,
          [
            ["Subred", "Red", "Hosts", "Broadcast"],
            ["1", "192.168.10.0/26", ".1 – .62", ".63"],
            ["2", "192.168.10.64/26", ".65 – .126", ".127"],
            ["3", "192.168.10.128/26", ".129 – .190", ".191"],
            ["4", "192.168.10.192/26", ".193 – .254", ".255"],
          ],
          { size: 36, mono: true },
        ),
        text(MARGIN, BODY_TOP + 600, CONTENT_WIDTH, 60, "2 bits prestados  →  2² = 4 subredes  ·  2⁶ = 64 direcciones cada una", {
          size: 36,
          align: "center",
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Direcciones especiales",
      notes:
        "Preguntar: ¿qué IP tiene su celular ahora mismo? Casi seguro una privada o CGNAT. 169.254 = el DHCP falló.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          600,
          [
            ["Bloque", "Uso", "RFC"],
            ["10.0.0.0/8", "Privada", "1918"],
            ["172.16.0.0/12", "Privada", "1918"],
            ["192.168.0.0/16", "Privada", "1918"],
            ["127.0.0.0/8", "Loopback", "1122"],
            ["169.254.0.0/16", "Enlace local (sin DHCP)", "3927"],
            ["100.64.0.0/10", "CGNAT del operador", "6598"],
          ],
          { size: 34, mono: true },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Fragmentación: 4000 B por un enlace de 1500",
      notes:
        "1480 = 1500 − 20 y es múltiplo de 8. Desplazamiento en bloques de 8: 1480/8 = 185. Mostrar el mismo caso en la calculadora de fragmentación.",
      body: [
        ...fieldRow(MARGIN, BODY_TOP + 30, CONTENT_WIDTH, 110, 3980, [
          ["1480 B · desp. 0", 1480, "primary"],
          ["1480 B · desp. 185", 1480, "secondary"],
          ["1020 B · 370", 1020, "quaternary"],
        ], { size: 30 }),
        table(
          MARGIN,
          BODY_TOP + 200,
          CONTENT_WIDTH,
          380,
          [
            ["Fragmento", "Datos", "Longitud total", "Desplazamiento", "MF"],
            ["1", "1480", "1500", "0", "1"],
            ["2", "1480", "1500", "185", "1"],
            ["3", "1020", "1040", "370", "0"],
          ],
          { size: 34, mono: true },
        ),
        text(MARGIN, BODY_TOP + 620, CONTENT_WIDTH, 60, "Misma identificación · datos múltiplo de 8 · se reensambla solo en el destino", {
          size: 32,
          align: "center",
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Checksum de cabecera",
      notes:
        "Sumar en el tablero solo las tres primeras palabras para mostrar el acarreo. El resto, con la herramienta de checksum. Pregunta: ¿por qué cada router lo recalcula? (TTL).",
      body: [
        text(MARGIN, BODY_TOP + 30, CONTENT_WIDTH, 60, "4500 0073 0000 4000 4011 [0000] c0a8 0001 c0a8 00c7", {
          size: 44,
          mono: true,
          align: "center",
        }),
        table(
          MARGIN + 260,
          BODY_TOP + 150,
          1160,
          360,
          [
            ["Paso", "Resultado"],
            ["Suma de palabras", "0x2479C"],
            ["Plegar el acarreo", "0x479C + 0x2 = 0x479E"],
            ["Complemento a uno", "0xB861"],
          ],
          { size: 36, mono: true },
        ),
        text(MARGIN, BODY_TOP + 560, CONTENT_WIDTH, 100, "Verificación: la suma con el checksum incluido da 0xFFFF", {
          size: 36,
          align: "center",
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Enrutamiento: gana el prefijo más largo",
      notes:
        "10.20.5.9 coincide con /8 y /16 → /16. 8.8.8.8 → ruta por defecto. Mencionar OSPF (dentro) y BGP (entre organizaciones).",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          1080,
          440,
          [
            ["Destino", "Siguiente salto"],
            ["192.168.10.0/24", "conectada"],
            ["10.0.0.0/8", "192.168.10.254"],
            ["10.20.0.0/16", "192.168.10.253"],
            ["0.0.0.0/0", "192.168.10.1"],
          ],
          { size: 34, mono: true },
        ),
        ...box(1280, BODY_TOP + 30, 520, 200, "→ 10.20.5.9\n\n/16 · vía .253", "secondary", { size: 34, mono: true }),
        ...box(1280, BODY_TOP + 270, 520, 200, "→ 8.8.8.8\n\npor defecto · vía .1", "primary", { size: 34, mono: true }),
        text(MARGIN, BODY_TOP + 540, CONTENT_WIDTH, 60, "Varias coincidencias: la más específica es la que manda.", {
          size: 36,
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "ICMP: los mensajes de control",
      notes:
        "Volver al traceroute del inicio: cada línea es un 'Tiempo excedido' de un router distinto. Tipo 3 código 4 = la base de Path MTU Discovery.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          360,
          [
            ["Tipo", "Mensaje", "Lo usa"],
            ["8 / 0", "Echo request / reply", "ping"],
            ["3", "Destino inalcanzable", "PMTUD (código 4)"],
            ["11", "Tiempo excedido (TTL = 0)", "traceroute"],
          ],
          { size: 36 },
        ),
        ...[1, 2, 3].flatMap((ttl, index) => [
          ...box(MARGIN + index * 440, BODY_TOP + 470, 380, 120, `TTL = ${ttl}`, "quaternary", { size: 34, mono: true }),
          ...(index < 2
            ? [arrow(MARGIN + index * 440 + 380, BODY_TOP + 530, MARGIN + (index + 1) * 440, BODY_TOP + 530, { strokeWidth: 5 })]
            : []),
        ]),
        text(MARGIN + 1340, BODY_TOP + 490, 340, 100, "traceroute", { size: 40, weight: 700, mono: true }),
      ],
    }),

    contentSlide(DECK, {
      title: "IPv4 frente a IPv6",
      notes:
        "No profundizar: es para que reconozcan una dirección IPv6 y sepan que ARP desaparece. RFC 8200.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          600,
          [
            ["", "IPv4", "IPv6"],
            ["Dirección", "32 bits", "128 bits"],
            ["Ejemplo", "192.0.2.1", "2001:db8::1"],
            ["Cabecera", "20 – 60 B", "40 B fija"],
            ["Checksum", "Sí", "No"],
            ["Fragmenta", "Emisor y routers", "Solo el emisor"],
            ["IP → MAC", "ARP", "NDP"],
          ],
          { size: 34 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Para llevar",
      notes:
        "Tarea: preguntas 2 a 4 del repaso, verificadas con las calculadoras. La próxima sesión: ¿cómo llega el paquete al programa correcto? → puertos.",
      body: [
        bullets(MARGIN, BODY_TOP + 20, 1150, [
          "IP es sin conexión y de mejor esfuerzo.",
          "Dirección = red + host; el prefijo marca la frontera.",
          "Fragmentos: misma ID, datos múltiplo de 8, MF.",
          "Cada router: TTL − 1, nuevo checksum, prefijo más largo.",
        ]),
        text(1400, BODY_TOP + 20, 400, 50, "Siguiente", { size: 34, color: "muted-foreground" }),
        text(1400, BODY_TOP + 80, 400, 200, "Capa de\ntransporte", { size: 52, weight: 700 }),
      ],
    }),
  ];

  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "Capa de Internet",
    topic: "internet-layer",
    mode: "markdown",
    markdown: MARKDOWN,
    notes:
      "Dos sesiones. Sesión 1: IP, cabecera, direcciones y subredes (taller con la calculadora IPv4). Sesión 2: fragmentación, checksum, enrutamiento, ICMP e IPv6. Generar ejercicios de subredes y fragmentación desde las herramientas para el quiz.",
    canvas: { ...STAGE },
    slides,
  };
}
