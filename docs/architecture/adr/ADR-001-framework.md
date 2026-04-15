# ADR-001: Astro + React con Islands Architecture como stack de frontend

**Estado:** Aceptado  
**Fecha:** 2026-04-14  
**Deciders:** Equipo TCP-TRIP

---

## Contexto

TCP-TRIP necesita renderizar contenido mixto: páginas informativas estáticas (explorador TCP/IP, landing page) y componentes altamente interactivos (constructor de protocolos con 27 sub-componentes, calculadoras reactivas, bandeja de mensajes). El equipo tiene 1-2 desarrolladores con conocimiento de React y TypeScript. El deploy se hace sobre un único servidor Bun.

Las opciones evaluadas fueron:

1. **Next.js + React** — SSR maduro, conocido por el equipo, soporte de React Server Components.
2. **Astro + React (Islands Architecture)** — SSR con hidratación selectiva; mínimo JS en el cliente para páginas estáticas.
3. **SvelteKit** — Excelente rendimiento, pero equipo sin experiencia previa; curva de aprendizaje alta.
4. **SPA pura (Vite + React)** — Sin SSR; SEO limitado; todo el JS se envía al cliente siempre.

La decisión ya fue tomada al iniciar el proyecto (el código base existe con Astro 6.1.4). Este ADR documenta la justificación de esa elección.

---

## Decisión

Se usa **Astro 6 (SSR) con React 19 como renderer de islands**.

Las páginas informativas y de contenido se implementan como componentes Astro puros (sin JavaScript en el cliente). Los componentes que requieren interactividad (ProtocolBuilder, Ipv4Calculator, MessagesView, MyProtocolsList) se implementan en React y se montan como islands con `client:load` o `client:idle`.

El adaptador de deploy es `@astrojs/node` en modo `standalone`, ejecutado sobre el runtime de Bun.

---

## Consecuencias

### Positivas

- **Menor JavaScript al cliente:** Las páginas de contenido TCP/IP, la landing y las herramientas simples no envían ningún bundle React al navegador. Esto mejora los tiempos de carga y la experiencia en conexiones lentas (contexto universitario, AS-001).
- **SSR por defecto:** Todas las páginas se renderizan en el servidor, lo que permite verificar autenticación y rol antes de enviar HTML al cliente (P-005 — autenticación siempre en servidor primero).
- **Compatibilidad con Clerk:** `@clerk/astro` tiene integración nativa con Astro SSR y provee el middleware `clerkMiddleware()` que opera en el borde de cada request.
- **Colocación natural por islands:** Cada sección interactiva es un island independiente. Esto facilita la localización de bugs y el testing individual de componentes.
- **Flexibilidad de rendering:** Astro permite mezclar SSR y contenido estático en la misma página sin configuración adicional (TC-001).

### Negativas / Trade-offs

- **Hidratación duplicada de estado:** Los datos iniciales del servidor deben pasarse como props al island React, y el island puede necesitar refetchar los mismos datos si el usuario hace mutaciones. Esto es un patrón aceptable pero requiere disciplina (ver `frontend-architecture.md`, sección 5.2).
- **Comunicación entre islands:** Dos islands React en la misma página no pueden compartir estado de React directamente (cada island es un árbol React independiente). Se requieren `nanostores` para estado compartido entre islands. Para TCP-TRIP, este caso es raro: cada página tiene típicamente un solo island principal.
- **Ecosistema más pequeño que Next.js:** Astro tiene menos integrations de terceros que Next.js. Para este proyecto no es limitante dado el stack definido.
- **Versión mayor reciente (Astro 6):** Al ser una versión mayor reciente, puede haber cambios de API. Se recomienda fijar la versión exacta en `package.json` y no actualizar hasta que la versión sea estable con el ecosistema Clerk.

### Riesgos

- **TC-007 — React 19:** Algunas librerías de componentes (Radix, Headless UI, etc.) pueden no tener soporte estable para React 19. Verificar compatibilidad antes de instalar cualquier librería de UI adicional.
- **Compatibilidad `@astrojs/node` + Bun:** El adaptador usa Node.js bajo el capó; Bun tiene compatibilidad con la mayoría de APIs de Node.js pero no todas. Validar el comportamiento de `Bun.sql` cuando se invoca desde handlers de Astro.

---

## Alternativas Evaluadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Next.js 15 | Hubiera sido válido. Astro fue elegido por su postura de "cero JS por defecto" que encaja mejor con el mix de contenido estático/interactivo de TCP-TRIP. Cambiar ahora tendría un costo alto sin beneficio proporcional. |
| SvelteKit | El equipo no tiene experiencia previa. El costo de aprendizaje en un proyecto con plazo académico fijo no es justificable (PR-001, PR-002). |
| SPA pura | Elimina SSR y con ello la posibilidad de verificar autenticación en servidor. El middleware de Clerk requiere SSR para operar. |
