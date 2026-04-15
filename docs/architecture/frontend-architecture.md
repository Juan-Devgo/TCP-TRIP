# Arquitectura de Frontend — TCP-TRIP

**Versión:** 1.1  
**Fecha:** 2026-04-14  
**Estado:** Aceptado  
**Motiva:** TC-001, TC-006, TC-007, UX-001, UX-002, UX-004

---

## 1. Estrategia de Islands en Astro

Astro renderiza páginas en el servidor por defecto. Los componentes que necesitan interactividad en el cliente se "hidratan" usando directivas de cliente. El resultado es que solo el JavaScript necesario llega al navegador.

### 1.1 Mapa de Islands

| Componente | Directiva | Razón |
|------------|-----------|-------|
| `ProtocolBuilder.tsx` | `client:load` | Editor complejo con estado de múltiples campos; necesita ser interactivo desde el primer render. |
| `HeaderCreator.tsx` | `client:load` | Editor de valores de cabecera; idéntica razón. |
| `MyProtocolsList.tsx` | `client:load` | Acciones CRUD requieren estado inmediato (carga, elimina, comparte). |
| `MessagesView.tsx` | `client:load` | Bandeja de mensajes con tabs y acciones de lectura. |
| `Ipv4Calculator.tsx` | `client:load` | Calculadora reactiva: recalcula en cada keystroke. |
| Badge de mensajes no leídos | `client:idle` | No es crítico para la carga inicial; puede hidratarse cuando el navegador está libre. |

**Componentes que NO son islands (sin directiva):**

- `LandingPage.astro` — HTML puro generado en servidor.
- `*Layer.astro` (AppLayer, TransportLayer, etc.) — Contenido pedagógico estático.
- `NumberBaseConverter.astro` — Conversor simple implementado con `<script>` vanilla.
- `AsciiConverter.astro` — Ídem.
- `Navbar.astro` — Se renderiza en el servidor; el menú hamburguesa usa `<script>` vanilla mínimo.
- Páginas de admin (V2.0) — Formularios de aprobación simples; se implementan en Astro puro con `<form>` nativas.

### 1.2 Reglas de uso de directivas

```
client:load   → Usar cuando la interactividad es necesaria desde que el usuario ve el componente.
client:idle   → Usar para componentes no críticos (badges, tooltips, notificaciones).
client:visible → Reservar para componentes en scroll largo (not applicable en V1.0).
client:only   → Evitar salvo que el componente use APIs de navegador sin equivalente en servidor.
               Si se usa, especificar el renderer: client:only="react".
```

---

## 2. Gestión de Estado

### 2.1 Árbol de decisión

```
¿El estado necesita persistir entre navegaciones de página?
├── Sí → ¿Es estado del servidor (datos en BD)?
│         ├── Sí → fetch() a API Route. Estado local en el componente (useState).
│         └── No → nanostores (estado de UI global: idioma, modo clase futuro)
└── No  → ¿El estado es compartido entre múltiples sub-componentes del mismo island?
           ├── Sí → useState / useReducer en el componente raíz del island, pasado por props.
           └── No → useState local en el componente hoja.
```

### 2.2 Estado con nanostores

`nanostores` ya está instalado (`@nanostores/react`). Se usa para estado global de UI que debe persistir entre renders de islands y no requiere backend.

**Stores actuales / propuestos:**

```typescript
// src/stores/ui.ts
import { atom } from 'nanostores';

// Idioma activo (derivado de la URL, no se persiste en nanostores)
// Se pasa como prop desde el servidor Astro al componente React.
// nanostores NO gestiona el idioma — Astro lo hace mediante rutas /es/*.

// V2.0: Modo Clase
export const classModeStore = atom<boolean>(false);
```

**Qué NO va en nanostores:**
- Datos del usuario (nombre, email) — obtener desde `locals.auth()` en el servidor o desde Clerk's `useUser()` hook en el cliente.
- Listas de protocolos, mensajes — son server state, se obtienen con `fetch()`.
- Estado de formularios — `useState` local en el componente.

