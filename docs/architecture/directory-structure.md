# Estructura de Directorios por Dominio — TCP-TRIP (P-001)

**Versión:** 1.0  
**Fecha:** 2026-04-14  
**Estado:** Aceptado — pendiente de implementación por el desarrollador  
**Motiva:** P-002 (organización por dominio), D-03 (decisión validada)  
**Relacionado con:** `frontend-architecture.md`, `overview.md`

---

## 1. Objetivo

Migrar la estructura actual de `src/` desde una organización **por tipo técnico** (`components/`, `ui/`, `lib/`) a una organización **por dominio de negocio** (`domains/protocols/`, `domains/messages/`, etc.).

**Problema que resuelve:** Actualmente, para trabajar en la funcionalidad de mensajes, el desarrollador debe navegar entre `src/components/Messages/`, `src/pages/api/messages/`, `src/pages/messages/` y `src/types/`. Con la nueva estructura, todo lo relativo a mensajes está bajo `src/domains/messages/`.

**Principio:** Cada dominio es autónomo en su código. El acoplamiento entre dominios ocurre solo a través de `src/shared/`.

---

## 2. Estructura Objetivo Completa

```
tcp-trip/
└── src/
    ├── domains/
    │   ├── protocols/
    │   │   ├── components/
    │   │   │   ├── ProtocolBuilder/          ← mover de src/components/ProtocolBuilder/
    │   │   │   │   ├── ProtocolBuilder.tsx
    │   │   │   │   └── [todos los sub-componentes .tsx]
    │   │   │   └── HeaderCreator/            ← mover de src/components/HeaderCreator/
    │   │   │       └── HeaderCreator.tsx
    │   │   ├── api/                          ← mover de src/pages/api/protocols/
    │   │   │   ├── index.ts                  (GET lista, POST crear)
    │   │   │   ├── [id]/
    │   │   │   │   ├── index.ts              (GET uno, PUT actualizar, DELETE)
    │   │   │   │   └── share.ts              (POST compartir)
    │   │   │   └── shared/
    │   │   │       └── [shareCode].ts        (GET protocolo público)
    │   │   └── types.ts                      ← mover de src/types/ProtocolBuilder.ts
    │   │
    │   ├── messages/
    │   │   ├── components/
    │   │   │   └── Messages/                 ← mover de src/components/Messages/
    │   │   │       └── MessagesView.tsx
    │   │   └── api/                          ← mover de src/pages/api/messages/
    │   │       ├── index.ts                  (GET bandeja, POST enviar)
    │   │       └── [id]/
    │   │           └── read.ts               (PUT marcar leído)
    │   │
    │   ├── my-protocols/
    │   │   └── components/
    │   │       └── MyProtocols/              ← mover de src/components/MyProtocols/
    │   │           └── MyProtocolsList.tsx
    │   │
    │   ├── tools/
    │   │   └── components/
    │   │       ├── AsciiConverter.astro      ← mover de src/components/
    │   │       ├── NumberBaseConverter.astro ← mover de src/components/
    │   │       └── Ipv4Calculator.tsx        ← mover de src/components/
    │   │
    │   ├── tcpip/
    │   │   └── components/
    │   │       ├── AppLayer.astro            ← mover de src/components/
    │   │       ├── TransportLayer.astro      ← mover de src/components/
    │   │       ├── NetworkLayer.astro        ← mover de src/components/
    │   │       ├── DataLinkLayer.astro       ← mover de src/components/
    │   │       └── PhysicalLayer.astro       ← mover de src/components/
    │   │
    │   └── admin/                            ← NUEVO (V2.0)
    │       ├── components/                   (componentes del panel admin)
    │       └── api/                          (handlers de /api/admin/*)
    │
    ├── shared/
    │   ├── ui/                               ← mover de src/ui/
    │   │   ├── Navbar.astro
    │   │   ├── Footer.astro
    │   │   ├── CopyButton.astro
    │   │   ├── DataTable.astro
    │   │   ├── NavDropdown.astro
    │   │   ├── Select.astro
    │   │   └── Social.astro
    │   ├── icons/                            ← mover de src/components/icons/
    │   ├── layouts/
    │   │   ├── Layout.astro                  ← renombrar/mover de src/layouts/Layout.astro
    │   │   │                                   (layout base ES — idioma canónico)
    │   │   └── LayoutEn.astro                ← renombrar/mover de src/layouts/es/Layout.astro
    │   │                                       (layout base EN — idioma alternativo)
    │   ├── i18n/
    │   │   └── translations.ts               ← mover de src/i18n/
    │   ├── lib/
    │   │   ├── sql.ts                        ← NUEVO: cliente Bun.sql (reemplaza db.ts)
    │   │   ├── retry.ts                      ← NUEVO: withRetry() para resiliencia (D-02)
    │   │   ├── reconcile.ts                  ← NUEVO: reconcileRoleRequests() (D-02)
    │   │   └── links/
    │   │       └── navLinks.ts               ← mover de src/lib/links/
    │   ├── stores/
    │   │   └── ui.ts                         ← NUEVO: nanostores de UI global
    │   └── types/
    │       └── api.ts                        ← NUEVO: interfaces de respuesta de API
    │
    ├── pages/                                ← Solo orchestration: páginas delgadas
    │   ├── index.astro                       (Landing ES — canónica D-01)
    │   ├── tcp-ip/
    │   │   ├── index.astro
    │   │   └── [capa].astro
    │   ├── converters/
    │   │   └── index.astro
    │   ├── calculators/
    │   │   └── index.astro
    │   ├── protocol-creator/
    │   │   └── index.astro
    │   ├── my-protocols/
    │   │   └── index.astro
    │   ├── messages/
    │   │   └── index.astro
    │   ├── protocols/
    │   │   └── [shareCode].astro
    │   ├── admin/ (V2.0)
    │   ├── api/
    │   │   ├── protocols/                    ← re-exportan desde domains/protocols/api/
    │   │   ├── messages/                     ← re-exportan desde domains/messages/api/
    │   │   ├── users/
    │   │   └── admin/ (V2.0)
    │   └── en/                               ← Rutas EN (alternativas — D-01)
    │       ├── index.astro
    │       ├── tcp-ip/
    │       ├── converters/
    │       ├── calculators/
    │       ├── protocol-creator/
    │       ├── my-protocols/
    │       ├── messages/
    │       └── protocols/[shareCode].astro
    │
    ├── middleware.ts                         ← no se mueve
    └── styles/
        └── global.css                        ← no se mueve
```

