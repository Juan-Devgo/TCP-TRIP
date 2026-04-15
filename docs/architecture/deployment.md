# Estrategia de Despliegue — TCP-TRIP (D-04)

**Versión:** 1.0  
**Fecha:** 2026-04-14  
**Estado:** Aceptado — opción preferida: Cloudflare Pages + Workers  
**Motiva:** Q-006 (resuelta), AS-006, PR-001  
**ADR asociado:** ADR-006

---

## 1. Contexto

El despliegue de TCP-TRIP tiene dos destinos posibles según la infraestructura disponible al momento de la evaluación:

- **Opción A — Cloudflare:** Plataforma serverless gestionada. Cero administración de servidores. Requiere un proveedor de PostgreSQL externo (Neon, Supabase).
- **Opción B — Servidor de la Universidad del Quindío:** Servidor físico o virtual con acceso SSH. Despliegue mediante contenedores Docker orquestados con Docker Compose.

Ambas opciones son válidas. La decisión final depende de la infraestructura disponible en el momento del despliegue. El código fuente no cambia entre opciones; solo cambia la configuración de despliegue y las variables de entorno.

---

## 2. Opción A — Cloudflare Pages + Workers

### 2.1 Descripción

Astro se despliega en Cloudflare Pages usando el adaptador oficial `@astrojs/cloudflare`. Las páginas SSR y las API Routes se ejecutan como Cloudflare Workers (funciones edge).

La base de datos PostgreSQL se provisiona en un servicio externo gestionado. La opción recomendada es **Neon** (serverless PostgreSQL, plan gratuito generoso, compatible con `Bun.sql` via cadena de conexión estándar).

### 2.2 Diagrama de infraestructura

```mermaid
graph LR
    subgraph Usuario
        Browser["Navegador"]
    end

    subgraph Cloudflare
        Pages["Cloudflare Pages<br/>(assets estáticos)"]
        Workers["Cloudflare Workers<br/>(SSR + API Routes)"]
    end

    subgraph Servicios Externos
        Clerk["Clerk<br/>(autenticación)"]
        Neon["Neon PostgreSQL<br/>(base de datos)"]
    end

    Browser -- "HTTPS" --> Pages
    Browser -- "HTTPS /api/*" --> Workers
    Workers -- "SDK REST" --> Clerk
    Workers -- "Bun.sql / pg" --> Neon
    Pages -- "activos estáticos (CSS, JS, imágenes)" --> Browser
```

### 2.3 Adaptador requerido

```bash
bun add @astrojs/cloudflare
```

```javascript
// astro.config.mjs
import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  adapter: cloudflare({ mode: "directory" }),
  output: "server",
  // ... resto de configuración
});
```

**Nota importante:** El adaptador `@astrojs/node` actual debe reemplazarse por `@astrojs/cloudflare` para esta opción. Si se elige la Opción B, se mantiene `@astrojs/node`.

### 2.4 Variables de entorno en Cloudflare

Configurar en el dashboard de Cloudflare Pages → Settings → Environment Variables:

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL de Neon | `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/tcptrip?sslmode=require` |
| `CLERK_SECRET_KEY` | Clave secreta de Clerk (Backend SDK) | `sk_live_xxxx` |
| `CLERK_PUBLISHABLE_KEY` | Clave pública de Clerk | `pk_live_xxxx` |
| `ADMIN_USER_ID` | Clerk user ID del administrador (fallback) | `user_2xxxxxxxxxxxxxxxx` |

**Nota sobre SSL:** Neon requiere `?sslmode=require` en la cadena de conexión. `Bun.sql` respeta este parámetro de la URL.

### 2.5 Proceso de despliegue

1. Conectar el repositorio Git a Cloudflare Pages (GitHub/GitLab).
2. Configurar el comando de build: `bun run build`.
3. Configurar el directorio de salida: `dist/`.
4. Configurar las variables de entorno en el dashboard.
5. Cada push a `main` dispara un deploy automático.

