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
  rect,
  table,
  text,
  titleSlide,
} from "./slides";

const DECK = "TCP/IP · Capa de aplicación";

const MARKDOWN = `> **Objetivo de la sesión:** conocer los protocolos con los que conversan los programas —DNS, HTTP, correo y DHCP—, cómo se apoyan en la capa de transporte y qué ocurre, capa por capa, desde que escribes una URL hasta que ves la página.

## 1. ¿Qué hace esta capa?

Es la capa con la que interactúan los programas. Define **qué se dicen** dos aplicaciones: el formato de los mensajes, su orden y su significado. Todo lo de abajo (puertos, rutas, tramas) es infraestructura para que esa conversación ocurra.

En TCP/IP, esta capa absorbe lo que OSI separa en *sesión*, *presentación* y *aplicación*: la codificación de los datos (UTF-8, JSON, imágenes) y el cifrado (TLS) los resuelve la propia aplicación o una biblioteca que esta usa.

### Dos formas de organizarse

| Modelo | Idea | Ejemplos |
| --- | --- | --- |
| **Cliente-servidor** | Un servidor siempre encendido, con dirección conocida, atiende a muchos clientes. | Web, correo, DNS |
| **Par a par (P2P)** | Los equipos se comunican directamente; cada uno es cliente y servidor a la vez. | BitTorrent, partes de las videollamadas |

## 2. Protocolos y puertos más comunes

| Protocolo | Para qué | Transporte | Puerto | RFC |
| --- | --- | --- | --- | --- |
| DNS | Traducir nombres a direcciones | UDP (y TCP) | 53 | 1034, 1035 |
| HTTP | Transferir páginas y recursos web | TCP | 80 | 9110, 9112 |
| HTTPS | HTTP cifrado con TLS | TCP (o QUIC) | 443 | 9110, 8446 |
| SMTP | Enviar correo | TCP | 25 / 587 | 5321, 6409 |
| IMAP | Leer correo en el servidor | TCP | 143 / 993 | 9051 |
| DHCP | Configurar la red de un equipo | UDP | 67 / 68 | 2131 |
| SSH | Terminal remota cifrada | TCP | 22 | 4251 – 4254 |

## 3. DNS: la agenda de Internet

Las personas recuerdan nombres (\`www.universidad.example\`); los paquetes necesitan direcciones IP. El **DNS** (*Domain Name System*, **RFC 1034** y **RFC 1035**) es una base de datos **distribuida y jerárquica** que hace esa traducción.

### La jerarquía

\`\`\`plaintext
                    . (raíz)
        ┌───────────┼───────────┐
       com          co        example        ← dominios de primer nivel (TLD)
                    │            │
                   edu       universidad     ← dominios de segundo nivel
                    │            │
                 …            www            ← nombre de host
\`\`\`

Ningún servidor conoce todos los nombres: cada nivel sabe **a quién preguntar** por el siguiente.

### Resolución de un nombre

1. Tu equipo (el *stub resolver*) pregunta a su **resolvedor recursivo** (el de tu proveedor o uno público): "¿cuál es la IP de \`www.universidad.example\`?".
2. Si no la tiene en caché, el resolvedor pregunta a un **servidor raíz**, que lo remite a los servidores del TLD \`.example\`.
3. El servidor del TLD lo remite a los **servidores autoritativos** de \`universidad.example\`.
4. El autoritativo responde con la dirección.
5. El resolvedor devuelve la respuesta a tu equipo y la **guarda en caché** durante el TTL del registro.

Tu equipo hace una consulta **recursiva** ("dame la respuesta final"); el resolvedor hace consultas **iterativas** ("¿a quién le pregunto?").

### Tipos de registro

| Tipo | Contiene | Ejemplo |
| --- | --- | --- |
| A | Dirección IPv4 | \`192.0.2.10\` |
| AAAA | Dirección IPv6 (RFC 3596) | \`2001:db8::10\` |
| CNAME | Alias de otro nombre | \`web → www.universidad.example\` |
| MX | Servidor de correo del dominio | \`10 correo.universidad.example\` |
| NS | Servidor autoritativo de la zona | \`ns1.universidad.example\` |
| TXT | Texto libre (verificaciones, SPF) | \`"v=spf1 …"\` |
| PTR | Resolución inversa: IP → nombre | \`10.2.0.192.in-addr.arpa\` |

\`\`\`bash
# Consultar un registro A y mostrar solo la respuesta
dig www.universidad.example A +short

# Ver la cadena completa de delegaciones desde la raíz
dig www.universidad.example +trace
\`\`\`

> [!NOTE]
> DNS usa UDP porque la mayoría de preguntas y respuestas caben en un solo datagrama. Cambia a TCP cuando la respuesta es demasiado grande o para transferir zonas completas.

## 4. HTTP: el protocolo de la web

**HTTP** es un protocolo de **petición-respuesta** y **sin estado**: cada petición se entiende por sí sola (el estado, como una sesión iniciada, se lleva aparte con *cookies* o *tokens*). Su semántica está en el **RFC 9110**; HTTP/1.1, HTTP/2 y HTTP/3 (RFC 9112, 9113 y 9114) son formas distintas de transportarla.

### Una petición y su respuesta (HTTP/1.1)

\`\`\`http
GET /index.html HTTP/1.1
Host: www.universidad.example
User-Agent: Mozilla/5.0
Accept: text/html
\`\`\`

\`\`\`http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Length: 1256
Cache-Control: max-age=3600

<!doctype html> …
\`\`\`

- La **línea inicial** lleva el método, la ruta y la versión (o, en la respuesta, el código de estado).
- Las **cabeceras** describen la petición o el contenido. \`Host\` es obligatoria en HTTP/1.1: permite alojar muchos sitios en una misma IP.
- Una **línea en blanco** separa las cabeceras del cuerpo.

### Métodos

| Método | Uso |
| --- | --- |
| GET | Obtener un recurso. No debe modificar nada. |
| POST | Enviar datos para que el servidor los procese (un formulario). |
| PUT | Crear o reemplazar un recurso completo. |
| PATCH | Modificar parte de un recurso (RFC 5789). |
| DELETE | Eliminar un recurso. |
| HEAD | Como GET, pero solo las cabeceras. |

### Códigos de estado

| Clase | Significado | Ejemplos |
| --- | --- | --- |
| 1xx | Informativo | 101 Switching Protocols |
| 2xx | Éxito | 200 OK, 201 Created, 204 No Content |
| 3xx | Redirección | 301 Moved Permanently, 304 Not Modified |
| 4xx | Error del cliente | 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found |
| 5xx | Error del servidor | 500 Internal Server Error, 503 Service Unavailable |

### HTTPS

**HTTPS** es HTTP sobre **TLS** (hoy TLS 1.3, **RFC 8446**). TLS cifra la conversación, garantiza su integridad y, mediante el certificado del servidor, **autentica** que hablas con quien dices hablar. Usa el puerto 443. En HTTP/3, TLS va integrado en QUIC, sobre UDP.

## 5. Correo electrónico

El correo usa protocolos distintos para **enviar** y para **leer**:

\`\`\`plaintext
Ana (cliente) ──SMTP 587──▶ servidor de Ana ──SMTP 25──▶ servidor de Luis ◀──IMAP 993── Luis (cliente)
\`\`\`

- **SMTP** (RFC 5321) mueve el mensaje: del cliente a su servidor (*submission*, puerto 587, RFC 6409) y de servidor a servidor (puerto 25). El servidor de destino se encuentra con el registro **MX** del dominio.
- **IMAP** (RFC 9051) permite leer y organizar el correo que permanece en el servidor. **POP3** (RFC 1939), más antiguo, lo descarga.

## 6. DHCP: configurarse al conectarse

Cuando un equipo se conecta a una red, **DHCP** (**RFC 2131**) le asigna dirección IP, máscara, puerta de enlace y servidores DNS. El intercambio se conoce como **DORA**:

| Paso | Mensaje | De → a |
| --- | --- | --- |
| 1 | **D**iscover: "¿hay algún servidor DHCP?" | Cliente → broadcast |
| 2 | **O**ffer: "te ofrezco 192.168.1.37" | Servidor → cliente |
| 3 | **R**equest: "acepto la 192.168.1.37" | Cliente → broadcast |
| 4 | **A**ck: "es tuya durante 24 horas" | Servidor → cliente |

Va sobre UDP (servidor en el 67, cliente en el 68) porque el cliente aún no tiene IP. Si nadie responde, el equipo se autoasigna una dirección \`169.254.x.x\`.

## 7. Todo junto: ¿qué pasa al escribir una URL?

Escribes \`https://www.universidad.example\` y presionas Enter:

| # | Qué ocurre | Capas y protocolos |
| --- | --- | --- |
| 1 | El equipo ya tiene IP, gateway y DNS gracias a DHCP. | Aplicación (DHCP) sobre UDP |
| 2 | Para salir de la red necesita la MAC del gateway: la pide con ARP. | Acceso a la red (ARP) |
| 3 | Pregunta al DNS la IP de \`www.universidad.example\`. | Aplicación (DNS) → UDP 53 → IP |
| 4 | Abre una conexión con el servidor: *three-way handshake*. | Transporte (TCP 443) |
| 5 | Negocia el cifrado y verifica el certificado. | TLS 1.3 |
| 6 | Envía \`GET /\` y recibe \`200 OK\` con el HTML. | Aplicación (HTTP) |
| 7 | Cada paquete se encapsula, cruza routers (prefijo más largo, TTL − 1) y viaja en tramas Ethernet o Wi-Fi. | Internet + acceso a la red |
| 8 | El navegador pide el CSS, las imágenes y los scripts, y dibuja la página. | Aplicación |

Aquí aparecen **las cuatro capas** del modelo trabajando juntas: este recorrido es el mejor repaso del curso.

## 8. Preguntas de repaso

1. ¿Por qué DNS usa normalmente UDP y HTTP usa TCP?
2. Describe la diferencia entre una consulta recursiva y una iterativa.
3. ¿Qué registro DNS consulta un servidor de correo para saber a dónde entregar un mensaje?
4. ¿Qué indica una respuesta \`304 Not Modified\`? ¿Y una \`403\`?
5. ¿Por qué los mensajes Discover y Request de DHCP se envían por broadcast?
6. Recorre las cuatro capas para el paso 3 del recorrido de la sección 7: ¿qué cabeceras lleva la consulta DNS en el cable?
`;

