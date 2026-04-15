---
id: ADR-006
title: "Estrategia de despliegue: Cloudflare Pages/Workers (preferida) con Docker Compose como alternativa"
status: accepted
date: 2026-04-14
deciders: [SA, Desarrollador]
motiva: [Q-006, AS-006, PR-001]
---

# ADR-006: Estrategia de Despliegue

**Estado:** Aceptado  
**Fecha:** 2026-04-14  
**Deciders:** Equipo TCP-TRIP  
**Motiva:** Q-006 (resuelta), AS-006, PR-001

---

## Contexto

La pregunta Q-006 estaba abierta: "¿Cuál es el proveedor de PostgreSQL para el despliegue de producción?". La respuesta a esta pregunta está entrelazada con la estrategia general de despliegue, ya que el proveedor de BD depende de dónde corre la aplicación.

El contexto del proyecto impone las siguientes restricciones:

1. **Equipo de 1-2 personas con dedicación parcial (PR-002):** La administración de infraestructura debe ser mínima. No hay un equipo de DevOps dedicado.
2. **Plazo académico fijo (PR-001):** El despliegue debe ser reproducible y estable para la fecha de evaluación del Trabajo de Grado.
3. **Incertidumbre sobre el entorno universitario (AS-006):** No se tiene certeza de si el servidor de la universidad de la Quindío estará disponible, tendrá acceso público a internet, o tendrá un dominio asignado.
4. **Bajo volumen de usuarios (AS-007):** Máximo 100 usuarios simultáneos en contexto de clase universitaria.
5. **Costo limitado:** El proyecto es académico. Los costos de infraestructura deben ser mínimos o nulos.

Las opciones analizadas son:

**Opción A — Cloudflare Pages + Workers:** Plataforma serverless gestionada de Cloudflare con PostgreSQL en Neon (serverless, plan gratuito).

**Opción B — Docker Compose en servidor universitario:** La universidad provee un servidor (VM o físico). La aplicación corre como contenedor Docker con `@astrojs/node`. PostgreSQL corre como un segundo contenedor con volumen persistente.

**Opción C — Plataformas PaaS (Railway, Render, Fly.io):** Servicios PaaS que gestionan el despliegue de contenedores y bases de datos.

---

## Decisión

Se adopta una estrategia **dual** con orden de preferencia:

1. **Opción preferida: Cloudflare Pages + Workers** con PostgreSQL en Neon.
2. **Alternativa: Docker Compose en servidor universitario** si Cloudflare no es viable en el contexto de evaluación.

La aplicación está diseñada para ser portable entre ambas opciones mediante el uso de variables de entorno y la abstracción de la capa de datos en `src/shared/lib/sql.ts`.

**Por qué Cloudflare es la opción preferida:**
- Plan gratuito de Cloudflare Pages es suficiente para el volumen académico.
- Neon tiene plan gratuito con 0.5 GB (suficiente para un Trabajo de Grado).
- Cero administración de servidores. El equipo no pierde tiempo en infraestructura.
- Despliegue automático con cada push a `main` (integración Git nativa).
- Alta disponibilidad sin configuración adicional (SLA 99.99%).
- El adaptador `@astrojs/cloudflare` es la primera opción documentada en la guía oficial de Astro.

**Por qué Docker Compose es la alternativa y no la opción principal:**
- La disponibilidad y configuración del servidor universitario es incierta.
- Requiere configuración de Nginx, SSL y mantenimiento de la imagen Docker.
- Los backups de la BD son responsabilidad del equipo.
- Sin IP pública o dominio asignado, el acceso externo es complejo.

**Por qué se descarta Opción C (Railway, Render, Fly.io):**
- Aunque son opciones válidas, agregan una tercera plataforma a aprender sin ventaja sustancial sobre Cloudflare para este caso.
- Cloudflare es más maduro para aplicaciones Astro SSR por el soporte oficial del adaptador.

---

## Consecuencias

### Positivas

- **Portabilidad garantizada:** El único cambio entre opciones es el adaptador de Astro (`@astrojs/cloudflare` vs `@astrojs/node`) y el valor de `DATABASE_URL`. El código de negocio es idéntico.
- **Costo cero en el escenario normal (Opción A):** Cloudflare Pages y Neon tienen planes gratuitos que cubren el volumen del Trabajo de Grado.
- **Flexibilidad ante incertidumbre:** Si el día de la evaluación la conexión a internet falla en el aula, la Opción B (servidor local en la universidad) puede activarse sin cambios de código.
- **La BD no bloquea el despliegue:** Neon es un servicio gestionado; no requiere provisionar una instancia de PostgreSQL manualmente.

### Negativas / Trade-offs

- **Cambio de adaptador de Astro:** Migrar de `@astrojs/node` (actual) a `@astrojs/cloudflare` requiere trabajo de configuración. Los Workers de Cloudflare tienen algunas diferencias con Node.js (p. ej., APIs de Node que no están disponibles en el runtime de Workers).
- **`Bun.sql` en Cloudflare Workers:** Los Workers no ejecutan Bun nativo; ejecutan JavaScript estándar del runtime de Workers. `Bun.sql` no está disponible en Workers. **Implicación técnica:** Para la Opción A, la conexión a PostgreSQL debe realizarse con un driver compatible con Workers (e.g., `@neondatabase/serverless`, que usa el protocolo WebSocket de Neon sobre HTTPS). La abstracción en `sql.ts` debe actualizarse si se elige Cloudflare.
- **Latencia de la BD en Opción A:** Los Workers son edge pero Neon tiene un endpoint en us-east. Si los usuarios están en Colombia, puede haber latencia de BD de 80-120ms. Para el volumen académico, esto es aceptable.

### Decisión técnica derivada

**Si se elige Opción A (Cloudflare):** Reemplazar `Bun.sql` por `@neondatabase/serverless` en `src/shared/lib/sql.ts`. La interfaz del módulo (`export const sql`) permanece igual; solo cambia la implementación interna.

```typescript
// src/shared/lib/sql.ts — versión para Cloudflare Workers
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está configurada");
}

export const sql = neon(process.env.DATABASE_URL);
```

**Si se elige Opción B (Docker Compose + Bun):** El `sql.ts` actual con `Bun.sql` funciona sin cambios.

---

## Alternativas Evaluadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Railway | Válido pero menos maduro para Astro. El plan gratuito tiene restricciones de tiempo de ejecución ("sleep after inactivity") que afectarían la experiencia en la demo. |
| Render | Ídem. El plan gratuito hace "sleep" de la instancia tras 15 min de inactividad. |
| Fly.io | Requiere más configuración de infraestructura que Cloudflare. Sin ventaja clara para este caso. |
| Supabase (solo BD) | Compatible si se usa como proveedor de PostgreSQL para Opción A. Segunda opción tras Neon. Supabase tiene plan gratuito generoso y también admite conexión via cadena estándar. |
| Vercel | No soporta nativamente Astro SSR con Bun. Requería ajustes adicionales. |
