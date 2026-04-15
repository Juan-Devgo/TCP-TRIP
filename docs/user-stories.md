# Historias de Usuario — TCP-TRIP

**Versión:** 1.2  
**Fecha:** 2026-04-14  
**Alcance:** Épicas E-001 a E-004, E-008 (V1.0–V1.1), E-005, E-006, E-007, E-009 (V2.0–V2.1)

---

## Convención

- **Prioridad:** Must / Should / Could (MoSCoW en nivel de historia)
- **Estado:** Por hacer / En progreso / Hecho / Parcialmente implementado
- Los criterios de aceptación (CA) usan formato GIVEN–WHEN–THEN.
- "Hecho" indica que la funcionalidad está implementada en la rama `main` según exploración del código.
- "Parcialmente implementado" indica que existe infraestructura o lógica parcial pero la funcionalidad completa no está operativa.

---

## E-008: Página de Inicio y Onboarding

### US-001: Ver la landing page con propuesta de valor clara

**Como** visitante no autenticado,  
**Quiero** acceder a la página de inicio y entender qué es TCP-TRIP y qué puedo hacer en la plataforma,  
**Para** decidir si quiero registrarme y comenzar a usarla.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario visita `/` o `/es`, WHEN la página carga, THEN ve una sección hero con el nombre TCP-TRIP, el tagline y dos botones: "Comenzar el viaje" (redirige a registro) y "Ver en GitHub".
- CA-2: GIVEN que el usuario está en la landing page, WHEN hace scroll, THEN ve secciones de características (herramientas), modelo TCP/IP y una sección "Por qué TCP-TRIP".
- CA-3: GIVEN que el usuario navega en español, WHEN accede a `/es`, THEN todos los textos están en español sin mezcla de idiomas.
- CA-4: GIVEN que el usuario navega en inglés, WHEN accede a `/`, THEN todos los textos están en inglés.
- CA-5: GIVEN que el usuario accede desde un dispositivo móvil (viewport < 768px), WHEN la página carga, THEN la navegación y el contenido son usables sin scroll horizontal.

**Prioridad:** Must  
**Estado:** Hecho

---

### US-002: Navegar entre secciones desde el menú principal

**Como** usuario (autenticado o no),  
**Quiero** usar el menú de navegación principal para acceder a cualquier sección de la plataforma,  
**Para** moverme fluidamente sin necesidad de recordar URLs.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario está en cualquier página, WHEN visualiza la Navbar, THEN ve enlaces a: Conversor de Bases, Modelo TCP/IP, Calculadora de Subredes, Constructor de Protocolos.
- CA-2: GIVEN que el usuario está autenticado, WHEN visualiza la Navbar, THEN también ve accesos a "Mis Protocolos" y "Mensajes".
- CA-3: GIVEN que el usuario no está autenticado, WHEN visualiza la Navbar, THEN ve un botón de "Iniciar sesión" / "Registrarse".
- CA-4: GIVEN que el usuario está en la versión en español, WHEN visualiza la Navbar, THEN todos los textos del menú están en español.
- CA-5: GIVEN que el usuario accede desde móvil, WHEN la pantalla es < 768px, THEN la Navbar muestra un menú hamburguesa funcional.

**Prioridad:** Must  
**Estado:** Hecho

---

### US-003: Registrarse e iniciar sesión con correo electrónico

**Como** estudiante nuevo,  
**Quiero** crear una cuenta en TCP-TRIP con mi correo electrónico,  
**Para** poder guardar mis protocolos y acceder a funcionalidades autenticadas.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario hace clic en "Comenzar el viaje" o "Registrarse", WHEN se abre el flujo de Clerk, THEN puede registrarse con correo y contraseña o con proveedor OAuth (si está configurado en Clerk).
- CA-2: GIVEN que el usuario ya tiene cuenta, WHEN hace clic en "Iniciar sesión", THEN puede autenticarse con sus credenciales y es redirigido a la página de inicio.
- CA-3: GIVEN que el usuario está autenticado, WHEN intenta acceder a `/my-protocols` o `/messages`, THEN la página carga sin redirigir a login.
- CA-4: GIVEN que el usuario no está autenticado, WHEN intenta acceder a `/my-protocols` o `/messages`, THEN es redirigido al flujo de login de Clerk.
- CA-5: GIVEN que el usuario cierra sesión, WHEN hace clic en "Cerrar sesión", THEN es redirigido a la landing page y el estado autenticado desaparece de la UI.

**Prioridad:** Must  
**Estado:** Hecho (Clerk integrado en middleware y componentes)

---

## E-001: Explorador del Modelo TCP/IP

### US-004: Explorar la descripción general del modelo TCP/IP