### 2.6 Pros y contras

| Aspecto | Evaluación |
|---------|-----------|
| **Costo** | Plan gratuito de Cloudflare Pages cubre el volumen académico esperado. Neon tiene plan gratuito con 0.5 GB de almacenamiento. |
| **Administración** | Cero administración de infraestructura. Sin actualizaciones de SO, sin gestión de procesos. |
| **Latencia** | Edge computing: los Workers corren cerca del usuario geográficamente. |
| **Disponibilidad** | SLA de Cloudflare: 99.99%. Superior a cualquier servidor universitario. |
| **Limitaciones** | Los Workers tienen un límite de CPU por request (sin operaciones de larga duración). Para TCP-TRIP esto no es un problema dado el volumen de operaciones. |
| **Complejidad de cambio** | Requiere cambiar el adaptador de Astro. El código de negocio no cambia. |

---

## 3. Opción B — Docker Compose en Servidor Universidad

### 3.1 Descripción

La aplicación y la base de datos se despliegan como contenedores Docker en el servidor de la universidad. Docker Compose orquesta los dos servicios: la aplicación Astro (con Bun) y PostgreSQL.

### 3.2 Diagrama de infraestructura

```mermaid
graph LR
    subgraph Usuario
        Browser["Navegador"]
    end

    subgraph "Servidor Universidad (VM o físico)"
        Nginx["Nginx<br/>(proxy inverso + SSL)"]
        subgraph "Docker Compose"
            App["Contenedor: app<br/>Bun + Astro SSR<br/>Puerto 4321"]
            PG["Contenedor: postgres<br/>PostgreSQL 15<br/>Puerto 5432 (interno)"]
        end
        Volume["Volumen Docker<br/>(persistencia de BD)"]
    end

    subgraph Servicios Externos
        Clerk["Clerk<br/>(autenticación)"]
    end

    Browser -- "HTTPS (443)" --> Nginx
    Nginx -- "HTTP (4321)" --> App
    App -- "Bun.sql TCP" --> PG
    App -- "SDK REST HTTPS" --> Clerk
    PG --- Volume
```

### 3.3 `docker-compose.yml` de referencia

El siguiente es el archivo de referencia para el desarrollador. **No ejecutar directamente** sin revisar las variables de entorno con el equipo.

```yaml
# docker-compose.yml — TCP-TRIP (Opción B: Servidor Universidad)
# Versión de referencia — ajustar valores de producción antes de usar

version: "3.9"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: tcptrip-app
    ports:
      - "4321:4321"
    environment:
      - DATABASE_URL=postgresql://tcptrip:${POSTGRES_PASSWORD}@postgres:5432/tcptrip
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
      - ADMIN_USER_ID=${ADMIN_USER_ID}
      - NODE_ENV=production
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    container_name: tcptrip-postgres
    environment:
      POSTGRES_DB: tcptrip
      POSTGRES_USER: tcptrip
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./db/migrations:/docker-entrypoint-initdb.d  # Ejecuta las migraciones al primer inicio
    ports:
      - "5432:5432"  # Solo exponer si se necesita acceso externo para debugging
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U tcptrip -d tcptrip"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
```

### 3.4 `Dockerfile` de referencia

```dockerfile
# Dockerfile — TCP-TRIP
FROM oven/bun:1.2 AS builder

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:1.2-slim AS runner

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

ENV NODE_ENV=production
EXPOSE 4321

CMD ["bun", "run", "./dist/server/entry.mjs"]
```

### 3.5 Archivo `.env` de referencia para producción

```bash
# .env.production — NO commitear este archivo
# Copiar como .env en el servidor y configurar los valores reales

DATABASE_URL=postgresql://tcptrip:CAMBIAR_PASSWORD@postgres:5432/tcptrip
POSTGRES_PASSWORD=CAMBIAR_PASSWORD_FUERTE
CLERK_SECRET_KEY=sk_live_XXXXXXXXXXXX
CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXX
ADMIN_USER_ID=user_2XXXXXXXXXXXXXXXXX
```