export function applicationDocument(): PresentationDocument {
  const slides = [
    titleSlide({
      kicker: "Unidad 5 · Capa 4 de TCP/IP",
      title: "Capa de aplicación",
      subtitle: "DNS, HTTP, correo y DHCP: lo que los programas se dicen, y cómo se apoyan en las capas de abajo.",
      notes:
        "Pregunta inicial: ¿qué protocolos usaron hoy sin saberlo? Abrir las herramientas de desarrollo del navegador (pestaña Red) y mostrar las peticiones de una página.",
      figure: [
        ...box(1340, 300, 200, 110, "DNS", "secondary", { size: 40 }),
        ...box(1580, 300, 200, 110, "HTTP", "primary", { size: 40 }),
        ...box(1340, 450, 200, 110, "SMTP", "quaternary", { size: 40 }),
        ...box(1580, 450, 200, 110, "DHCP", "tertiary", { size: 40 }),
        ...box(1340, 640, 440, 110, "TCP · UDP", "muted-foreground", { size: 40 }),
      ],
    }),

    contentSlide(DECK, {
      title: "Cliente-servidor y par a par",
      notes: "El servidor tiene dirección conocida y está siempre encendido. En P2P cada nodo es cliente y servidor.",
      body: [
        text(MARGIN, BODY_TOP + 20, 800, 50, "Cliente-servidor", { size: 40, weight: 700, align: "center" }),
        ...box(MARGIN + 270, BODY_TOP + 110, 260, 120, "Servidor", "primary", { size: 34 }),
        ...[0, 1, 2].flatMap((index) => [
          ...box(MARGIN + index * 290, BODY_TOP + 420, 220, 100, "Cliente", "secondary", { size: 30 }),
          arrow(MARGIN + index * 290 + 110, BODY_TOP + 420, MARGIN + 400, BODY_TOP + 230, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        ]),
        text(1000, BODY_TOP + 20, 800, 50, "Par a par (P2P)", { size: 40, weight: 700, align: "center" }),
        ...box(1100, BODY_TOP + 120, 220, 100, "Par", "quaternary", { size: 30 }),
        ...box(1480, BODY_TOP + 120, 220, 100, "Par", "quaternary", { size: 30 }),
        ...box(1100, BODY_TOP + 420, 220, 100, "Par", "quaternary", { size: 30 }),
        ...box(1480, BODY_TOP + 420, 220, 100, "Par", "quaternary", { size: 30 }),
        arrow(1320, BODY_TOP + 170, 1480, BODY_TOP + 170, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        arrow(1320, BODY_TOP + 470, 1480, BODY_TOP + 470, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        arrow(1210, BODY_TOP + 220, 1210, BODY_TOP + 420, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        arrow(1590, BODY_TOP + 220, 1590, BODY_TOP + 420, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        arrow(1320, BODY_TOP + 220, 1480, BODY_TOP + 420, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
        text(MARGIN, BODY_TOP + 600, 800, 50, "Web · correo · DNS", { size: 32, align: "center", color: "muted-foreground" }),
        text(1000, BODY_TOP + 600, 800, 50, "BitTorrent · videollamadas", { size: 32, align: "center", color: "muted-foreground" }),
      ],
    }),

    contentSlide(DECK, {
      title: "Protocolos y puertos",
      notes: "Que memoricen al menos 22, 53, 80, 443. Notar qué protocolos van sobre UDP y por qué.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          640,
          [
            ["Protocolo", "Transporte", "Puerto", "RFC"],
            ["DNS", "UDP / TCP", "53", "1034 · 1035"],
            ["HTTP", "TCP", "80", "9110 · 9112"],
            ["HTTPS", "TCP / QUIC", "443", "9110 · 8446"],
            ["SMTP", "TCP", "25 · 587", "5321"],
            ["IMAP", "TCP", "143 · 993", "9051"],
            ["DHCP", "UDP", "67 · 68", "2131"],
            ["SSH", "TCP", "22", "4251"],
          ],
          { size: 32 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "DNS: cómo se resuelve un nombre",
      notes:
        "Numerar las flechas en el tablero. El equipo pregunta de forma recursiva; el resolvedor, de forma iterativa. Todo se guarda en caché según el TTL. Hacer `dig +trace` en vivo.",
      body: [
        ...box(MARGIN, BODY_TOP + 300, 300, 130, "Tu equipo", "secondary", { size: 34 }),
        ...box(MARGIN + 520, BODY_TOP + 300, 360, 130, "Resolvedor\nrecursivo", "primary", { size: 34 }),
        ...box(1360, BODY_TOP + 10, 440, 120, "Raíz  .", "quaternary", { size: 34, mono: true }),
        ...box(1360, BODY_TOP + 305, 440, 120, "TLD  .example", "quaternary", { size: 34, mono: true }),
        ...box(1360, BODY_TOP + 600, 440, 120, "Autoritativo\nuniversidad.example", "quaternary", { size: 30, mono: true }),
        arrow(MARGIN + 300, BODY_TOP + 340, MARGIN + 520, BODY_TOP + 340, { stroke: "secondary" }),
        arrow(MARGIN + 520, BODY_TOP + 400, MARGIN + 300, BODY_TOP + 400, { stroke: "primary" }),
        text(MARGIN + 310, BODY_TOP + 250, 200, 40, "1", { size: 30, mono: true, align: "center" }),
        text(MARGIN + 310, BODY_TOP + 420, 200, 40, "5", { size: 30, mono: true, align: "center" }),
        arrow(MARGIN + 880, BODY_TOP + 310, 1360, BODY_TOP + 90, { stroke: "muted-foreground", strokeWidth: 5 }),
        arrow(MARGIN + 880, BODY_TOP + 365, 1360, BODY_TOP + 365, { stroke: "muted-foreground", strokeWidth: 5 }),
        arrow(MARGIN + 880, BODY_TOP + 420, 1360, BODY_TOP + 640, { stroke: "muted-foreground", strokeWidth: 5 }),
        text(1130, BODY_TOP + 150, 80, 40, "2", { size: 30, mono: true }),
        text(1130, BODY_TOP + 310, 80, 40, "3", { size: 30, mono: true }),
        text(1130, BODY_TOP + 540, 80, 40, "4", { size: 30, mono: true }),
        text(MARGIN, BODY_TOP + 600, 880, 120, "1 y 5: consulta recursiva\n2 – 4: consultas iterativas", {
          size: 32,
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Tipos de registro DNS",
      notes: "MX vuelve en la diapositiva de correo. PTR es la resolución inversa.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          CONTENT_WIDTH,
          640,
          [
            ["Tipo", "Contiene", "Ejemplo"],
            ["A", "Dirección IPv4", "192.0.2.10"],
            ["AAAA", "Dirección IPv6", "2001:db8::10"],
            ["CNAME", "Alias", "web → www"],
            ["MX", "Servidor de correo", "10 correo.universidad.example"],
            ["NS", "Servidor autoritativo", "ns1.universidad.example"],
            ["TXT", "Texto (SPF, verificación)", "\"v=spf1 …\""],
            ["PTR", "IP → nombre", "10.2.0.192.in-addr.arpa"],
          ],
          { size: 30 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "HTTP: petición y respuesta",
      notes:
        "Señalar línea inicial, cabeceras, línea en blanco y cuerpo. Host es obligatoria en HTTP/1.1 (hosting virtual). HTTP no tiene estado: cookies y tokens.",
      body: [
        rect(MARGIN, BODY_TOP + 30, 820, 420, { fill: "muted", stroke: "secondary" }),
        text(MARGIN + 30, BODY_TOP + 60, 760, 360, "GET /index.html HTTP/1.1\nHost: www.universidad.example\nUser-Agent: Mozilla/5.0\nAccept: text/html", {
          size: 32,
          mono: true,
        }),
        rect(MARGIN + 860, BODY_TOP + 30, 820, 420, { fill: "muted", stroke: "primary" }),
        text(MARGIN + 890, BODY_TOP + 60, 760, 360, "HTTP/1.1 200 OK\nContent-Type: text/html\nContent-Length: 1256\nCache-Control: max-age=3600\n\n<!doctype html> …", {
          size: 32,
          mono: true,
        }),
        text(MARGIN, BODY_TOP + 480, 820, 50, "Petición", { size: 36, weight: 700, align: "center" }),
        text(MARGIN + 860, BODY_TOP + 480, 820, 50, "Respuesta", { size: 36, weight: 700, align: "center" }),
        text(MARGIN, BODY_TOP + 580, CONTENT_WIDTH, 60, "Petición-respuesta · sin estado · semántica en RFC 9110", {
          size: 34,
          align: "center",
          color: "muted-foreground",
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "Métodos y códigos de estado",
      notes: "Pedir que adivinen la clase de cada código antes de mostrarla: 404, 301, 503, 201.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 30,
          640,
          600,
          [
            ["Método", "Uso"],
            ["GET", "Obtener"],
            ["POST", "Enviar datos"],
            ["PUT", "Reemplazar"],
            ["PATCH", "Modificar parte"],
            ["DELETE", "Eliminar"],
          ],
          { size: 32 },
        ),
        table(
          MARGIN + 700,
          BODY_TOP + 30,
          980,
          600,
          [
            ["Clase", "Ejemplos"],
            ["2xx · éxito", "200 OK · 201 Created"],
            ["3xx · redirección", "301 · 304 Not Modified"],
            ["4xx · cliente", "403 Forbidden · 404 Not Found"],
            ["5xx · servidor", "500 · 503 Unavailable"],
          ],
          { size: 32 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Correo: enviar con SMTP, leer con IMAP",
      notes:
        "El servidor de Ana encuentra el de Luis con el registro MX. 587 = submission (con autenticación), 25 = entre servidores.",
      body: [
        ...box(MARGIN, BODY_TOP + 200, 300, 130, "Ana", "secondary", { size: 36 }),
        ...box(MARGIN + 460, BODY_TOP + 200, 340, 130, "Servidor\nde Ana", "primary", { size: 32 }),
        ...box(MARGIN + 960, BODY_TOP + 200, 340, 130, "Servidor\nde Luis", "primary", { size: 32 }),
        ...box(MARGIN + 1380, BODY_TOP + 200, 300, 130, "Luis", "secondary", { size: 36 }),
        arrow(MARGIN + 300, BODY_TOP + 265, MARGIN + 460, BODY_TOP + 265),
        arrow(MARGIN + 800, BODY_TOP + 265, MARGIN + 960, BODY_TOP + 265),
        arrow(MARGIN + 1380, BODY_TOP + 265, MARGIN + 1300, BODY_TOP + 265),
        text(MARGIN + 290, BODY_TOP + 120, 180, 80, "SMTP\n587", { size: 30, mono: true, align: "center" }),
        text(MARGIN + 790, BODY_TOP + 120, 180, 80, "SMTP\n25", { size: 30, mono: true, align: "center" }),
        text(MARGIN + 1250, BODY_TOP + 120, 180, 80, "IMAP\n993", { size: 30, mono: true, align: "center" }),
        text(MARGIN, BODY_TOP + 440, CONTENT_WIDTH, 60, "¿Dónde entrego? → registro MX del dominio de destino", {
          size: 36,
          align: "center",
        }),
        text(MARGIN, BODY_TOP + 520, CONTENT_WIDTH, 60, "SMTP RFC 5321 · IMAP RFC 9051 · POP3 RFC 1939", {
          size: 30,
          align: "center",
          color: "muted-foreground",
          mono: true,
        }),
      ],
    }),

    contentSlide(DECK, {
      title: "DHCP: Discover, Offer, Request, Ack",
      notes:
        "Discover y Request van por broadcast porque el cliente aún no tiene IP (y puede haber varios servidores). Sin respuesta → 169.254.x.x.",
      body: (() => {
        const left = MARGIN + 220;
        const right = 1580;
        const steps = [
          { label: "DISCOVER  (broadcast)", from: left, to: right, accent: "secondary" },
          { label: "OFFER  192.168.1.37", from: right, to: left, accent: "primary" },
          { label: "REQUEST  (broadcast)", from: left, to: right, accent: "secondary" },
          { label: "ACK  · 24 h", from: right, to: left, accent: "primary" },
        ] as const;
        return [
          ...box(left - 200, BODY_TOP + 10, 400, 110, "Cliente :68", "secondary", { size: 36, mono: true }),
          ...box(right - 200, BODY_TOP + 10, 400, 110, "Servidor :67", "primary", { size: 36, mono: true }),
          arrow(left, BODY_TOP + 120, left, BODY_TOP + 740, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
          arrow(right, BODY_TOP + 120, right, BODY_TOP + 740, { kind: "line", stroke: "muted-foreground", strokeWidth: 4 }),
          ...steps.flatMap((step, index) => {
            const y = BODY_TOP + 230 + index * 140;
            return [
              arrow(step.from, y, step.to, y, { stroke: step.accent }),
              text(left + 60, y - 60, right - left - 120, 50, step.label, { size: 34, mono: true, align: "center" }),
            ];
          }),
        ];
      })(),
    }),

    contentSlide(DECK, {
      title: "¿Qué pasa al escribir una URL?",
      notes:
        "El gran repaso del curso. Que cada grupo explique un paso y diga en qué capa ocurre. Volver a la pregunta de la primera sesión.",
      body: [
        table(
          MARGIN,
          BODY_TOP + 20,
          CONTENT_WIDTH,
          700,
          [
            ["#", "Qué ocurre", "Capa"],
            ["1", "DHCP ya dio IP, gateway y DNS", "Aplicación / UDP"],
            ["2", "ARP pide la MAC del gateway", "Acceso a la red"],
            ["3", "DNS resuelve el nombre", "Aplicación / UDP 53"],
            ["4", "Three-way handshake", "Transporte / TCP 443"],
            ["5", "Negociación TLS y certificado", "TLS 1.3"],
            ["6", "GET /  →  200 OK", "Aplicación / HTTP"],
            ["7", "Routers: prefijo más largo, TTL − 1", "Internet"],
          ],
          { size: 30 },
        ),
      ],
    }),

    contentSlide(DECK, {
      title: "Para llevar",
      notes: "Cierre del módulo. Anunciar el taller final: capturar la carga de una página y etiquetar cada paquete por capa.",
      body: [
        bullets(MARGIN, BODY_TOP + 20, CONTENT_WIDTH, [
          "La capa de aplicación define qué se dicen los programas.",
          "DNS traduce nombres a IP con una jerarquía y caché.",
          "HTTP: petición-respuesta sin estado; HTTPS = HTTP + TLS.",
          "Correo: SMTP envía, IMAP lee. DHCP configura con DORA.",
          "Una sola página web usa las cuatro capas del modelo.",
        ]),
      ],
    }),
  ];

  return {
    version: PRESENTATION_SCHEMA_VERSION,
    title: "Capa de aplicación",
    topic: "application-layer",
    mode: "markdown",
    markdown: MARKDOWN,
    notes:
      "Cierre de la unidad. Taller: cada grupo captura en Wireshark la carga de una página y etiqueta DHCP/ARP/DNS/TCP/TLS/HTTP con su capa. Evaluar con la tabla de la sección 7.",
    canvas: { ...STAGE },
    slides,
  };
}