**Como** estudiante,  
**Quiero** ver una vista general del modelo TCP/IP con sus capas representadas visualmente,  
**Para** entender la arquitectura de comunicación de redes antes de profundizar en cada capa.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/tcp-ip` (o `/es/tcp-ip`), WHEN la página carga, THEN ve una representación visual de las 4-5 capas del modelo TCP/IP con el nombre de cada capa.
- CA-2: GIVEN que el usuario está en la vista general, WHEN hace clic en una capa, THEN es llevado a la página de detalle de esa capa.
- CA-3: GIVEN que el usuario está en la versión en español, THEN todos los nombres de capas y protocolos están en español.

**Prioridad:** Must  
**Estado:** Por hacer (la ruta `/tcp-ip` existe pero la vista general y la navegación entre capas están pendientes de implementación)

---

### US-005: Ver el detalle de la Capa de Aplicación

**Como** estudiante,  
**Quiero** acceder a la página de la Capa de Aplicación del modelo TCP/IP,  
**Para** conocer qué protocolos operan en esta capa (HTTP, DNS, DHCP, SSH, FTP, SMTP) y cuál es su función.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a la Capa de Aplicación, WHEN la página carga, THEN ve: nombre de la capa, descripción de su función, listado de protocolos principales con descripción breve de cada uno.
- CA-2: GIVEN que el usuario está en la página de la capa, THEN la información es precisa técnicamente (protocolos y puertos correctos).
- CA-3: GIVEN que el usuario quiere navegar a otra capa, WHEN usa la navegación entre capas, THEN puede moverse a la capa anterior o siguiente sin volver al índice.

**Prioridad:** Must  
**Estado:** Por hacer (componente `AppLayer.astro` existe pero no tiene contenido pedagógico aún)

---

### US-006: Ver el detalle de la Capa de Transporte

**Como** estudiante,  
**Quiero** acceder a la página de la Capa de Transporte,  
**Para** entender la diferencia entre TCP y UDP, el concepto de puertos y el control de flujo.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a la Capa de Transporte, WHEN la página carga, THEN ve la descripción de TCP y UDP, sus diferencias clave y los conceptos de puertos y control de flujo.
- CA-2: GIVEN que el usuario está viendo esta capa, THEN el contenido incluye al menos: orientado a conexión vs. sin conexión, fiabilidad, control de flujo, multiplexación de puertos.
- CA-3: GIVEN que la plataforma tiene un constructor de protocolos, THEN la página incluye un enlace o referencia al Constructor de Protocolos para que el estudiante pueda construir un encabezado TCP.

**Prioridad:** Must  
**Estado:** Por hacer (componente `TransportLayer.astro` existe pero no tiene contenido pedagógico aún)

---

### US-007: Ver el detalle de la Capa de Red

**Como** estudiante,  
**Quiero** acceder a la página de la Capa de Red,  
**Para** entender el protocolo IP, el direccionamiento y el enrutamiento.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a la Capa de Red, WHEN la página carga, THEN ve la descripción del protocolo IP, el concepto de dirección IP, máscaras de subred y enrutamiento.
- CA-2: GIVEN que la plataforma tiene una calculadora IPv4, THEN la página incluye un enlace directo a la Calculadora de Subredes.

**Prioridad:** Must  
**Estado:** Por hacer (componente `NetworkLayer.astro` existe pero no tiene contenido pedagógico aún)

---

### US-008: Ver el detalle de la Capa de Acceso a Red y la Capa Física

**Como** estudiante,  
**Quiero** acceder a la información de la Capa de Enlace de Datos (Acceso a Red) y la Capa Física,  
**Para** entender cómo los datos viajan a nivel de hardware y tramas.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a la Capa de Acceso a Red, WHEN la página carga, THEN ve la descripción de la capa, el concepto de dirección MAC y el protocolo Ethernet.
- CA-2: GIVEN que el usuario navega a la Capa Física, WHEN la página carga, THEN ve la descripción de los medios físicos de transmisión (cobre, fibra, Wi-Fi) y la representación de bits.

**Prioridad:** Should  
**Estado:** Por hacer (componentes `DataLinkLayer.astro` y `PhysicalLayer.astro` existen pero no tienen contenido pedagógico aún)

---

## E-002: Herramientas de Conversión y Cálculo

### US-009: Convertir un número entre bases numéricas

**Como** estudiante,  
**Quiero** ingresar un número en cualquier base (binaria, octal, decimal o hexadecimal) y ver su equivalente en todas las demás bases simultáneamente,  
**Para** entender la representación de valores en redes (p. ej., máscaras de subred en binario, valores de campos de protocolo en hexadecimal).

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/converters/base-converter`, WHEN ingresa un número en el campo de cualquier base, THEN los campos de las otras bases se actualizan automáticamente en tiempo real.
- CA-2: GIVEN que el usuario ingresa un valor inválido para la base seleccionada (p. ej., el dígito "9" en binario), WHEN el campo pierde el foco, THEN se muestra un mensaje de error descriptivo y los demás campos no muestran valores incorrectos.
- CA-3: GIVEN que la herramienta está en la versión en español, THEN todos los labels e instrucciones están en español.
- CA-4: GIVEN que el usuario está en la versión en inglés, THEN todos los textos están en inglés.
- CA-5: GIVEN que el usuario ingresa un número de hasta 32 bits, WHEN se convierte, THEN el resultado es correcto (sin desbordamiento de entero en JavaScript para el rango esperado).

**Prioridad:** Must  
**Estado:** Hecho (componente `NumberBaseConverter.astro` implementado)

---

### US-010: Convertir texto a código ASCII y viceversa

**Como** estudiante,  
**Quiero** ingresar texto y ver su representación ASCII (decimal, hexadecimal y binario por carácter), o ingresar códigos ASCII y obtener el texto correspondiente,  
**Para** entender cómo se codifica texto en los campos de protocolo de red (p. ej., campos ASCII en un encabezado personalizado).

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/converters/ascii-converter`, WHEN ingresa texto en el campo de entrada, THEN ve la representación en decimal, hexadecimal y binario de cada carácter.
- CA-2: GIVEN que el usuario ingresa códigos ASCII, WHEN confirma la entrada, THEN el campo de texto muestra el texto decodificado.
- CA-3: GIVEN que el usuario ingresa un carácter no ASCII estándar (> 127), THEN la herramienta indica que el carácter está fuera del rango ASCII estándar.
- CA-4: GIVEN que la herramienta está disponible en ambos idiomas, THEN la selección de idioma en el conversor ASCII persiste junto con la selección global.

**Prioridad:** Must  
**Estado:** Hecho (componente `AsciiConverter.astro` implementado)

---

### US-011: Calcular subredes IPv4 a partir de una dirección y prefijo

**Como** estudiante,  
**Quiero** ingresar una dirección IP y un prefijo de red (CIDR o máscara de subred) y obtener automáticamente la dirección de red, dirección de broadcast, rango de hosts, número de hosts disponibles y número de subredes posibles,  
**Para** aprender subnetting de forma práctica sin calcular manualmente.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/calculators/Ipv4Calculator`, WHEN ingresa una dirección IP válida en notación decimal punteada (p. ej., `192.168.1.0`) y un prefijo CIDR (p. ej., `/24`), THEN la calculadora muestra: dirección de red, máscara de subred, dirección de broadcast, primer host, último host, número de hosts utilizables.
- CA-2: GIVEN que el usuario ingresa una dirección IP inválida (p. ej., `999.1.1.1` o letras), THEN se muestra un mensaje de error descriptivo y no se calculan resultados.
- CA-3: GIVEN que el usuario ingresa un prefijo fuera del rango /0–/32, THEN se muestra un error indicando el rango válido.
- CA-4: GIVEN que el usuario cambia el prefijo, WHEN el valor es válido, THEN los resultados se recalculan automáticamente.
- CA-5: GIVEN que la herramienta está en español, THEN todos los campos, etiquetas y mensajes de error están en español.

**Prioridad:** Must  
**Estado:** Hecho (componente `Ipv4Calculator.tsx` implementado)

---

## E-003: Constructor de Protocolos — Estudiantes

### US-012: Crear un protocolo nuevo con campos personalizados

