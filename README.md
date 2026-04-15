# TCP-TRIP

**Plataforma web educativa bilingüe para el aprendizaje de protocolos de red.**

TCP-TRIP acompaña a estudiantes universitarios de redes y comunicaciones en su recorrido por el mundo de los protocolos TCP/IP. La plataforma ofrece herramientas interactivas, un explorador de capas de red y un constructor visual de encabezados de protocolo, todo en un entorno diseñado específicamente para el contexto académico.

---

## Para quién es

| Rol | Acceso |
|-----|--------|
| **Estudiante** | Acceso inmediato al registro. Puede explorar herramientas, construir protocolos, compartirlos con compañeros y enviar mensajes estructurados. |
| **Docente** | Rol con aprobación de administrador. Accede a modo clase/presentación optimizado para proyector y a la generación de ejercicios evaluativos. |
| **Administrador** | Panel de gestión de usuarios y aprobación/rechazo de solicitudes de rol docente. |

---

## Funcionalidades actuales (V1.0)

- **Explorador TCP/IP por capas** — recorre las cinco capas del modelo TCP/IP con descripciones de protocolos por capa (HTTP, DNS, TCP, UDP, IP, Ethernet, etc.)
- **Constructor de Protocolos (Protocol Builder)** — diseña visualmente encabezados de protocolo con campos tipados (uint, flags, ASCII, IPv4, hex, enum, padding, composite), previsualización estilo RFC en tiempo real y diagramas de 32 bits por fila
- **Calculadora de Subredes IPv4** — calcula direcciones de red, broadcast, máscara wildcard, rangos de hosts y subredes con soporte CIDR
- **Conversor de Bases Numéricas** — convierte entre binario, octal, decimal y hexadecimal
- **Conversor ASCII** — traduce texto a valores ASCII y viceversa, con soporte de múltiples bases y carga/descarga de archivos .txt
- **Mis Protocolos** — gestión de protocolos guardados con compartición mediante código único
- **Mensajes estructurados** — envía encabezados de protocolo completos a otros estudiantes
- **Autenticación** — registro e inicio de sesión con Clerk; soporte bilingüe ES/EN

---

## Próximas versiones

### V1.1 — Sistema de colaboración
- Mejoras al sistema de mensajes entre estudiantes
- Notificaciones de mensajes recibidos
- Vista mejorada de protocolos compartidos

### V2.0 — Modo clase (primer semestre 2027)
- **Modo presentación** para docentes: interfaz optimizada para proyector en el aula
- **Generación de ejercicios** evaluativos basados en los protocolos construidos
- **Panel de administración** completo: gestión de usuarios, aprobación de solicitudes de rol docente, estadísticas de uso

---

## Contexto académico

TCP-TRIP es el producto del **Trabajo de Grado** de la **Universidad del Quindío**, desarrollado como herramienta de apoyo para cursos de Redes y Comunicaciones en programas de Ingeniería de Sistemas y afines.

El objetivo es reducir la brecha entre la teoría de protocolos de red y la práctica, poniendo en manos de los estudiantes herramientas visuales e interactivas que antes solo existían en libros de texto o simuladores de pago.

---

## Idiomas

La plataforma está disponible en **español** (ruta raíz `/`) e **inglés** (ruta `/en/`).
