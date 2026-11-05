# Despliegue en Railway

TCP-TRIP se despliega como **una sola imagen Docker**: el mismo proceso Bun sirve la API y la SPA, igual que en local. Los archivos que lo definen están en la raíz del repositorio:

| Archivo | Qué hace |
| --- | --- |
| `Dockerfile` | Imagen `oven/bun`, instala dependencias desde `bun.lockb` y arranca `bun src/index.ts` con `NODE_ENV=production`. |
| `.dockerignore` | Deja fuera `.env`, `data/`, `node_modules`, `dist`, tests y documentación. |
| `railway.json` | Le dice a Railway que construya con el `Dockerfile`, que compruebe `/api/health` antes de dar el despliegue por bueno y que reinicie si el proceso cae. |

No hay paso de build del frontend: Bun empaqueta `src/index.html` (TSX + Tailwind) al arrancar el servidor. Por eso las variables `PUBLIC_*` se leen del **entorno de ejecución** de Railway, no de argumentos de build.

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

   `PORT` lo inyecta Railway y Bun lo lee solo. Las variables `TLS_*` **no** se configuran: Railway termina HTTPS en su proxy.
5. **Generar el dominio público**: *Settings → Networking → Generate Domain*. Copiarlo en `APP_ORIGIN`.
6. **Clerk**: con las claves de desarrollo (`pk_test_…`) la app funciona en el dominio `*.up.railway.app` sin más configuración. Una instancia de producción de Clerk exige un dominio propio con registros DNS, así que para una demostración corta conviene usar la de desarrollo.
7. **Primer administrador**: se asigna a mano en el dashboard de Clerk, como se explica en `docs/users/roles.md`. Los roles viven en Clerk, no en la base de datos, así que no se pierden al cambiar de volumen.

---

## Restricciones a tener en cuenta

- **Una sola réplica.** Railway no permite réplicas en un servicio con volumen, y SQLite tampoco admite más de un escritor entre procesos.
- **Un redeploy corta el servicio unos segundos**: Railway detiene el contenedor anterior antes de montar el volumen en el nuevo. Evitar redesplegar durante una clase.
- **Plan Trial**: volumen de 0,5 GB y 1 GB de RAM por servicio, de sobra para una sesión de clase. Railway borra los volúmenes de cuentas Trial 30 días después de que vence el crédito; si los datos importan, descargar el archivo antes.

## Probar la imagen en local

```sh
docker build -t tcp-trip .
docker run --rm -p 3000:3000 --env-file .env \
  -e DATABASE_PATH=/app/data/tcp-trip.sqlite \
  -v tcp-trip-data:/app/data tcp-trip
curl localhost:3000/api/health
```
