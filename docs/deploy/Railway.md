# Despliegue en Railway

TCP-TRIP se despliega como **una sola imagen Docker**: el mismo proceso Bun sirve la API y la SPA, igual que en local. Los archivos que lo definen están en la raíz del repositorio:

| Archivo | Qué hace |
| --- | --- |
| `Dockerfile` | Dos etapas sobre `oven/bun`: la de build instala desde `bun.lockb` y corre `bun run build`; la final copia solo `dist/` a `/app` y arranca `bun index.js` con `NODE_ENV=production` y `PORT=8080`. |
| `.dockerignore` | Deja fuera `.env`, `data/`, `node_modules`, `dist`, tests y documentación. |
| `railway.json` | Le dice a Railway que construya con el `Dockerfile`, que compruebe `/api/health` antes de dar el despliegue por bueno y que reinicie si el proceso cae. |

`build.ts` empaqueta el servidor **y** la SPA que importa (`src/index.html`, TSX + Tailwind) en un `dist/` autónomo: la imagen final no lleva `node_modules` ni empaqueta nada al arrancar. Antes Bun empaquetaba la SPA en la primera visita a una página, *después* de que el health check ya había pasado, con un pico de ~500 MB de memoria.

Por eso las variables `PUBLIC_*` se inlinean **durante el build**: Railway pasa las variables del servicio como argumentos de build, pero solo las que el `Dockerfile` declara con `ARG` (hoy `PUBLIC_CLERK_PUBLISHABLE_KEY`). Si falta, el build falla en vez de publicar una página en blanco. Una variable `PUBLIC_*` nueva necesita su propio `ARG`, y cambiar su valor exige redesplegar.

---

## Pasos

1. **Verificar la cuenta con GitHub** en `railway.com/verify`. Sin verificar, el *Limited Trial* restringe el tráfico saliente, y el servidor necesita salir hacia Clerk y Google.
2. **Crear el servicio**: *New Project → Deploy from GitHub repo* y elegir este repositorio. Railway detecta `railway.json` y construye con el `Dockerfile`.
3. **Añadir un volumen** al servicio (clic derecho → *Attach volume*), montado en **`/app/data`**. Los volúmenes no se pueden declarar en `railway.json`. Sin volumen, cada redeploy empieza con la base de datos vacía.
4. **Variables del servicio** (*Variables*):

   | Variable | Valor |
   | --- | --- |
   | `PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key de Clerk (`pk_…`). |
   | `CLERK_SECRET_KEY` | Secret key de Clerk (`sk_…`). Nunca con prefijo `PUBLIC_`. |
   | `DATABASE_PATH` | `/app/data/tcp-trip.sqlite` |
   | `APP_ORIGIN` | `https://<dominio-generado>.up.railway.app` (los enlaces que se adjuntan a Classroom). |

   `PORT` no se configura: Railway inyecta `8080` y Bun lo lee solo. Las variables `TLS_*` **no** se configuran: Railway termina HTTPS en su proxy.
5. **Generar el dominio público**: *Settings → Networking → Generate Domain*, con **puerto destino `8080`** (el mismo `PORT` del contenedor). Copiarlo en `APP_ORIGIN`. Si el dominio apunta a otro puerto (p. ej. `3000`), el despliegue sale en verde —el health check usa `PORT`— pero todo el tráfico público responde **502**.
6. **Clerk**: con las claves de desarrollo (`pk_test_…`) la app funciona en el dominio `*.up.railway.app` sin más configuración. Una instancia de producción de Clerk exige un dominio propio con registros DNS, así que para una demostración corta conviene usar la de desarrollo.
7. **Primer administrador**: se asigna a mano en el dashboard de Clerk, como se explica en `docs/users/roles.md`. Los roles viven en Clerk, no en la base de datos, así que no se pierden al cambiar de volumen.

---

## Restricciones a tener en cuenta

- **Una sola réplica.** Railway no permite réplicas en un servicio con volumen, y SQLite tampoco admite más de un escritor entre procesos.
- **Un redeploy corta el servicio unos segundos**: Railway detiene el contenedor anterior antes de montar el volumen en el nuevo. Evitar redesplegar durante una clase.
- **Plan Trial**: volumen de 0,5 GB y 1 GB de RAM por servicio, de sobra para una sesión de clase. Railway borra los volúmenes de cuentas Trial 30 días después de que vence el crédito; si los datos importan, descargar el archivo antes.

## Observabilidad y diagnóstico

En producción cada línea de log es un objeto JSON con `level` y `message`, que Railway convierte en atributos filtrables (`@level:error`, `@path:/api/protocols`, `@message:request`).

| Evento | Qué dice |
| --- | --- |
| `server started` | Puerto, `NODE_ENV`, versión de Bun, `DATABASE_PATH`, si `CLERK_SECRET_KEY` está definida (nunca su valor), id del despliegue, commit y memoria. |
| `request` | Una línea por llamada a `/api/*`: método, ruta, estado y milisegundos; `error` y stack si lanzó. Los archivos de la SPA no pasan por código y no se registran. |
| `heartbeat` | Cada 10 min, `uptime` y memoria (`rssMb`). Si `uptime` se reinicia entre dos, el contenedor se reinició (un OOM no escribe nada propio). |
| `shutting down` / `process exit` | Railway detuvo el contenedor (`SIGTERM`) o el proceso terminó, con el código de salida. |
| `uncaught error` / `uncaught exception` | Error no controlado, con stack de las fuentes (`src/...`) gracias a los sourcemaps. |

`/api/health` también devuelve `uptime`, `rssMb` y `heapMb`.

**Si la página responde 502**: abrir `https://<dominio>/api/health`.

- También 502 y ninguna línea `request` en los logs → el tráfico no llega al proceso: revisar el **puerto destino del dominio** (paso 5).
- Responde 200 → el proceso está vivo; buscar `@level:error` en los logs.

Las líneas de BuildKit (`CDI setup error`, `failed to prepare cgroup controllers`, `running server on /run/buildkit/buildkitd.sock`) son del builder de Railway, no de la aplicación.

## Probar la imagen en local

```sh
docker build --build-arg PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_… -t tcp-trip .
docker run --rm -p 3000:8080 --env-file .env -e PORT=8080 \
  -e DATABASE_PATH=/app/data/tcp-trip.sqlite \
  -v tcp-trip-data:/app/data tcp-trip
curl localhost:3000/api/health
```