---

## 3. Tabla de Migración de Archivos

Esta tabla describe cada movimiento de archivo. El desarrollador la usa como checklist durante P-001.

| Archivo actual | Destino | Notas |
|----------------|---------|-------|
| `src/components/ProtocolBuilder/` (carpeta completa) | `src/domains/protocols/components/ProtocolBuilder/` | Mover toda la carpeta |
| `src/components/HeaderCreator/` (carpeta completa) | `src/domains/protocols/components/HeaderCreator/` | Mover toda la carpeta |
| `src/components/Messages/` (carpeta completa) | `src/domains/messages/components/Messages/` | Mover toda la carpeta |
| `src/components/MyProtocols/` (carpeta completa) | `src/domains/my-protocols/components/MyProtocols/` | Mover toda la carpeta |
| `src/components/AsciiConverter.astro` | `src/domains/tools/components/AsciiConverter.astro` | Mover archivo |
| `src/components/NumberBaseConverter.astro` | `src/domains/tools/components/NumberBaseConverter.astro` | Mover archivo |
| `src/components/Ipv4Calculator.tsx` | `src/domains/tools/components/Ipv4Calculator.tsx` | Mover archivo |
| `src/components/AppLayer.astro` | `src/domains/tcpip/components/AppLayer.astro` | Mover archivo |
| `src/components/TransportLayer.astro` | `src/domains/tcpip/components/TransportLayer.astro` | Mover archivo |
| `src/components/NetworkLayer.astro` | `src/domains/tcpip/components/NetworkLayer.astro` | Mover archivo |
| `src/components/DataLinkLayer.astro` | `src/domains/tcpip/components/DataLinkLayer.astro` | Mover archivo |
| `src/components/PhysicalLayer.astro` | `src/domains/tcpip/components/PhysicalLayer.astro` | Mover archivo |
| `src/components/LandingPage.astro` | `src/shared/ui/LandingPage.astro` | Mover archivo |
| `src/components/TcpIp.astro` | `src/domains/tcpip/components/TcpIp.astro` | Mover archivo |
| `src/components/icons/` (carpeta completa) | `src/shared/icons/` | Mover toda la carpeta |
| `src/ui/Navbar.astro` | `src/shared/ui/Navbar.astro` | Mover archivo |
| `src/ui/Footer.astro` | `src/shared/ui/Footer.astro` | Mover archivo |
| `src/ui/CopyButton.astro` | `src/shared/ui/CopyButton.astro` | Mover archivo |
| `src/ui/DataTable.astro` | `src/shared/ui/DataTable.astro` | Mover archivo |
| `src/ui/NavDropdown.astro` | `src/shared/ui/NavDropdown.astro` | Mover archivo |
| `src/ui/Select.astro` | `src/shared/ui/Select.astro` | Mover archivo |
| `src/ui/Social.astro` | `src/shared/ui/Social.astro` | Mover archivo |
| `src/layouts/Layout.astro` | `src/shared/layouts/Layout.astro` | Mover archivo (layout base ES) |
| `src/layouts/es/Layout.astro` | `src/shared/layouts/LayoutEn.astro` | Mover y renombrar (ahora es el layout EN) |
| `src/i18n/translations.ts` | `src/shared/i18n/translations.ts` | Mover archivo |
| `src/lib/db.ts` | Eliminar | Reemplazado por `src/shared/lib/sql.ts` |
| `src/lib/links/navLinks.ts` | `src/shared/lib/links/navLinks.ts` | Mover archivo |
| `src/types/ProtocolBuilder.ts` | `src/domains/protocols/types.ts` | Mover y renombrar |
| `src/pages/api/protocols/` (carpeta completa) | `src/domains/protocols/api/` | Mover toda la carpeta; en pages/api/protocols/ queda solo re-export |
| `src/pages/api/messages/` (carpeta completa) | `src/domains/messages/api/` | Mover toda la carpeta; ídem |
| `src/pages/es/` (carpeta completa) | `src/pages/en/` | Renombrar carpeta — estas rutas son ahora el idioma alternativo EN (D-01) |
| `src/actions/` | Eliminar | Directorio vacío |
| `src/services/` | Eliminar | Directorio vacío |