### 2.3 Server State (fetch desde components React)

Los componentes React que necesitan datos de la BD hacen `fetch()` a las API Routes internas. Patrón:

```typescript
// Patrón estándar en los islands de TCP-TRIP
const [protocols, setProtocols] = useState<Protocol[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  fetch('/api/protocols')
    .then(res => res.ok ? res.json() : Promise.reject(res.status))
    .then(data => setProtocols(data))
    .catch(() => setError('Error cargando protocolos'))
    .finally(() => setLoading(false));
}, []);
```

No se introduce React Query, SWR ni similar en V1.0–V2.0 para mantener el stack simple (YAGNI). Si el polling de mensajes no leídos se vuelve complejo, se evaluará en V2.0.

---

## 3. Estructura de Carpetas

### 3.1 Estructura actual (código base heredado)

```
src/
├── components/
│   ├── ProtocolBuilder/       ← bien organizado por dominio
│   ├── HeaderCreator/         ← bien organizado por dominio
│   ├── Messages/              ← bien organizado por dominio
│   ├── MyProtocols/           ← bien organizado por dominio
│   ├── icons/                 ← bien; consolidar en shared
│   ├── AppLayer.astro         ← PROBLEMA: componentes de dominio en raíz de components/
│   ├── AsciiConverter.astro   ← PROBLEMA: ídem
│   ├── LandingPage.astro      ← aceptable en raíz
│   └── ...
├── i18n/
│   └── translations.ts
├── layouts/
│   ├── Layout.astro           ← actualmente para rutas raíz (EN); debe ser ES — ver D-01
│   └── es/Layout.astro        ← estructura inconsistente con el resto de pages/
├── lib/
│   ├── db.ts                  ← DEPRECAR: better-sqlite3
│   └── links/navLinks.ts
├── actions/                   ← directorio vacío
├── services/                  ← directorio vacío
├── ui/                        ← Navbar, Footer, etc. (fuera de components/)
├── middleware.ts
├── pages/
│   ├── api/                   ← bien organizado
│   ├── es/                    ← actualmente rutas EN ES (debe ser /en/ — ver D-01)
│   └── ...
├── styles/global.css
└── types/
    └── ProtocolBuilder.ts
```

### 3.2 Estructura objetivo (P-001 — validada D-03)

La estructura objetivo organiza el código **por dominio** de negocio. El plan de migración completo con tabla de archivos a mover y path aliases está en `docs/architecture/directory-structure.md`.

