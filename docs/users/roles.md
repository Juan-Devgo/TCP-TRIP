# Roles de usuario

TCP-TRIP tiene tres roles: **Estudiante**, **Profesor** y **Administrador**. Este documento explica para qué existe cada uno y en qué se diferencian. Describe responsabilidades, no pantallas: las herramientas concretas cambian con el tiempo, el propósito de cada rol no.

---

## Resumen

| Rol | Propósito en una frase |
| --- | --- |
| **Estudiante** | Aprender y practicar por su cuenta, resolviendo solo las dudas mecánicas. |
| **Profesor** | Enseñar: preparar material, evaluar y acompañar a sus estudiantes. |
| **Administrador** | Cuidar la plataforma: gestionar usuarios, validar profesores y moderar contenido. |

Los tres roles responden al propósito central de la aplicación: que el estudiante resuelva por sí mismo las dudas fáciles y repetitivas, para que el tiempo con el profesor quede reservado a las dudas conceptuales.

---

## Estudiante

Es el rol por defecto de toda persona que se registra. Su propósito es **aprender de forma autónoma**.

- **Explora la teoría** del modelo TCP/IP y consulta el contenido educativo.
- **Usa las herramientas** de la plataforma (conversores, calculadoras y las que se añadan) para comprobar sus propios cálculos.
- **Trabaja con protocolos genéricos**: diseña sus propios protocolos y los usa para componer mensajes.
- **Resuelve ejercicios** para practicar, incluidos los que le asigne su profesor.
- **Personaliza su experiencia**: idioma, tema visual y atajos de teclado.
- **Guarda su progreso** para retomarlo más adelante.

El estudiante trabaja sobre su propio contenido: lo que crea es suyo y no ve ni modifica el trabajo de otros, salvo lo que se comparta con él.

---

## Profesor

Su propósito es **enseñar y evaluar** apoyándose en la plataforma. El rol no se obtiene al registrarse: un administrador lo concede tras validar manualmente que la persona es docente.

El profesor conserva todo lo que puede hacer un estudiante y además:

- **Genera ejercicios** para quices y exámenes a partir de las herramientas, con su hoja de respuestas.
- **Usa el modo presentación**, pensado para proyectar en clase.
- **Crea presentaciones de teoría** para explicar los temas frente al curso, y **las envía a revisión** para que se publiquen en la sección Teoría.
- **Asigna ejercicios** a sus estudiantes.

La diferencia clave con el estudiante: el estudiante *consume* la plataforma para aprender; el profesor *produce* material a partir de ella para enseñar a otros.

---

## Administrador

Su propósito es **mantener la plataforma confiable**. No es un rol pedagógico, sino de gestión y moderación.

- **Modera a los usuarios** y, cuando es necesario, **los suspende (ban)**.
- **Concede o retira la verificación de profesor**, es decir, es quien decide quién tiene el rol de Profesor.
- **Elimina protocolos** creados por usuarios cuando su contenido lo amerita.
- **Aprueba o rechaza las presentaciones de teoría** antes de que los estudiantes las vean: nada se publica en Teoría sin que un administrador lo haya leído. Al aprobar se congela una copia del documento, así que lo que el curso lee es exactamente lo que se revisó; al rechazar, el motivo es obligatorio porque es el único canal de vuelta hacia el profesor.
- **Arma el menú de la sección Teoría**: crea las secciones (nombre e icono) y les asigna las presentaciones ya aprobadas, de modo que el estudiante encuentre la teoría en el orden en que se enseña el curso y no en un índice por fecha. Detalle en `docs/theory/TheoryMenu.md`.

La diferencia clave con los otros roles: estudiante y profesor actúan sobre *su propio* contenido; el administrador es el único que actúa sobre el contenido y las cuentas *de otros*.

---

## Comparación