**Archivos que NO se mueven:**
- `src/middleware.ts`
- `src/styles/global.css`
- `src/pages/index.astro` y demás páginas de orchestration bajo `src/pages/`
- `src/pages/api/users/`

---

## 4. Reglas de Qué Va Dónde

### 4.1 ¿Código de dominio o código compartido?

Una pieza de código va en `domains/X/` si cumple **todas** estas condiciones:
1. Solo la usa el dominio X (no la importa ningún otro dominio directamente).
2. Representa lógica, UI o datos del negocio de X.
3. Si desaparece el dominio X, este código desaparece con él.

Una pieza de código va en `shared/` si:
- La usan dos o más dominios.
- Es infraestructura transversal (SQL, retry, layouts, i18n).
- Es un componente de UI genérico (Navbar, botones, tablas) sin lógica de negocio.

### 4.2 ¿Componente de dominio o página de orchestration?

- `domains/X/components/`: contiene los componentes React (`.tsx`) y Astro (`.astro`) con la lógica del dominio.
- `pages/`: contiene páginas Astro delgadas que importan y montan componentes de dominio. Las páginas no contienen lógica de negocio; solo configuran el layout, pasan props del servidor y montan el island correcto.

**Ejemplo correcto:**

```astro
---
// src/pages/messages/index.astro — página de orchestration
import Layout from '../../shared/layouts/Layout.astro';
import MessagesView from '../../domains/messages/components/Messages/MessagesView';
const auth = Astro.locals.auth();
if (!auth.userId) return Astro.redirect('/sign-in');
---
<Layout lang="es">
  <MessagesView client:load userId={auth.userId} />
</Layout>
```

### 4.3 ¿API handler en domains/ o en pages/api/?