**Como** estudiante,  
**Quiero** acceder al Constructor de Protocolos y agregar campos con nombre, tipo y tamaño personalizados,  
**Para** diseñar un encabezado de protocolo propio que refleje lo aprendido en clase.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/protocol-creator`, WHEN la página carga, THEN ve el editor del Constructor de Protocolos con un protocolo de ejemplo pre-cargado (TCP Simplificado).
- CA-2: GIVEN que el usuario hace clic en "Agregar campo", WHEN aparece el panel de adición, THEN puede seleccionar el tipo de campo: `uint`, `flags`, `ascii`, `hex`, `ipv4`, `enum`, `padding`, `composite`.
- CA-3: GIVEN que el usuario define un campo de tipo `uint` con nombre "Puerto Origen" y tamaño 2 bytes, WHEN confirma, THEN el campo aparece en la lista y en el diagrama de bits del encabezado.
- CA-4: GIVEN que el usuario agrega un campo, WHEN el diagrama de bits se actualiza, THEN refleja correctamente la posición en bits y bytes del nuevo campo, respetando los campos existentes.
- CA-5: GIVEN que el usuario ingresa un campo sin nombre, WHEN intenta confirmarlo, THEN se muestra un mensaje de validación que impide agregar el campo sin nombre.

**Prioridad:** Must  
**Estado:** Hecho (ProtocolBuilder.tsx con AddFieldPanel.tsx implementados)

---

### US-013: Editar un campo existente en el protocolo

**Como** estudiante,  
**Quiero** seleccionar un campo del protocolo y modificar sus propiedades (nombre, tipo, tamaño, significado, sub-campos),  
**Para** corregir o refinar el diseño de mi protocolo sin tener que eliminarlo y crearlo de nuevo.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene campos en su protocolo, WHEN hace clic en un campo de la lista, THEN se abre el editor específico para el tipo de ese campo (p. ej., `UintEditor` para `uint`).
- CA-2: GIVEN que el editor de campo está abierto, WHEN el usuario modifica el tamaño del campo, THEN el diagrama de bits se actualiza en tiempo real reflejando el nuevo tamaño.
- CA-3: GIVEN que el campo es de tipo `composite`, WHEN el usuario lo selecciona, THEN puede agregar, editar y eliminar sub-campos, y la suma de bits de los sub-campos debe ser igual al tamaño total del campo compuesto.
- CA-4: GIVEN que el campo es de tipo `flags`, WHEN el usuario lo edita, THEN puede definir los nombres de cada bit de la bandera.
- CA-5: GIVEN que el campo es de tipo `enum`, WHEN el usuario lo edita, THEN puede agregar pares valor-etiqueta para las opciones del enumerado.

**Prioridad:** Must  
**Estado:** Hecho (FieldEditor.tsx y editores por tipo implementados)

---

### US-014: Reordenar y eliminar campos del protocolo

**Como** estudiante,  
**Quiero** mover campos hacia arriba o hacia abajo en la lista y eliminar campos que ya no necesito,  
**Para** organizar el encabezado de mi protocolo en el orden correcto.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene al menos dos campos en su protocolo, WHEN hace clic en el botón "Mover arriba" de un campo, THEN ese campo intercambia posición con el campo anterior y el diagrama de bits se actualiza.
- CA-2: GIVEN que el usuario tiene al menos dos campos, WHEN hace clic en "Mover abajo", THEN el campo intercambia posición con el siguiente y el diagrama se actualiza.
- CA-3: GIVEN que un campo ya está en la primera posición, THEN el botón "Mover arriba" está deshabilitado o no tiene efecto.
- CA-4: GIVEN que el usuario hace clic en "Eliminar" en un campo, WHEN confirma la acción, THEN el campo desaparece de la lista y del diagrama de bits.
- CA-5: GIVEN que el usuario usa "Duplicar" en un campo, WHEN se ejecuta la acción, THEN aparece una copia del campo inmediatamente después con el sufijo "(copia)" en el nombre.

**Prioridad:** Must  
**Estado:** Hecho (acciones moveField, removeField, duplicateField en ProtocolBuilder.tsx)

---

### US-015: Visualizar el diagrama de bits del encabezado en tiempo real

**Como** estudiante,  
**Quiero** ver una representación visual del encabezado de mi protocolo como un diagrama de bits (formato RFC-style),  
**Para** entender cómo se distribuyen los campos en el espacio de bytes del encabezado, igual que en los RFC.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene campos definidos en su protocolo, WHEN visualiza la sección del diagrama, THEN ve los campos representados en filas de 32 bits con sus nombres y tamaños indicados.
- CA-2: GIVEN que el usuario agrega, edita o elimina un campo, WHEN la operación se confirma, THEN el diagrama se actualiza inmediatamente sin recargar la página.
- CA-3: GIVEN que el usuario tiene un campo de tipo `composite`, THEN el diagrama muestra los sub-campos dentro del campo compuesto en la representación de bits.
- CA-4: GIVEN que el protocolo supera 32 bits en una fila, THEN el diagrama "rompe" correctamente a la siguiente fila manteniendo la alineación visual.
- CA-5: GIVEN que el usuario prefiere ocultar el diagrama, WHEN hace clic en el control de mostrar/ocultar, THEN el diagrama se colapsa y el editor de campos ocupa todo el ancho.

**Prioridad:** Must  
**Estado:** Hecho (HeaderVisualization.tsx implementado)

---

### US-016: Guardar un protocolo en la cuenta del usuario

**Como** estudiante autenticado,  
**Quiero** guardar el protocolo que estoy diseñando en mi cuenta,  
**Para** poder continuar editándolo en una sesión futura o compartirlo con otros.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario está autenticado y tiene campos en su protocolo, WHEN hace clic en "Guardar", THEN se llama a `POST /api/protocols` con nombre, descripción y campos, y el protocolo queda almacenado en PostgreSQL asociado a su `user_id`.
- CA-2: GIVEN que el protocolo ya fue guardado anteriormente (tiene un `id` asignado), WHEN el usuario hace clic en "Guardar" de nuevo, THEN se llama a `PUT /api/protocols/[id]` y se actualiza el registro existente (no se crea un duplicado).
- CA-3: GIVEN que el guardado fue exitoso, THEN el botón de guardar muestra un indicador visual de confirmación (p. ej., ícono de check) durante al menos 2 segundos.
- CA-4: GIVEN que el guardado falla (error de red o error 5xx), THEN se muestra un mensaje de error y el usuario puede reintentar.
- CA-5: GIVEN que el usuario no está autenticado, WHEN intenta guardar, THEN se le indica que debe iniciar sesión y se le presenta el flujo de autenticación de Clerk.

**Prioridad:** Must  
**Estado:** Hecho (lógica de save/update en ProtocolBuilder.tsx con API implementada)

---

### US-017: Exportar un protocolo como archivo JSON

**Como** estudiante,  
**Quiero** descargar el protocolo que diseñé como un archivo JSON,  
**Para** guardarlo localmente, compartirlo fuera de la plataforma o importarlo en otra herramienta.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene un protocolo con al menos un campo, WHEN hace clic en "Exportar JSON", THEN el navegador descarga un archivo `.json` con el nombre del protocolo normalizado (espacios reemplazados por guiones, en minúsculas).
- CA-2: GIVEN que el archivo JSON se descarga, THEN contiene el nombre, descripción y lista completa de campos con todas sus propiedades.
- CA-3: GIVEN que el usuario está en una sesión sin guardar (protocolo no persistido en BD), THEN la exportación JSON sigue funcionando porque opera sobre el estado local.

**Prioridad:** Should  
**Estado:** Hecho (función `handleExportJson` implementada en ProtocolBuilder.tsx)

---

### US-018: Compartir un protocolo mediante un código único

**Como** estudiante autenticado,  
**Quiero** generar un enlace o código de compartición para mi protocolo,  
**Para** que otro usuario (compañero o docente) pueda verlo sin necesidad de tener acceso a mi cuenta.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene un protocolo guardado, WHEN hace clic en "Compartir", THEN se llama a `POST /api/protocols/[id]/share` y se genera un `share_code` único.
- CA-2: GIVEN que el `share_code` fue generado, THEN el usuario ve la URL completa de compartición (p. ej., `https://tcp-trip.app/protocols/abc123`) y un botón para copiarla al portapapeles.
- CA-3: GIVEN que el botón de copiar fue pulsado, THEN el estado del botón cambia visualmente (ícono de check) para confirmar la copia, durante al menos 2 segundos.
- CA-4: GIVEN que cualquier usuario (autenticado o no) accede a la URL de compartición, WHEN la página carga, THEN ve el protocolo en modo lectura (solo visualización, sin edición).
- CA-5: GIVEN que el protocolo ya tiene un `share_code`, WHEN el propietario hace clic en "Compartir" nuevamente, THEN se muestra el código existente sin generar uno nuevo.