```
src/
├── domains/
│   ├── protocols/
│   │   ├── components/
│   │   │   ├── ProtocolBuilder/     ← mover desde src/components/ProtocolBuilder/
│   │   │   │   └── [27 sub-componentes .tsx]
│   │   │   └── HeaderCreator/       ← mover desde src/components/HeaderCreator/
│   │   ├── api/                     ← mover desde src/pages/api/protocols/
│   │   │   ├── index.ts
│   │   │   ├── [id]/index.ts
│   │   │   ├── [id]/share.ts
│   │   │   └── shared/[shareCode].ts
│   │   └── types.ts                 ← mover desde src/types/ProtocolBuilder.ts
│   ├── messages/
│   │   ├── components/
│   │   │   └── Messages/            ← mover desde src/components/Messages/
│   │   │       └── MessagesView.tsx
│   │   └── api/                     ← mover desde src/pages/api/messages/
│   │       ├── index.ts
│   │       └── [id]/read.ts
│   ├── my-protocols/
│   │   └── components/
│   │       └── MyProtocols/         ← mover desde src/components/MyProtocols/
│   │           └── MyProtocolsList.tsx
│   ├── tools/
│   │   └── components/
│   │       ├── AsciiConverter.astro ← mover desde src/components/
│   │       ├── NumberBaseConverter.astro
│   │       └── Ipv4Calculator.tsx
│   ├── tcpip/
│   │   └── components/
│   │       ├── AppLayer.astro       ← mover desde src/components/
│   │       ├── TransportLayer.astro
│   │       ├── NetworkLayer.astro
│   │       ├── DataLinkLayer.astro
│   │       └── PhysicalLayer.astro
│   └── admin/                       ← NUEVO (V2.0)
│       ├── components/
│       └── api/                     ← mover desde src/pages/api/admin/ (V2.0)
├── shared/
│   ├── ui/                          ← mover desde src/ui/
│   │   ├── Navbar.astro
│   │   ├── Footer.astro
│   │   ├── CopyButton.astro
│   │   └── ...
│   ├── icons/                       ← mover desde src/components/icons/
│   ├── layouts/
│   │   ├── Layout.astro             ← layout base en español (canónico — D-01)
│   │   └── LayoutEn.astro           ← layout base en inglés
│   ├── i18n/
│   │   └── translations.ts          ← mover desde src/i18n/
│   ├── lib/
│   │   ├── sql.ts                   ← NUEVO: reemplaza db.ts con Bun.sql
│   │   ├── retry.ts                 ← NUEVO: withRetry() para resiliencia (D-02)
│   │   └── links/navLinks.ts
│   ├── stores/
│   │   └── ui.ts                    ← NUEVO: nanostores de UI global
│   └── types/
│       └── api.ts                   ← NUEVO: interfaces de respuesta de API
├── pages/                           ← Solo orchestration — páginas Astro delgadas
│   ├── index.astro                  ← Landing ES (canónica — D-01)
│   ├── tcp-ip/
│   ├── converters/
│   ├── calculators/
│   ├── protocol-creator/
│   ├── my-protocols/
│   ├── messages/
│   ├── protocols/[shareCode]/
│   ├── admin/ (V2.0)
│   ├── api/                         ← re-exportan handlers desde domains/*/api/
│   │   ├── protocols/
│   │   ├── messages/
│   │   ├── users/
│   │   └── admin/ (V2.0)
│   └── en/                          ← Rutas EN alternativas (D-01)
│       ├── index.astro
│       ├── tcp-ip/
│       ├── converters/
│       ├── calculators/
│       ├── protocol-creator/
│       ├── my-protocols/
│       ├── messages/
│       └── protocols/[shareCode]/
├── middleware.ts
└── styles/
    └── global.css
```

**Principios de la estructura objetivo:**
- `domains/` contiene todo el código específico de un dominio de negocio: componentes, handlers de API y tipos propios.
- `shared/` contiene código reutilizable entre dominios: UI genérica, utilidades, i18n, layouts.
- `pages/` contiene exclusivamente páginas Astro de orquestación. No contiene lógica de negocio.
- Los handlers de API en `src/pages/api/` importan desde `src/domains/*/api/` para mantener la lógica fuera del router de Astro.

**Nota sobre `actions/` y `services/`:** Los directorios `src/actions/` y `src/services/` actuales están vacíos. No se migran a la nueva estructura; simplemente desaparecen. Si en V2.0 se necesita lógica de servicio compartida entre dominios, se ubica en `src/shared/lib/`.

---

## 4. Convenciones de Naming

### 4.1 Archivos y carpetas

| Tipo | Convención | Ejemplo |
|------|------------|---------|
| Componentes React (`.tsx`) | PascalCase | `ProtocolBuilder.tsx`, `FieldRow.tsx` |
| Componentes Astro (`.astro`) | PascalCase | `AppLayer.astro`, `Navbar.astro` |
| Páginas Astro (`.astro`) | kebab-case o camelCase (convención Astro) | `index.astro`, `base-converter.astro` |
| API Routes (`.ts`) | kebab-case o `index.ts` | `index.ts`, `share.ts`, `read.ts` |
| Carpetas de dominio | PascalCase | `ProtocolBuilder/`, `Messages/` |
| Carpetas de infraestructura | camelCase | `lib/`, `styles/`, `stores/` |
| Stores | camelCase + sufijo `Store` | `uiStore.ts`, `classModeStore` |
| Tipos TypeScript | PascalCase para interfaces, camelCase para type aliases simples | `ProtocolField`, `FieldType` |

### 4.2 Variables y funciones

