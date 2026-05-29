import sgMail from '@sendgrid/mail'

const apiKey = process.env.SENDGRID_API_KEY || ''
if (apiKey) {
  sgMail.setApiKey(apiKey)
} else {
  console.warn('SENDGRID_API_KEY no configurada. Los correos se imprimirán en consola para desarrollo.')
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
  const fromEmail = process.env.EMAIL_FROM || 'noreply@tusitio.com'
  
  const msg = {
    to,
    from: fromEmail,
    subject: 'Restablecer contraseña - CRM Dashboard',
    text: `Para restablecer tu contraseña, ingresa al siguiente enlace:\n${resetLink}\nEste enlace expirará en 30 minutos.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #4f46e5; text-align: center;">Restablecer Contraseña</h2>
        <p>Hola,</p>
        <p>Has recibido este correo porque se solicitó un restablecimiento de contraseña para tu cuenta en el CRM Dashboard.</p>
        <p>Para continuar con el restablecimiento, haz clic en el siguiente botón:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
        </div>
        <p>Este enlace expirará en <strong>30 minutos</strong> y solo puede ser utilizado una vez. Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;" />
        <p style="font-size: 12px; color: #888888; text-align: center;">Dashboard CRM PWA - Seguridad y Sincronización</p>
      </div>
    `,
  }

  if (!apiKey) {
    console.log('\n--- [SIMULACIÓN DE CORREO ELECTRONICO] ---')
    console.log(`Para: ${to}`)
    console.log(`Desde: ${fromEmail}`)
    console.log(`Enlace: ${resetLink}`)
    console.log('-------------------------------------------\n')
    return
  }

  try {
    await sgMail.send(msg)
  } catch (error: any) {
    console.error('Error al enviar correo con SendGrid:', error?.response?.body || error)
    throw new Error('No se pudo enviar el correo de recuperación. Revisa la configuración de SendGrid.')
  }
}