**Prioridad:** Should  
**Estado:** Hecho (API de share implementada, componente de UI en ProtocolBuilder.tsx)

---

### US-019: Ver y gestionar mis protocolos guardados

**Como** estudiante autenticado,  
**Quiero** acceder a una lista de todos mis protocolos guardados,  
**Para** abrir uno para continuar editándolo, eliminarlo si ya no lo necesito, o ver su estado de compartición.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/my-protocols`, WHEN la página carga, THEN ve una lista de sus protocolos ordenados por fecha de última actualización (más reciente primero).
- CA-2: GIVEN que el usuario tiene protocolos guardados, THEN cada elemento de la lista muestra: nombre, descripción, fecha de creación y botones de acción: Editar, Eliminar, Compartir.
- CA-3: GIVEN que el usuario hace clic en "Editar", WHEN es redirigido al Constructor de Protocolos, THEN el protocolo se carga completo en el editor (vía query param `?load=[id]` o ruta `/protocol-creator/header/[id]`).
- CA-4: GIVEN que el usuario hace clic en "Eliminar" y confirma, THEN se llama a `DELETE /api/protocols/[id]` y el protocolo desaparece de la lista.
- CA-5: GIVEN que el usuario no tiene protocolos guardados, THEN la página muestra un estado vacío con un mensaje invitando a crear el primer protocolo.
- CA-6: GIVEN que el usuario no está autenticado, WHEN intenta acceder a `/my-protocols`, THEN es redirigido al flujo de login de Clerk.

**Prioridad:** Must  
**Estado:** Hecho (MyProtocolsList.tsx implementado)

---

### US-020: Ver un protocolo compartido como visitante y clonarlo

**Como** visitante (autenticado o no),  
**Quiero** acceder a la URL de un protocolo compartido,  
**Para** ver su estructura y campos en modo lectura, y poder clonarlo a mi cuenta si soy usuario registrado.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario accede a `/protocols/[shareCode]` con un código válido, WHEN la página carga, THEN ve el nombre, descripción y la lista de campos del protocolo en modo lectura.
- CA-2: GIVEN que el código de compartición no existe o es inválido, THEN se muestra una página de error 404 con un mensaje descriptivo.
- CA-3: GIVEN que el usuario está en modo lectura, THEN no hay botones de edición, guardado ni eliminación visibles.
- CA-4: GIVEN que el visitante está autenticado y quiere usar el protocolo, THEN hay un botón visible "Clonar a mi cuenta" que crea una copia del protocolo en su cuenta.
- CA-5: GIVEN que el visitante no está autenticado, WHEN visualiza el botón de clonar, THEN se le indica que debe iniciar sesión para poder clonar, y al autenticarse se retoma el flujo de clonación.

**Prioridad:** Could  
**Estado:** Parcialmente implementado (la ruta `/protocols/[shareCode]` existe; la funcionalidad de clonar está parcialmente implementada)

---

## E-004: Sistema de Mensajes con Protocolos

### US-021: Enviar un mensaje usando un protocolo como plantilla

**Como** estudiante autenticado,  
**Quiero** seleccionar uno de mis protocolos guardados, completar los valores de sus campos y enviar el "paquete" resultante a otro usuario de la plataforma,  
**Para** simular el envío de un paquete de red usando el protocolo que diseñé.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario está autenticado y tiene al menos un protocolo guardado, WHEN accede a "Nuevo mensaje", THEN puede seleccionar uno de sus protocolos de una lista desplegable.
- CA-2: GIVEN que el usuario seleccionó un protocolo, THEN ve un formulario con un campo de entrada por cada campo del protocolo, con el tipo de entrada apropiado según el tipo del campo (número para `uint`, texto para `ascii`, selector para `enum`, etc.).
- CA-3: GIVEN que el usuario completa los campos del encabezado y escribe un payload de texto, WHEN hace clic en "Enviar", THEN se llama a `POST /api/messages` con `toUserId`, `protocolId`, `headerValues`, `payload` y `protocolSnapshot`.
- CA-4: GIVEN que el usuario necesita encontrar al destinatario, WHEN ingresa el correo electrónico del destinatario, THEN se llama a `GET /api/users/search` y se muestran usuarios coincidentes de Clerk.
- CA-5: GIVEN que el envío es exitoso, THEN aparece una confirmación visible y el mensaje queda en la bandeja de enviados del remitente.
- CA-6: GIVEN que el usuario intenta enviar sin completar campos obligatorios del encabezado, THEN se muestran mensajes de validación antes de llamar a la API.

**Prioridad:** Should  
**Estado:** Por hacer (la API está implementada, pero la interfaz de composición de mensaje está pendiente)

---

### US-022: Ver mensajes recibidos en la bandeja de entrada

**Como** estudiante autenticado,  
**Quiero** ver la lista de mensajes que otros usuarios me han enviado,  
**Para** revisar los protocolos que me compartieron y los valores de los campos de cada paquete.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/messages` (sin parámetros o con `?box=inbox`), WHEN la página carga, THEN ve una lista de mensajes recibidos ordenados por fecha descendente.
- CA-2: GIVEN que hay mensajes en la bandeja, THEN cada elemento muestra: nombre del remitente, nombre del protocolo usado, fecha de recepción e indicador de leído/no leído.
- CA-3: GIVEN que el usuario hace clic en un mensaje, WHEN se abre el detalle, THEN ve el encabezado completo con cada campo del protocolo y su valor correspondiente, más el payload de texto.
- CA-4: GIVEN que el usuario abre un mensaje no leído, THEN se llama a `PUT /api/messages/[id]/read` y el indicador de no leído desaparece.
- CA-5: GIVEN que no hay mensajes en la bandeja, THEN se muestra un estado vacío descriptivo.

