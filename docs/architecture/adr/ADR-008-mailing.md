# ADR-008: Mailing via Clerk Email API

**Estado:** Aceptado  
**Fecha:** 2026-04-15  
**Deciders:** Equipo TCP-TRIP

---

## Contexto

La plataforma necesita enviar notificaciones por correo electrónico en dos eventos concretos:

1. **Aprobación de solicitud de rol docente** — El admin aprueba y el usuario debe ser notificado.
2. **Rechazo de solicitud de rol docente** — El admin rechaza con motivo opcional.

Se evaluó implementar un servicio de email independiente (Resend, SendGrid, Nodemailer con SMTP), pero el proyecto ya usa Clerk como proveedor de autenticación, el cual expone una API para envío de emails a sus usuarios registrados.

---

## Decisión

Usar la **API de emails de Clerk** (`clerkClient.emails.createEmail()`) para el envío de notificaciones transaccionales.

No se integra ningún proveedor de email externo adicional en V1.x ni V2.0.

---

## Implementación

El envío se realiza desde los API Routes del servidor (nunca desde el cliente). Patrón:

```typescript
// src/shared/lib/mail.ts
import { clerkClient } from '@clerk/astro/server';

export async function sendRoleApprovalEmail(toUserId: string, role: 'teacher') {
  await clerkClient.emails.createEmail({
    fromEmailName: 'tcp-trip',
    subject: 'Tu solicitud de rol docente fue aprobada',
    body: `Tu cuenta ahora tiene acceso al rol docente en TCP-TRIP.`,
    emailAddressId: await getPrimaryEmailAddressId(toUserId),
  });
}

export async function sendRoleRejectionEmail(toUserId: string, reason?: string) {
  await clerkClient.emails.createEmail({
    fromEmailName: 'tcp-trip',
    subject: 'Tu solicitud de rol docente no fue aprobada',
    body: reason
      ? `Tu solicitud fue rechazada. Motivo: ${reason}`
      : 'Tu solicitud fue rechazada. Contacta al administrador para más información.',
    emailAddressId: await getPrimaryEmailAddressId(toUserId),
  });
}

async function getPrimaryEmailAddressId(userId: string): Promise<string> {
  const user = await clerkClient.users.getUser(userId);
  const primary = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId);
  if (!primary) throw new Error(`Usuario ${userId} no tiene email primario`);
  return primary.id;
}
```

**Integración en el flujo de aprobación de rol:**

```
POST /api/admin/role-requests/[id]/approve
  → Actualizar publicMetadata en Clerk (rol = 'teacher')
  → Actualizar role_requests en BD (status = 'approved')   ← con retry (ADR-007)
  → sendRoleApprovalEmail(userId)                           ← fire-and-forget, no bloquea
```

El envío de email es **fire-and-forget**: si falla, se registra en log pero no revierte la aprobación. El admin puede volver a notificar manualmente si fuera necesario.

---

## Restricciones

- Solo se pueden enviar emails a usuarios que tengan una cuenta en Clerk con email verificado.
- El dominio del remitente (`fromEmailName`) debe estar configurado en el dashboard de Clerk.
- Clerk impone rate limits en el envío de emails; no es adecuado para envíos masivos. Esto es aceptable dado que los eventos de aprobación son infrecuentes.
- No se envían emails a usuarios no registrados en Clerk.
- El idioma del email no está internacionalizado en V2.0 — se envía en español. Mejora pendiente para V2.1 si se requiere.

---

## Consecuencias

### Positivas
- Sin dependencias adicionales ni configuración SMTP.
- Los emails se envían a la dirección verificada del usuario (garantía de Clerk).
- Sin costo adicional dentro del plan de Clerk usado por el proyecto.
- Implementación simple: una llamada a la API de Clerk.

### Negativas / Trade-offs
- **Vendor lock-in:** Si se migra de Clerk, el sistema de mailing debe rehacerse.
- **Control limitado sobre plantillas:** Las opciones de formato de Clerk son más restrictivas que un proveedor dedicado (Resend, SendGrid).
- **Sin historial de emails en la BD:** No se almacena registro de emails enviados. Si se necesita auditoría, deberá implementarse en V2.1.
- **Fire-and-forget:** Un fallo en el envío no se reintenta automáticamente.

### Riesgos
- Si Clerk depreca o cambia su API de emails, hay que actualizar la integración.
- El dominio remitente debe estar verificado en Clerk antes de que el envío funcione en producción. Es un paso de configuración que puede bloquearse si el equipo no tiene acceso al DNS del dominio.

---

## Alternativas descartadas

| Alternativa | Razón de descarte |
|-------------|-------------------|
| Resend | Dependencia adicional innecesaria cuando Clerk ya cubre el caso de uso. |
| SendGrid | Ídem; además requiere configuración de API key y dominio separados. |
| Nodemailer + SMTP | Requiere servidor SMTP propio o credenciales de tercero; complejidad desproporcionada para 2 tipos de email. |
| No enviar email (solo notificación in-app) | Experiencia de usuario pobre: el usuario no sabrá que su solicitud fue aprobada sin entrar a la plataforma. |
