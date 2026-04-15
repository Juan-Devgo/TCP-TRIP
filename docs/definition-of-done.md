# Definición de Terminado (Definition of Done) — TCP-TRIP

**Versión:** 1.0  
**Fecha:** 2026-04-14  
**Aplicabilidad:** Global — aplica a todas las historias de usuario del producto sin excepción.

---

## Propósito

La Definición de Terminado (DoD) establece el conjunto mínimo de condiciones que debe cumplir una historia de usuario para ser considerada **completamente terminada** y lista para su integración en el producto. Una historia no está "terminada" hasta que cumple **todos** los criterios aplicables de esta definición.

---

## 1. Implementación Funcional

| # | Criterio | Obligatorio |
|---|----------|------------|
| 1.1 | El código implementa todos los criterios de aceptación definidos en la historia de usuario. | Sí |
| 1.2 | La funcionalidad fue probada manualmente en el entorno de desarrollo y funciona sin errores visibles en consola. | Sí |
| 1.3 | Los casos de error y estados vacíos están manejados: el usuario recibe retroalimentación visual ante cualquier error (formulario inválido, error de red, protocolo no encontrado, etc.). | Sí |
| 1.4 | Las rutas API involucradas retornan los códigos HTTP correctos (200, 201, 400, 401, 404, 500) con mensajes de error descriptivos en el cuerpo JSON. | Sí (si aplica API) |
| 1.5 | El flujo de autenticación está correctamente protegido: las rutas que requieren autenticación retornan 401 si el usuario no está autenticado. | Sí (si aplica auth) |

---

## 2. Calidad del Código

| # | Criterio | Obligatorio |
|---|----------|------------|
| 2.1 | El código no introduce deuda técnica crítica: no hay `any` de TypeScript sin justificación, no hay variables sin usar, no hay código comentado sin propósito. | Sí |
| 2.2 | Los componentes React siguen el patrón establecido en el proyecto (hooks funcionales, tipos explícitos de props). | Sí |
| 2.3 | Las funciones con lógica de negocio no trivial (cálculos de bits, validaciones de protocolo) tienen comentarios que explican el propósito, no la sintaxis. | Sí |
| 2.4 | No existe código duplicado que pueda ser extraído a un módulo compartido. Si la duplicación es intencional, está justificada en comentario. | Sí |
| 2.5 | El código fue revisado (auto-revisión si equipo de 1 persona, revisión por par si equipo de 2). | Sí |

---

## 3. Internacionalización (i18n)

| # | Criterio | Obligatorio |
|---|----------|------------|
| 3.1 | Todas las cadenas de texto visibles al usuario (labels, botones, mensajes de error, estados vacíos, tooltips, placeholders) están externalizadas en el archivo de traducciones `src/i18n/translations.ts`. | Sí |
| 3.2 | La funcionalidad está disponible y funciona correctamente en ambos idiomas: español (`/es/*`) e inglés (`/*`). | Sí |
| 3.3 | No existen textos en el código fuente de componentes Astro o React que sean literales en un solo idioma (hardcoded strings en español o inglés directamente en JSX/HTML). | Sí |
| 3.4 | Los mensajes de error de las APIs también tienen su equivalente internacionalizado en el cliente (el mensaje de error mostrado al usuario está en el idioma activo, no necesariamente el mensaje del servidor). | Sí |

---

## 4. Responsividad y Compatibilidad

| # | Criterio | Obligatorio |
|---|----------|------------|
| 4.1 | La página o componente es usable en los siguientes breakpoints de Tailwind: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px). | Sí |
| 4.2 | En viewport móvil (< 768px), no existe scroll horizontal involuntario. El contenido se adapta o se desplaza verticalmente de forma correcta. | Sí |
| 4.3 | La interfaz fue verificada en al menos dos navegadores: Chrome/Chromium y Firefox en sus versiones actuales. | Sí |

---

## 5. Accesibilidad

| # | Criterio | Obligatorio |
|---|----------|------------|
| 5.1 | Todos los elementos interactivos (botones, inputs, selects) tienen etiquetas accesibles: atributo `aria-label` o `<label>` asociado correctamente. | Sí |
| 5.2 | Los iconos que transmiten información (sin texto adyacente) tienen `aria-label` o `title` descriptivo. Los iconos puramente decorativos tienen `aria-hidden="true"`. | Sí |
| 5.3 | El contraste de color de texto sobre fondo cumple el nivel AA de WCAG 2.1 (ratio mínimo 4.5:1 para texto normal, 3:1 para texto grande). | Sí |
| 5.4 | La navegación por teclado es funcional: el usuario puede acceder a todos los controles usando Tab y activarlos con Enter/Space. | Sí |
| 5.5 | Los mensajes de error en formularios se anuncian correctamente a lectores de pantalla (uso de `role="alert"` o `aria-live`). | Sí |