- Variables y funciones: `camelCase`.
- Constantes exportadas inmutables: `UPPER_SNAKE_CASE` (solo para config y env).
- Hooks React: prefijo `use` + PascalCase: `useProtocolForm`, `useMessages`.
- Handlers de eventos: prefijo `handle` + descripción: `handleFieldAdd`, `handleSubmit`.

### 4.3 Claves de i18n

Formato jerárquico con namespace por sección:

```typescript
// Correcto
t('nav.myProtocols')
t('protocolBuilder.addField')
t('messages.inbox.empty')

// Incorrecto — demasiado plano
t('myProtocolsNavLink')
t('addFieldButton')
```

---

## 5. Autenticación en el Cliente (Clerk + Astro)

### 5.1 En componentes Astro (servidor)

```astro
---
// En el frontmatter de una página Astro
const { userId, isAuthenticated } = Astro.locals.auth();
if (!isAuthenticated) {
  return Astro.redirect('/sign-in');
}
---
```

Los datos del usuario disponibles en el servidor via `Astro.locals.auth()` son: `userId`, `sessionId`, `getToken()`. El perfil completo (nombre, email) requiere una llamada separada a `clerkClient`.

### 5.2 En componentes React (cliente)

Clerk provee hooks de React vía `@clerk/astro`:

```tsx
import { useUser, useAuth, SignedIn, SignedOut } from '@clerk/astro/react';

// Obtener estado de autenticación
const { userId, isLoaded } = useAuth();

// Obtener perfil del usuario
const { user } = useUser();

// Renderizado condicional
<SignedIn><ProtectedContent /></SignedIn>
<SignedOut><LoginPrompt /></SignedOut>
```

**Patrón para pasar datos del servidor al island:** En lugar de hacer refetch en el cliente, preferir pasar datos iniciales como props desde Astro:

```astro
---
const { userId } = Astro.locals.auth();
const protocols = await fetchProtocolsFromDB(userId);
---
<MyProtocolsList client:load initialProtocols={protocols} />
```

Esto evita un segundo fetch en el cliente y mejora el tiempo de primera carga con datos. El componente React puede actualizar su estado vía fetch si el usuario realiza acciones CRUD.

### 5.3 Rutas protegidas por Clerk

El middleware actual (`clerkMiddleware()`) verifica la autenticación. Las páginas que requieren autenticación deben redirigir al usuario no autenticado en su frontmatter:

```astro
---
// Patrón estándar para páginas autenticadas
const auth = Astro.locals.auth();
if (!auth.userId) {
  return Astro.redirect('/sign-in');
}
---
```

---

## 6. Internacionalización (i18n)

### 6.1 Cómo funciona el sistema de i18n

Astro gestiona i18n mediante **file-based routing**: las rutas en inglés tienen su espejo bajo `/en/`. No se usa ninguna librería de i18n externa.

**Configuración objetivo (D-01 — español canónico):**

```
/           → español (canónico — defaultLocale: "es" en astro.config.mjs)
/en/        → inglés (alternativo)
/tcp-ip/    → español
/en/tcp-ip/ → inglés
```

**Cambios requeridos en el código:**
- `astro.config.mjs`: cambiar `defaultLocale: "en"` a `defaultLocale: "es"`.
- `src/i18n/translations.ts`: confirmar `defaultLang = 'es'` (ya está correcto).
- Renombrar la carpeta `src/pages/es/` a `src/pages/en/` (las rutas que allí estaban en español pasan a ser las canónicas bajo la raíz; las del subdirectorio pasan a ser la variante inglesa).

### 6.2 Patrón para componentes Astro

```astro
---
import { getLangFromUrl, useTranslations } from '../../i18n/translations';

const lang = getLangFromUrl(Astro.url);
const t = useTranslations(lang);
---

<h1>{t('hero.title')}</h1>
```

**Nota:** Las funciones `getLangFromUrl` y `useTranslations` deben implementarse/verificarse en `src/i18n/translations.ts`. Si no existen aún, deben crearse como parte de T-001.