| Capacidad | Estudiante | Profesor | Administrador |
| --- | :---: | :---: | :---: |
| Teoría, herramientas, ejercicios y protocolos genéricos | ✓ | ✓ | ✓ |
| Preferencias (idioma, tema, atajos) y progreso guardado | ✓ | ✓ | ✓ |
| Generar ejercicios para evaluación | | ✓ | |
| Modo presentación y presentaciones de teoría | | ✓ | |
| Leer las presentaciones publicadas y guardar el avance de lectura | ✓ | ✓ | ✓ |
| Asignar ejercicios a estudiantes | | ✓ | |
| Conceder o retirar el rol de Profesor | | | ✓ |
| Suspender usuarios | | | ✓ |
| Eliminar protocolos de otros usuarios | | | ✓ |
| Aprobar o rechazar presentaciones de teoría | | | ✓ |
| Armar el menú de la sección Teoría | | | ✓ |

---

## Reglas generales

- **El rol lo determina el servidor**, a partir de los metadatos de la cuenta (Clerk); nunca se confía en lo que diga el cliente.
- **El rol de Profesor se concede manualmente** por un administrador; nadie se lo asigna a sí mismo.
- **El primer administrador se crea a mano** en el panel de Clerk (ver abajo); no existe una pantalla para promover al primero, porque haría falta ya ser administrador para usarla.
- **Cada rol se define por su propósito.** Cuando aparezca una funcionalidad nueva, se asigna al rol cuyo propósito sirve: aprender (Estudiante), enseñar (Profesor) o cuidar la plataforma (Administrador).
- **La moderación del contenido de teoría es previa a la publicación**, no posterior: el administrador revisa y aprueba antes de que el material llegue a los estudiantes. Un sistema de reportes sobre lo ya publicado sería un complemento futuro, no el mecanismo principal.
- **Ocultar no es proteger.** El sidebar esconde lo que un rol no puede usar (`src/lib/auth/roles.ts`), pero la decisión real la toma el servidor contra los metadatos de Clerk en cada petición (`src/api/auth.ts`).

---

## Cómo se guardan y se conceden los roles (Clerk)

El rol **no** vive en la base de datos de la aplicación. Clerk es el dueño de la identidad, y duplicar el rol en `data/tcp-trip.sqlite` sería duplicar una fuente de verdad: por eso las tablas guardan el `user_id` de Clerk y nada más de la persona.

Se guarda en los **metadatos públicos** (`publicMetadata`) de la cuenta, que es la forma que Clerk recomienda para un control de acceso por roles sin organizaciones: el navegador puede leerlos pero no modificarlos, así que el cliente los usa para *esconder* y el servidor para *decidir*.

```json
{ "role": "teacher" }
```

Valores válidos: `student` (el predeterminado, también cuando falta el campo), `teacher`, `admin` — la lista está en `src/lib/auth/roles.ts`.

### Que el rol viaje en el token (una vez, en el panel de Clerk)

Con esto el servidor conoce el rol **sin llamar a la API de Clerk en cada petición**:

1. Panel de Clerk → **Sessions** → *Customize session token* → editor de reclamaciones (*claims*).
2. Pegar:

   ```json
   { "metadata": "{{user.public_metadata}}" }
   ```

3. Guardar.

`src/api/auth.ts` lee `sessionClaims.metadata.role` del token ya verificado. Si la reclamación no está configurada —o el token es anterior al cambio—, recurre a leer el usuario por API y cachea la respuesta 60 s; la aplicación funciona igual, solo con una llamada más. Mantener los metadatos pequeños es parte del acuerdo: el token va en una cookie y Clerk recomienda no pasar de ~1,2 KB de reclamaciones propias.

### Crear un administrador a mano

1. Panel de Clerk → **Users** → la persona.
2. **User metadata** → **Public** → *Edit*.
3. Escribir `{ "role": "admin" }` y guardar.
4. Que la persona recargue la aplicación (o espere a que el token se renueve, hasta un minuto).

El mismo procedimiento con `"role": "teacher"` concede el rol de Profesor; lo normal es hacerlo desde `Administrador › Profesores` cuando esa pantalla esté construida, y el panel de Clerk queda como el camino para el primer administrador y para casos excepcionales.

### Por qué no se usan las organizaciones de Clerk

Los roles y permisos integrados de Clerk son una funcionalidad de **organizaciones**: exigirían que cada estudiante perteneciera a una organización para tener rol. Aquí el rol es de la persona y global a la plataforma, así que los metadatos públicos son el mecanismo adecuado y el más simple de auditar.