---

## 6. Pruebas

| # | Criterio | Obligatorio |
|---|----------|------------|
| 6.1 | Los criterios de aceptación de la historia fueron verificados manualmente uno a uno y documentados (captura de pantalla o nota en el pull request). | Sí |
| 6.2 | Las funciones de lógica pura (cálculos de subnetting, conversiones de bases, cálculo de offsets de bits) tienen al menos un test unitario ejecutable con `bun test`. | Sí (si aplica) |
| 6.3 | Las rutas de API críticas (creación/edición/eliminación de protocolos, envío de mensajes) tienen al menos un test de integración que verifica el comportamiento con la base de datos real. | Sí (si aplica API) |
| 6.4 | Los tests existentes no fueron rotos por la nueva implementación. `bun test` ejecuta sin errores. | Sí |
| 6.5 | Se probaron los casos límite declarados en los criterios de aceptación (campos vacíos, valores inválidos, estados de error). | Sí |

---

## 7. Base de Datos y Persistencia

| # | Criterio | Obligatorio |
|---|----------|------------|
| 7.1 | Si la historia introduce cambios al esquema de la base de datos (nuevas tablas, columnas o índices), estos cambios están en la función `initDb` de `src/lib/db.ts` usando `CREATE TABLE IF NOT EXISTS` o `ALTER TABLE`. | Sí (si aplica) |
| 7.2 | No se introducen consultas SQL sin índices para columnas que se usan en cláusulas `WHERE` frecuentes. | Sí |
| 7.3 | Los datos JSON almacenados en columnas TEXT (como `fields`, `header_values`, `protocol_snapshot`) son validados antes de ser escritos para garantizar que son JSON válido. | Sí |

---

## 8. Seguridad

| # | Criterio | Obligatorio |
|---|----------|------------|
| 8.1 | Ninguna ruta API expone datos de un usuario a otro usuario sin verificar que el `userId` del token de Clerk corresponde al propietario del recurso. | Sí |
| 8.2 | Los datos de entrada del usuario en las API routes son validados del lado del servidor antes de ser utilizados en consultas SQL (prevención de inyección SQL mediante prepared statements). | Sí |
| 8.3 | No se almacenan credenciales, tokens ni información sensible en el código fuente ni en la base de datos SQLite sin cifrado. | Sí |
| 8.4 | Las variables de entorno sensibles (claves de Clerk) están en `.env` y están listadas en `.gitignore`. | Sí |

---

## 9. Documentación del Producto

| # | Criterio | Obligatorio |
|---|----------|------------|
| 9.1 | Si la historia modifica el alcance de una épica o añade un nuevo requisito no documentado, se actualiza el archivo correspondiente en `/docs`. | Sí |
| 9.2 | Si se identificó un nuevo término de dominio durante la implementación, se añade al glosario (si existe). | Sí |
| 9.3 | El estado de la historia en `docs/user-stories.md` se actualiza a "Hecho" una vez que todos los criterios de esta DoD están satisfechos. | Sí |

---

## Checklist de Cierre (para usar al cerrar una historia)

```
[ ] 1.1 Todos los criterios de aceptación implementados
[ ] 1.3 Estados de error manejados con feedback al usuario
[ ] 1.4 Códigos HTTP correctos en APIs (si aplica)
[ ] 1.5 Protección de autenticación (si aplica)
[ ] 2.1 Sin any de TypeScript sin justificación
[ ] 2.5 Código revisado
[ ] 3.1 Todas las cadenas en translations.ts
[ ] 3.2 Funciona en ES y EN
[ ] 4.1 Responsivo en todos los breakpoints
[ ] 4.2 Sin scroll horizontal en móvil
[ ] 5.1 Labels accesibles en elementos interactivos
[ ] 5.3 Contraste WCAG AA
[ ] 6.1 Criterios de aceptación verificados manualmente
[ ] 6.4 bun test ejecuta sin errores
[ ] 7.1 Cambios de esquema en initDb (si aplica)
[ ] 8.1 Verificación de propietario en APIs (si aplica)
[ ] 8.2 Prepared statements en SQL (si aplica)
[ ] 9.3 Estado actualizado en docs/user-stories.md
```