**Prioridad:** Should  
**Estado:** Hecho (MessagesView.tsx implementado con bandeja de entrada)

---

### US-023: Ver mensajes enviados

**Como** estudiante autenticado,  
**Quiero** ver los mensajes que he enviado a otros usuarios,  
**Para** tener un registro de los paquetes que envié y confirmar que fueron enviados correctamente.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario navega a `/messages?box=sent`, WHEN la página carga, THEN ve la lista de mensajes enviados ordenados por fecha descendente.
- CA-2: GIVEN que hay mensajes enviados, THEN cada elemento muestra: nombre del destinatario, nombre del protocolo, fecha de envío.
- CA-3: GIVEN que el usuario hace clic en un mensaje enviado, THEN ve el mismo detalle que el destinatario: campos del protocolo con sus valores y el payload.

**Prioridad:** Should  
**Estado:** Hecho (MessagesView.tsx implementado con bandeja de enviados)

---

### US-024: Recibir indicador de mensajes no leídos en la navegación

**Como** estudiante autenticado,  
**Quiero** ver una notificación visual en la Navbar cuando tengo mensajes no leídos,  
**Para** saber que alguien me envió un mensaje sin necesidad de ingresar a la bandeja.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene mensajes no leídos, WHEN visualiza la Navbar, THEN el enlace "Mensajes" muestra un badge con el número de mensajes no leídos.
- CA-2: GIVEN que el usuario lee todos los mensajes, WHEN regresa a cualquier página, THEN el badge desaparece.
- CA-3: GIVEN que el usuario no está autenticado, THEN no se muestra ningún badge de mensajes.

**Prioridad:** Could  
**Estado:** Por hacer

---

## E-007: Gestión de Usuarios y Roles

> Las historias de E-007 tienen versión objetivo V2.0. No entran en V1.0 ni V1.1.

### US-025: Solicitar el rol de docente desde el perfil

**Como** usuario registrado con rol de estudiante,  
**Quiero** enviar una solicitud para obtener el rol de docente desde mi página de perfil,  
**Para** acceder al modo clase y las herramientas pedagógicas una vez que mi solicitud sea aprobada.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario está autenticado con rol de estudiante, WHEN accede a su perfil, THEN ve una sección "Rol en la plataforma" con un botón "Solicitar rol docente".
- CA-2: GIVEN que el usuario hace clic en "Solicitar rol docente", WHEN confirma la acción, THEN se crea un registro en la tabla `role_requests` de PostgreSQL con estado `pending` y se muestra un mensaje de confirmación indicando que la solicitud está en revisión.
- CA-3: GIVEN que el usuario ya tiene una solicitud pendiente, THEN el botón de solicitar está deshabilitado y se muestra el estado "Solicitud pendiente de aprobación".
- CA-4: GIVEN que la solicitud fue rechazada, WHEN el usuario accede a su perfil, THEN ve el estado "Solicitud rechazada" con el comentario del administrador (si existe) y puede volver a solicitar.
- CA-5: GIVEN que la solicitud fue aprobada, WHEN el usuario accede a su perfil, THEN ve su rol como "Docente" y tiene acceso a las funcionalidades de docente.