### 3.6 Variables de entorno requeridas (ambas opciones)

| Variable | Descripción | Requerida en | Ejemplo |
|----------|-------------|-------------|---------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL completa | Ambas opciones | `postgresql://user:pass@host:5432/db` |
| `CLERK_SECRET_KEY` | Clave secreta del Backend SDK de Clerk | Ambas opciones | `sk_live_xxxx` |
| `CLERK_PUBLISHABLE_KEY` | Clave pública de Clerk para el cliente | Ambas opciones | `pk_live_xxxx` |
| `ADMIN_USER_ID` | Clerk user ID del superadmin (fallback) | Ambas opciones | `user_2xxxx` |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL | Solo Opción B | `s3cr3t_str0ng_pass` |
| `NODE_ENV` | Entorno de ejecución | Solo Opción B | `production` |

### 3.7 Pros y contras

| Aspecto | Evaluación |
|---------|-----------|
| **Costo** | Cero costo de infraestructura si el servidor ya está disponible en la universidad. |
| **Control** | Control total sobre el entorno, versiones y configuración de PostgreSQL. |
| **Administración** | Requiere conocimientos de Docker y administración de Linux básica. El equipo debe gestionar actualizaciones de imagen y backups de la BD. |
| **Disponibilidad** | Depende de la disponibilidad del servidor universitario (no gestionado por el equipo). Sin SLA formal. |
| **Backups** | El equipo debe configurar backups del volumen `postgres_data`. Mínimo: `pg_dump` diario. |
| **SSL** | Nginx actúa como proxy inverso con terminación SSL. Se puede usar Let's Encrypt (certbot) si el servidor tiene IP pública y dominio. |

---

## 4. Abstracción de la Capa de Datos (Portabilidad entre Opciones)

El acceso a la base de datos en TCP-TRIP está **completamente abstraído** en `src/shared/lib/sql.ts`. Ningún componente de dominio importa directamente `Bun.sql`; todo pasa por este módulo:

```typescript
// src/shared/lib/sql.ts
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurada");
}

export const sql = Bun.sql;
// Bun.sql usa DATABASE_URL automáticamente del entorno.
```

**Consecuencia:** Cambiar entre Neon (Opción A) y PostgreSQL local (Opción B) solo requiere cambiar el valor de `DATABASE_URL`. El código de negocio no cambia.

---

## 5. Estrategia de Ambientes

| Ambiente | Descripción | Configuración |
|----------|-------------|---------------|
| **Desarrollo local** | El desarrollador corre `bun run dev` con un PostgreSQL local o un contenedor Docker de PG. | `.env.local` con `DATABASE_URL` apuntando a `localhost:5432`. Clerk en modo desarrollo (`CLERK_SECRET_KEY` de instancia de desarrollo). |
| **Staging** | (Opcional para contexto académico) Vista previa de Cloudflare Pages para cada PR. | Variables de entorno de staging en Cloudflare. BD de desarrollo de Neon. |
| **Producción** | El despliegue definitivo evaluado por el jurado. | Variables de entorno de producción. BD con datos reales (o datos de demostración seeded). |

---

## 6. Estrategia de Rollback

**Opción A (Cloudflare):** Cloudflare Pages mantiene un historial de deploys. El rollback se realiza desde el dashboard de Cloudflare seleccionando un deploy anterior y haciendo clic en "Roll back to this deployment". Sin tiempo de inactividad.

**Opción B (Docker Compose):** El rollback se realiza haciendo un `git checkout` de la versión anterior y re-ejecutando `docker-compose up --build`. El tiempo de inactividad es el tiempo de rebuild (estimado: 2-3 minutos para el volumen del proyecto).

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial — D-04: opciones de despliegue Cloudflare y Docker Compose |