Los handlers de API con lógica de negocio (consultas a BD, validaciones) viven en `domains/X/api/`. Las rutas en `pages/api/` son shims delgados que re-exportan el handler del dominio:

```typescript
// src/pages/api/protocols/index.ts — shim de re-export
export { GET, POST } from '../../../domains/protocols/api/index';
```

Esto permite que los handlers sean testables de forma independiente al router de Astro.

### 4.4 ¿Tipos en domains/ o en shared/types/?

- Tipos de dominio (e.g., `ProtocolField`, `MessageItem`): van en `domains/X/types.ts`.
- Tipos compartidos entre dominios (e.g., interfaces de respuesta de API genéricas): van en `shared/types/api.ts`.
- Nunca crear un directorio `types/` global para tipos de dominio.

---

## 5. Importaciones y Path Aliases

Configurar los siguientes aliases en `tsconfig.json` para evitar imports relativos largos:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@domains/*": ["src/domains/*"],
      "@shared/*": ["src/shared/*"],
      "@pages/*": ["src/pages/*"]
    }
  }
}
```

**Uso en el código:**

```typescript
// Correcto — con alias
import { MessagesView } from '@domains/messages/components/Messages/MessagesView';
import { sql } from '@shared/lib/sql';
import { useTranslations } from '@shared/i18n/translations';

// Incorrecto — imports relativos largos
import { sql } from '../../../../shared/lib/sql';
```

**Nota:** Astro respeta la configuración de `tsconfig.json` para aliases. Verificar que `astro.config.mjs` no requiera configuración adicional de `vite.resolve.alias` para los mismos paths.

---

## 6. Convenciones de Naming por Carpeta

| Carpeta | Convención de archivos | Ejemplo |
|---------|----------------------|---------|
| `domains/X/components/` | PascalCase para componentes | `ProtocolBuilder.tsx`, `AppLayer.astro` |
| `domains/X/api/` | kebab-case o `index.ts` | `index.ts`, `share.ts`, `read.ts` |
| `domains/X/types.ts` | Un solo archivo por dominio | `types.ts` |
| `shared/ui/` | PascalCase para componentes Astro | `Navbar.astro`, `CopyButton.astro` |
| `shared/lib/` | camelCase | `sql.ts`, `retry.ts`, `reconcile.ts` |
| `shared/stores/` | camelCase + sufijo `Store` | `uiStore.ts` |
| `shared/types/` | camelCase | `api.ts` |
| `pages/` | kebab-case (convención Astro) | `index.astro`, `[shareCode].astro` |

---

## 7. Orden de Ejecución de la Migración (P-001)

El desarrollador debe seguir este orden para minimizar conflictos de importaciones rotas durante la migración:

1. **Crear la estructura de carpetas vacía** (`domains/`, `shared/`, subdirectorios).
2. **Configurar los path aliases en `tsconfig.json`.**
3. **Mover `shared/lib/sql.ts`** (lo necesitan los handlers de API). Eliminar `src/lib/db.ts`.
4. **Mover `shared/i18n/translations.ts`** (lo necesitan los layouts y componentes).
5. **Mover `shared/layouts/`** (lo necesitan las páginas).
6. **Mover `shared/ui/`** (Navbar, Footer — usados en layouts).
7. **Mover `domains/protocols/`** (dominio más complejo; validar imports rotos antes de continuar).
8. **Mover `domains/messages/`**.
9. **Mover `domains/my-protocols/`**.
10. **Mover `domains/tools/`**.
11. **Mover `domains/tcpip/`**.
12. **Crear shims de re-export en `pages/api/`**.
13. **Renombrar `src/pages/es/` a `src/pages/en/`** (impacto en i18n — D-01). Actualizar `astro.config.mjs`.
14. **Crear `shared/lib/retry.ts` y `shared/lib/reconcile.ts`** (nuevos, D-02).
15. **Ejecutar `bun run build`** para verificar que no hay imports rotos.
16. **Eliminar directorios vacíos:** `src/components/`, `src/ui/`, `src/layouts/`, `src/i18n/`, `src/lib/`, `src/types/`, `src/actions/`, `src/services/`.

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial — estructura objetivo P-001 con plan de migración completo |