### 6.3 Patrón para componentes React (islands)

El componente Astro que monta el island pasa el idioma como prop:

```astro
---
const lang = getLangFromUrl(Astro.url);
---
<ProtocolBuilder client:load lang={lang} />
```

El componente React recibe `lang` como prop y lo usa para mostrar texto internacionalizado. Los componentes React **no pueden detectar el idioma desde la URL** de forma confiable en el cliente si la URL puede cambiar; el prop es la fuente de verdad.

### 6.4 Convenciones para nuevas cadenas

1. Toda nueva cadena se agrega primero en `translations.ts` bajo la namespace correcta (e.g., `messages`, `admin`, `profile`).
2. Siempre se agregan las dos versiones: `es` y `en` simultáneamente.
3. Usar el tipo de retorno de `useTranslations` para verificar que no faltan claves (TypeScript inferirá el shape del objeto de traducción).
4. Nunca usar strings hardcodeados en componentes. No hay excepciones.

### 6.5 Cobertura bilingüe obligatoria por versión

| Versión | Secciones a cubrir |
|---------|--------------------|
| V1.0 | Landing, Navbar, TCP/IP Explorer, Herramientas, Constructor de Protocolos, Mis Protocolos |
| V1.1 | Mensajes (bandeja entrada, enviados, composición) |
| V2.0 | Panel Admin, Perfil (solicitud de rol), Modo Clase |

---

## 7. Modo Clase / Presentación (V2.0) — Propuesta Técnica

El Modo Clase es una capa de presentación sobre la UI existente que adapta la interfaz para proyección. No requiere cambios en la BD ni en las APIs (según E-005).

### 7.1 Mecanismo propuesto: Query param `?mode=class`

```
/tcp-ip/AppLayer?mode=class       → Modo clase EN
/es/tcp-ip/AppLayer?mode=class    → Modo clase ES
```

**Ventajas:**
- Sin estado adicional en servidor ni cliente.
- URL compartible: el docente puede preparar sus URLs antes de clase.
- Compatible con el sistema de i18n existente.
- No afecta la experiencia de otros usuarios.

**Implementación:**
1. En el layout Astro, leer `Astro.url.searchParams.get('mode')`.
2. Si `mode === 'class'`, agregar clase CSS `class-mode` al elemento `<body>`.
3. Con Tailwind/CSS: sobreescribir variables de diseño para `class-mode`:

```css
/* global.css */
body.class-mode {
  --font-size-base: 1.25rem;   /* 20px mínimo */
  --navbar-visible: none;      /* Ocultar navbar */
  --sidebar-visible: none;     /* Ocultar sidebars secundarios */
}
```

4. Agregar controles de navegación entre "diapositivas" (anterior/siguiente página de la misma sección) visibles solo en `class-mode`.

### 7.2 Restricción de acceso

Solo usuarios con rol `teacher` pueden activar el modo clase. El middleware verifica el rol al detectar `?mode=class`. Si un usuario sin rol `teacher` intenta acceder con ese parámetro, se ignora el parámetro (no se activa el modo, no se muestra error — degradación silenciosa).

### 7.3 Nanostore para modo clase

No aplica. El mecanismo definitivo es el query param `?mode=class` (Q-classmodeurl resuelta). No se usa nanostore para esta funcionalidad.

---

## 8. Preguntas Resueltas

| ID | Resolución |
|----|------------|
| Q-classmodeurl | **Resuelta:** El Modo Clase se activa exclusivamente via query param `?mode=class` en la URL. El nanostore no se usa para este propósito. |
| Q-003 | **Resuelta:** El Modo Clase no necesita funcionar offline. Se asume conectividad estable en aula (AS-009). No se implementa Service Worker. |

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial |
| 1.1 | 2026-04-14 | D-01: configuración de idioma canónico español. D-03: estructura de directorios por dominio (objetivo P-001). Resolución de TC-conflicto-defaultLocale. |
| 1.2 | 2026-04-15 | Q-classmodeurl resuelta: query param `?mode=class`. Q-003 resuelta: sin modo offline. |