**Prioridad:** Must (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

## E-009: Panel de Administración

> Las historias de E-009 tienen versión objetivo V2.0. No entran en V1.0 ni V1.1.

### US-026: Ver y gestionar la lista de usuarios registrados

**Como** administrador,  
**Quiero** acceder a una lista completa de todos los usuarios registrados en la plataforma,  
**Para** monitorear la comunidad, identificar comportamientos anómalos y gestionar cuentas.

**Criterios de aceptación:**
- CA-1: GIVEN que el administrador navega a `/admin/users`, WHEN la página carga, THEN ve una tabla con todos los usuarios registrados, mostrando: nombre, correo, rol actual, fecha de registro y estado de cuenta (activa/baneada).
- CA-2: GIVEN que el administrador visualiza la lista, THEN puede filtrar usuarios por rol (estudiante, docente) y por estado (activo, baneado).
- CA-3: GIVEN que el administrador hace clic en un usuario, WHEN se abre el detalle, THEN ve la actividad reciente del usuario (últimos protocolos creados, mensajes enviados, fecha de último acceso).
- CA-4: GIVEN que un usuario no autenticado o no administrador intenta acceder a `/admin/*`, THEN es redirigido con error 403.

**Prioridad:** Must (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-027: Banear y desbanear una cuenta de usuario

**Como** administrador,  
**Quiero** poder banear una cuenta de usuario y desbanearla posteriormente,  
**Para** responder a comportamientos abusivos o inapropiados en la plataforma.

**Criterios de aceptación:**
- CA-1: GIVEN que el administrador está en el detalle de un usuario activo, WHEN hace clic en "Banear cuenta", THEN se le pide un motivo obligatorio y, al confirmar, el estado del usuario cambia a baneado en la base de datos.
- CA-2: GIVEN que un usuario está baneado, WHEN intenta iniciar sesión o acceder a cualquier ruta autenticada, THEN el middleware lo redirige a una página de cuenta suspendida con el motivo del baneo.
- CA-3: GIVEN que el administrador está en el detalle de un usuario baneado, WHEN hace clic en "Desbanear", THEN el estado del usuario vuelve a activo y puede iniciar sesión normalmente.
- CA-4: GIVEN que el administrador está en la lista de usuarios, THEN los usuarios baneados se distinguen visualmente (etiqueta "Baneado" en la tabla).

**Prioridad:** Should (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-028: Revisar y aprobar solicitudes de rol docente

**Como** administrador,  
**Quiero** ver las solicitudes de rol docente pendientes y aprobarlas o rechazarlas con un comentario,  
**Para** garantizar que solo usuarios legítimos obtengan el rol de docente.

**Criterios de aceptación:**
- CA-1: GIVEN que el administrador navega a `/admin/role-requests`, WHEN la página carga, THEN ve la lista de solicitudes pendientes ordenadas por fecha de solicitud (más antigua primero), con el nombre y correo del solicitante.
- CA-2: GIVEN que el administrador hace clic en "Aprobar" en una solicitud, WHEN confirma, THEN el estado de la solicitud cambia a `approved`, el rol del usuario se actualiza a `teacher` en Clerk `publicMetadata`, y el usuario recibe una notificación (o puede ver el cambio en su perfil).
- CA-3: GIVEN que el administrador hace clic en "Rechazar", WHEN ingresa un comentario y confirma, THEN el estado cambia a `rejected` con el comentario almacenado, y el usuario puede ver el motivo en su perfil.
- CA-4: GIVEN que no hay solicitudes pendientes, THEN la página muestra un estado vacío con el mensaje "No hay solicitudes pendientes".
- CA-5: GIVEN que hay solicitudes pendientes, WHEN el administrador accede al panel principal (`/admin`), THEN ve un contador de solicitudes pendientes en el resumen del panel.

**Prioridad:** Must (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-029: Ver un resumen del estado de la plataforma en el panel principal

**Como** administrador,  
**Quiero** acceder a un panel principal con métricas clave de la plataforma,  
**Para** tener visibilidad rápida del estado de la comunidad sin necesidad de explorar cada sección.

**Criterios de aceptación:**
- CA-1: GIVEN que el administrador navega a `/admin`, WHEN la página carga, THEN ve un resumen con: total de usuarios registrados, usuarios activos en los últimos 7 días, total de protocolos creados, total de mensajes enviados y número de solicitudes de rol docente pendientes.
- CA-2: GIVEN que hay solicitudes de rol pendientes, THEN el contador de solicitudes pendientes se muestra de forma destacada (badge de alerta) para que el administrador las atienda.
- CA-3: GIVEN que el administrador accede al panel, THEN los datos reflejan el estado actual de la base de datos (no datos en caché con más de 5 minutos de antigüedad).

**Prioridad:** Should (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

## E-005: Modo Clase / Presentación — Docentes

> Las historias de E-005 tienen versión objetivo V2.0. No entran en V1.0 ni V1.1.

### US-030: Activar el modo clase / presentación desde cualquier sección

**Como** docente con rol aprobado,  
**Quiero** activar un modo de presentación optimizado para proyector desde cualquier sección de la plataforma,  
**Para** exponer el contenido pedagógico en el aula sin que los elementos secundarios de la interfaz distraigan a los estudiantes.

**Criterios de aceptación:**
- CA-1: GIVEN que el usuario tiene rol `teacher`, WHEN accede a cualquier sección de la plataforma, THEN ve un botón o control visible "Modo clase" en la interfaz.
- CA-2: GIVEN que el docente activa el modo clase, WHEN la transición se completa, THEN la interfaz muestra: fondo blanco o de alto contraste, tipografía mínima de 18px, sin elementos de navegación secundarios en los bordes.
- CA-3: GIVEN que el modo clase está activo, WHEN el docente navega entre secciones, THEN la interfaz permanece en modo presentación sin requerir activarlo de nuevo.
- CA-4: GIVEN que el docente desea salir del modo clase, WHEN hace clic en "Salir del modo clase", THEN la interfaz vuelve a su estado normal.
- CA-5: GIVEN que un usuario con rol `student` accede a la plataforma, THEN el botón "Modo clase" no es visible.

**Prioridad:** Should (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

## E-006: Generación de Ejercicios — Docentes

> Las historias de E-006 tienen versión objetivo V2.0 (US-032 a US-037) y V2.1 (US-038 a US-039). No entran en V1.0 ni V1.1.

### US-032: Generar ejercicios desde el conversor de bases numéricas

**Como** docente con rol aprobado,  
**Quiero** generar un conjunto de ejercicios de conversión entre bases numéricas desde el componente conversor de bases, especificando la cantidad de ejercicios y si deben incluir la solución con procedimiento paso a paso,  
**Para** obtener material evaluativo listo para usar en clase sin redactar cada ejercicio manualmente.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente está en el conversor de bases (`/converters/base-converter`) con rol `teacher`, WHEN hace clic en "Generar ejercicios", THEN se abre un panel de configuración con las opciones: cantidad de ejercicios (1–20), bases de origen y destino (binario, octal, decimal, hexadecimal), nivel de dificultad (fácil: números ≤ 255 / medio: ≤ 65535 / difícil: ≤ 2³²−1), y la opción de incluir solución con procedimiento.
- CA-2: GIVEN que el docente confirma la configuración, WHEN el motor genera los ejercicios, THEN cada ejercicio tiene: enunciado claro en español (p. ej., "Convierta 192 (decimal) a hexadecimal"), y si se incluyó solución, el procedimiento completo con cada paso de la división sucesiva o el método de conversión correspondiente.
- CA-3: GIVEN que los ejercicios fueron generados, THEN se muestra una vista previa del documento con presentación profesional antes de permitir la exportación.
- CA-4: GIVEN que el docente aprueba la vista previa, WHEN hace clic en "Guardar en biblioteca", THEN los ejercicios se almacenan en PostgreSQL en la tabla `exercises` con metadatos: `source_component = 'base-converter'`, `created_at`, `status = 'draft'`, `include_solution`, `is_custom = false`.
- CA-5: GIVEN que el docente no tiene rol `teacher` aprobado, WHEN intenta acceder al panel de generación de ejercicios, THEN recibe un mensaje de acceso restringido y un enlace para solicitar el rol desde su perfil.

**Prioridad:** Could (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-033: Generar ejercicios desde la calculadora IPv4

**Como** docente con rol aprobado,  
**Quiero** generar un conjunto de ejercicios de subnetting IPv4 desde la calculadora, especificando la cantidad, el rango de prefijos de red y si incluyen solución,  
**Para** preparar prácticas de subnetting para mis estudiantes sin calcular las direcciones manualmente.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente está en la calculadora IPv4 (`/calculators/Ipv4Calculator`) con rol `teacher`, WHEN hace clic en "Generar ejercicios", THEN se abre un panel de configuración con: cantidad de ejercicios (1–10), rango de prefijos permitido (p. ej., /20 a /30), opción de incluir solución y opción de incluir preguntas derivadas (p. ej., "¿Cuántos hosts utilizables tiene esta red?").
- CA-2: GIVEN que el docente confirma la configuración, WHEN el motor genera los ejercicios, THEN cada ejercicio tiene: una dirección IP y prefijo generados aleatoriamente dentro del rango configurado, el enunciado pidiendo calcular dirección de red, broadcast, primer host, último host y número de hosts, y si se incluyó solución, cada operación AND/OR de la máscara explicada paso a paso.
- CA-3: GIVEN que los ejercicios fueron generados, THEN se muestra una vista previa del documento con presentación profesional.
- CA-4: GIVEN que el docente aprueba la vista previa, WHEN hace clic en "Guardar en biblioteca", THEN los ejercicios se almacenan con `source_component = 'ipv4-calculator'` y los metadatos de trazabilidad correspondientes.
- CA-5: GIVEN que el motor genera una dirección IP, THEN la dirección es siempre válida (no .0 ni .255 como host en redes de host único, prefijo coherente con la dirección).

**Prioridad:** Could (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-034: Generar ejercicios desde el conversor ASCII

**Como** docente con rol aprobado,  
**Quiero** generar ejercicios de codificación y decodificación ASCII desde el conversor ASCII, especificando la cantidad y la dirección de conversión (texto → ASCII o ASCII → texto),  
**Para** que mis estudiantes practiquen la representación de caracteres en el contexto de campos de protocolo de red.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente está en el conversor ASCII (`/converters/ascii-converter`) con rol `teacher`, WHEN hace clic en "Generar ejercicios", THEN se abre un panel de configuración con: cantidad de ejercicios (1–20), dirección de conversión (texto → decimal/hexadecimal/binario; decimal → texto; hexadecimal → texto), longitud de la cadena (1 a 8 caracteres), y opción de incluir solución.
- CA-2: GIVEN que el docente confirma la configuración, WHEN el motor genera los ejercicios, THEN cada ejercicio tiene: el enunciado con el valor dado (texto o código ASCII), la pregunta de conversión, y si se incluyó solución, el valor de cada carácter en la base solicitada con su equivalencia explícita.
- CA-3: GIVEN que los ejercicios fueron generados, THEN se muestra una vista previa del documento con presentación profesional.
- CA-4: GIVEN que el docente aprueba la vista previa, WHEN hace clic en "Guardar en biblioteca", THEN los ejercicios se almacenan con `source_component = 'ascii-converter'` y los metadatos de trazabilidad correspondientes.
- CA-5: GIVEN que el motor genera cadenas de texto aleatorias, THEN los caracteres generados pertenecen al rango ASCII estándar imprimible (32–126) para garantizar que los ejercicios sean legibles y reproducibles en papel.

**Prioridad:** Could (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-035: Generar ejercicio basado en un protocolo del constructor

**Como** docente con rol aprobado,  
**Quiero** seleccionar un protocolo existente del constructor y generar un ejercicio de interpretación de encabezado a partir de él,  
**Para** que mis estudiantes practiquen la lectura y decodificación de encabezados de protocolo reales.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente está en la vista de un protocolo en el constructor con rol `teacher`, WHEN hace clic en "Generar ejercicio de interpretación", THEN puede seleccionar qué campos del protocolo se mostrarán con valores aleatorios y cuáles el estudiante deberá identificar.
- CA-2: GIVEN que el docente confirma la configuración, WHEN el motor genera el ejercicio, THEN el enunciado presenta el encabezado del protocolo en formato de bits (RFC-style) con valores aleatorios válidos para cada campo según su tipo, y la pregunta pide identificar el valor de uno o más campos designados.
- CA-3: GIVEN que se incluyó la solución, THEN la solución indica campo por campo cómo leer el valor del diagrama de bits (posición de inicio, tamaño en bits, conversión al tipo correspondiente).
- CA-4: GIVEN que el docente aprueba la vista previa, WHEN hace clic en "Guardar en biblioteca", THEN los ejercicios se almacenan con `source_component = 'protocol-builder'`, el `protocol_id` del protocolo origen como referencia, y los metadatos de trazabilidad correspondientes.
- CA-5: GIVEN que el protocolo origen tiene campos de tipo `enum`, THEN los valores generados para esos campos son siempre valores definidos en el enumerado (no valores arbitrarios fuera del rango).

**Prioridad:** Could (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-036: Exportar ejercicios como documento con presentación profesional

**Como** docente con rol aprobado,  
**Quiero** descargar los ejercicios generados como un archivo PDF o copiarlos al portapapeles en formato de texto enriquecido,  
**Para** distribuirlos a mis estudiantes por los canales que ya uso (correo, plataforma del curso, impresión).

**Criterios de aceptación:**
- CA-1: GIVEN que el docente tiene ejercicios generados o guardados en su biblioteca con estado `published` o `draft`, WHEN hace clic en "Exportar como PDF", THEN el navegador descarga un archivo `.pdf` con nombre normalizado (p. ej., `ejercicios-base-converter-2026-04-14.pdf`).
- CA-2: GIVEN que el PDF se genera, THEN incluye: encabezado con título del ejercicio, componente origen, fecha de generación y nombre del docente; enunciados numerados; y si `include_solution = true`, la sección de soluciones al final del documento claramente separada de los enunciados.
- CA-3: GIVEN que el docente hace clic en "Copiar al portapapeles", THEN el contenido del documento se copia en formato de texto estructurado (markdown o texto plano con sangría) que pueda pegarse en un editor de texto o correo sin perder la estructura.
- CA-4: GIVEN que la generación del PDF falla (error del servidor o librería), THEN se muestra un mensaje de error descriptivo y se ofrece la opción de copiar al portapapeles como alternativa.
- CA-5: GIVEN que el docente accede a la vista previa del documento antes de exportar, THEN el formato visual del PDF corresponde fielmente a lo que se muestra en la vista previa (sin cambios en saltos de página o numeración).

**Prioridad:** Could (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-037: Crear un ejercicio personalizado con pregunta redactada por el docente

**Como** docente con rol aprobado,  
**Quiero** redactar manualmente el enunciado de un ejercicio y opcionalmente su solución, y guardarlo en mi biblioteca con los mismos metadatos de trazabilidad que los ejercicios auto-generados,  
**Para** crear preguntas específicas adaptadas al contexto de mi clase que no se pueden generar automáticamente.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente accede a su biblioteca de ejercicios, WHEN hace clic en "Nuevo ejercicio personalizado", THEN se abre un formulario con: campo de título, selector de componente origen (base-converter, ascii-converter, ipv4-calculator, protocol-builder, otro), campo de texto enriquecido para el enunciado, campo opcional para la solución con procedimiento, y selector de estado (borrador / publicado).
- CA-2: GIVEN que el docente completa el formulario y hace clic en "Guardar", WHEN la operación es exitosa, THEN el ejercicio se almacena en PostgreSQL con `is_custom = true`, el `source_component` seleccionado, `created_at` y `status` correspondientes.
- CA-3: GIVEN que el docente guarda el ejercicio, THEN aparece en su biblioteca de ejercicios junto con los auto-generados, con un indicador visual que lo distingue como "Personalizado".
- CA-4: GIVEN que el docente deja el campo de solución vacío, THEN el ejercicio se guarda correctamente con `include_solution = false` y el campo de solución en blanco.
- CA-5: GIVEN que el docente intenta guardar sin título o sin enunciado, THEN se muestra un mensaje de validación que impide guardar y señala los campos obligatorios faltantes.

**Prioridad:** Could (para V2.0)  
**Estado:** Por hacer  
**Versión objetivo:** V2.0

---

### US-038: Ver y gestionar la biblioteca de ejercicios con metadatos de trazabilidad

**Como** docente con rol aprobado,  
**Quiero** acceder a una vista de mi biblioteca de ejercicios con la posibilidad de filtrar por componente, estado y fecha, y ver los metadatos de trazabilidad de cada ejercicio,  
**Para** encontrar rápidamente ejercicios anteriores, reutilizarlos y llevar un registro de su uso.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente navega a su biblioteca de ejercicios (`/my-exercises` o equivalente), WHEN la página carga, THEN ve una lista de todos sus ejercicios ordenados por fecha de creación descendente, con columnas: título, componente origen, fecha de creación, estado (borrador/publicado/archivado) e indicador de si incluye solución.
- CA-2: GIVEN que el docente visualiza la biblioteca, THEN puede filtrar los ejercicios por: componente origen (base-converter, ascii-converter, ipv4-calculator, protocol-builder, personalizado) y estado (borrador, publicado, archivado).
- CA-3: GIVEN que el docente hace clic en un ejercicio, WHEN se abre el detalle, THEN ve todos los metadatos de trazabilidad: fecha de creación, componente origen, estado, si tiene ejercicio padre (con enlace al padre si aplica), historial de uso (clases o grupos donde se usó) y opción de cambiar el estado.
- CA-4: GIVEN que el docente quiere archivar un ejercicio, WHEN hace clic en "Archivar", THEN el estado del ejercicio cambia a `archived` y deja de aparecer en las listas de ejercicios activos (pero sigue disponible filtrando por "Archivados").
- CA-5: GIVEN que el docente no tiene ejercicios guardados, THEN la biblioteca muestra un estado vacío con un mensaje invitando a generar el primer ejercicio.

**Prioridad:** Could (para V2.1)  
**Estado:** Por hacer  
**Versión objetivo:** V2.1

---

### US-039: Registrar el uso de un ejercicio en una clase o grupo

**Como** docente con rol aprobado,  
**Quiero** registrar cuándo y en qué clase o grupo usé un ejercicio de mi biblioteca,  
**Para** llevar trazabilidad del historial de uso y evitar repetir los mismos ejercicios con los mismos estudiantes.

**Criterios de aceptación:**
- CA-1: GIVEN que el docente está en el detalle de un ejercicio de su biblioteca, WHEN hace clic en "Registrar uso", THEN se abre un formulario con: fecha de uso (por defecto la fecha actual), nombre del grupo o curso (texto libre), y campo de observaciones opcional.
- CA-2: GIVEN que el docente completa el formulario y confirma, WHEN la operación es exitosa, THEN se crea un registro en la tabla `exercise_usage_log` asociado al ejercicio y al docente, con la fecha, el grupo y las observaciones ingresados.
- CA-3: GIVEN que el ejercicio tiene registros de uso, WHEN el docente visualiza el detalle del ejercicio, THEN ve el historial completo de uso: lista de entradas con fecha, nombre del grupo y observaciones, ordenada por fecha descendente.
- CA-4: GIVEN que el docente quiere eliminar un registro de uso incorrecto, WHEN hace clic en "Eliminar registro" en una entrada del historial y confirma, THEN el registro se elimina de `exercise_usage_log` y el historial se actualiza.
- CA-5: GIVEN que el docente accede a la biblioteca de ejercicios, THEN cada ejercicio muestra un contador de veces que ha sido usado, derivado del número de registros en `exercise_usage_log`.

**Prioridad:** Could (para V2.1)  
**Estado:** Por hacer  
**Versión objetivo:** V2.1

---

## Changelog

| Versión | Fecha | Cambio |
|---------|-------|--------|
| 1.0 | 2026-04-14 | Versión inicial (US-001 a US-024) |
| 1.1 | 2026-04-14 | Corrección de estados en US-005, US-006, US-007, US-008: los componentes de capa existen pero no tienen contenido — estado corregido a "Por hacer". Actualización de US-020 a "Parcialmente implementado" y mejora de criterios de aceptación para clonar. Actualización de US-016 para referenciar PostgreSQL. Adición de US-025 (E-007) y US-026 a US-029 (E-009). |
| 1.2 | 2026-04-14 | Adición de US-030 (E-005, Modo clase). Adición de sección completa E-006 con US-032 a US-039: generación desde base-converter (US-032), desde ipv4-calculator (US-033), desde ascii-converter (US-034), desde protocol-builder (US-035), exportación como PDF (US-036), ejercicio personalizado (US-037), biblioteca con metadatos (US-038, V2.1) y registro de uso (US-039, V2.1). Nota: US-031 estaba reservada como marcador en el roadmap para generación de ejercicios de subnetting; queda subsumida por US-033 (generación desde ipv4-calculator). |
