import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private resendClient: any;
  constructor(private configService: ConfigService) {
    // Initialize Resend with API key from environment variables
    const resendApiKey = this.configService.get<string>('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        this.resendClient = new Resend(resendApiKey);
      } catch (err) {
        console.warn('Failed to initialize Resend client:', err);
      }
    } else {
      console.warn('RESEND_API_KEY not found in environment variables');
    }

    // Log a warning if RESEND_FROM_EMAIL is not set
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    if (!fromEmail) {
      console.warn('RESEND_FROM_EMAIL not found in environment variables. You must set this to a verified sender identity.');
      console.warn('Configure a verified sender identity in Resend dashboard and set RESEND_FROM_EMAIL accordingly.');
    }
  }

  /**
   * Send an email with user credentials
   * @param to - Recipient email address
   * @param name - Recipient name
   * @param password - Generated password
   * @param userType - Type of user (partner, employer, client, worker)
   * @param loginEmail - Email address to use for login (if different from recipient)
  * @returns Promise resolving to email provider response
   */
  async sendUserCredentials(
    to: string,
    name: string,
    password: string,
    userType: 'partner' | 'employer' | 'client' | 'worker',
    loginEmail?: string,
  ): Promise<any> {
    try {
  // IMPORTANT: This email MUST be verified in your email provider (Resend) as a Sender Identity
  // Configure a verified sender identity in the provider dashboard for best deliverability
  const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
      
      // Use loginEmail if provided, otherwise use the recipient email as the login email
      const actualLoginEmail = loginEmail || to;
      
      // Create the email content
      const emailSubject = `Your Control-Jobs ${userType.charAt(0).toUpperCase() + userType.slice(1)} Account Credentials`;
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #333;">Welcome to Control-Jobs!</h2>
          <p>Hello ${name},</p>
          <p>Your ${userType} account has been created successfully. Here are your login credentials:</p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${actualLoginEmail}</p>
            <p><strong>Password:</strong> ${password}</p>
          </div>
          <p>Please login at <a href="${this.configService.get<string>('FRONTEND_URL', 'https://controlajobs.com')}">Control-Jobs</a> and change your password as soon as possible.</p>
          <p>If you have any questions, please contact our support team.</p>
          <p>Thank you,<br>The Control-Jobs Team</p>
        </div>
      `;
      
      try {
        // If we have a verified sender email and a Resend client, use Resend
        if (fromEmail && this.resendClient && this.resendClient.emails) {
          // Use RESEND_TO_EMAIL override for testing (sandbox sender can only deliver to verified email)
          const overrideTo = this.configService.get<string>('RESEND_TO_EMAIL');
          const finalTo = overrideTo || to;
          if (overrideTo) {
            console.log(`[Email] RESEND_TO_EMAIL override active: sending to ${overrideTo} instead of ${to}`);
          }
          const payload: any = {
            from: fromEmail,
            to: finalTo,
            subject: emailSubject,
            html: emailHtml,
          };

          // Send via Resend
          const response = await this.resendClient.emails.send(payload);
          // Log full provider response for troubleshooting (contains data.id on success or error)
          console.log('Resend send response for', to, ':', response);
          if (response && (response as any).error) {
            console.error('Resend reported an error sending email to', to, ':', (response as any).error);
          } else {
            console.log('Email (Resend) accepted. email id:', (response as any)?.data?.id || '(no id returned)');
          }
          return response;
        } else {
          // If no verified sender email or client is configured, log the credentials instead
          console.log('=== CREDENTIALS (NO EMAIL SENT - RESEND_FROM_EMAIL OR RESEND_API_KEY NOT CONFIGURED) ===');
          console.log(`User: ${name}`);
          console.log(`Type: ${userType}`);
          console.log(`Login Email: ${actualLoginEmail}`);
          console.log(`Password: ${password}`);
          console.log('=== END CREDENTIALS ===');
          console.log('To enable email sending, please configure RESEND_FROM_EMAIL and RESEND_API_KEY with valid values');

          // Return a mock response for compatibility
          return {
            statusCode: 200,
            body: 'Email not sent - credentials logged to console',
            headers: {},
          };
        }
      } catch (error) {
        // If sending fails, log the credentials as a fallback
        console.error('Failed to send email via Resend. Logging credentials to console instead:');
        console.log('=== CREDENTIALS (EMAIL SENDING FAILED) ===');
        console.log(`User: ${name}`);
        console.log(`Type: ${userType}`);
        console.log(`Login Email: ${actualLoginEmail}`);
        console.log(`Password: ${password}`);
        console.log('=== END CREDENTIALS ===');
        
        // Re-throw the error to be handled by the caller
        throw error;
      }
    } catch (error) {
      console.error('Error sending email:', error);
      if (error && (error.response || error.body)) {
        console.error('Email provider API error:', error.response?.body || error.body || error);
      }
      throw error;
    }
  }

  /**
   * Send an employer invitation email (Method 2 — self-service signup).
   * The recipient clicks the link and completes the 3-step signup form.
   */
  async sendEmployerInvitation(
    to: string,
    partnerName: string,
    inviteLink: string,
    trialDays: number,
  ): Promise<any> {
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    const subject = `${partnerName} te ha invitado a probar ControlJobs`;
    const trialNote =
      trialDays > 0
        ? `<p>Tienes <strong>${trialDays} días de prueba gratis</strong> para conocer la plataforma.</p>`
        : '';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #662D91;">Invitación a ControlJobs</h2>
        <p>Hola,</p>
        <p><strong>${partnerName}</strong> te ha invitado a registrar tu empresa en ControlJobs.</p>
        ${trialNote}
        <p style="margin: 28px 0;">
          <a href="${inviteLink}"
             style="background:#662D91;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">
            Completar registro
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          Este enlace caduca en 7 días. Si no esperabas esta invitación, simplemente ignora este mensaje.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#888;font-size:12px;">— Equipo ControlJobs</p>
      </div>
    `;

    try {
      if (fromEmail && this.resendClient && this.resendClient.emails) {
        const overrideTo = this.configService.get<string>('RESEND_TO_EMAIL');
        const finalTo = overrideTo || to;
        if (overrideTo) {
          console.log(`[Email] RESEND_TO_EMAIL override active: sending to ${overrideTo} instead of ${to}`);
        }
        const response = await this.resendClient.emails.send({
          from: fromEmail,
          to: finalTo,
          subject,
          html,
        });
        console.log('Employer-invitation email response for', to, ':', response);
        return response;
      }
      console.log('=== INVITATION (no email provider configured) ===');
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Link: ${inviteLink}`);
      console.log('=== END ===');
      return { statusCode: 200, body: 'Email not sent - link logged to console' };
    } catch (error) {
      console.error('Failed to send employer invitation:', error);
      throw error;
    }
  }

  async sendRateChangeNotice(args: {
    to: string;
    name: string;
    planLabel: string;
    effectiveDate: string;
    oldPrices: { fixed: number; perWorkCenter: number; perWorker: number };
    newPrices: { fixed: number; perWorkCenter: number; perWorker: number };
  }): Promise<any> {
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    const billingUrl = `${this.configService.get<string>('FRONTEND_URL', 'https://controlajobs.com').replace(/\/$/, '')}/billing`;
    const fmt = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
    const subject = `Tu tarifa cambia el ${args.effectiveDate}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #662D91;">Cambio de tarifa programado</h2>
        <p>Hola ${args.name},</p>
        <p>Te informamos de que la tarifa <strong>${args.planLabel}</strong> de ControlJobs cambiará a partir del <strong>${args.effectiveDate}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;">
          <thead>
            <tr style="background:#f5f0fa;">
              <th style="text-align:left;padding:8px;border:1px solid #e2d4f0;">Concepto</th>
              <th style="text-align:right;padding:8px;border:1px solid #e2d4f0;">Actual</th>
              <th style="text-align:right;padding:8px;border:1px solid #e2d4f0;">Nuevo</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #e2d4f0;">Cuota fija</td><td style="text-align:right;padding:8px;border:1px solid #e2d4f0;">${fmt(args.oldPrices.fixed)}</td><td style="text-align:right;padding:8px;border:1px solid #e2d4f0;"><strong>${fmt(args.newPrices.fixed)}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #e2d4f0;">Por centro de trabajo</td><td style="text-align:right;padding:8px;border:1px solid #e2d4f0;">${fmt(args.oldPrices.perWorkCenter)}</td><td style="text-align:right;padding:8px;border:1px solid #e2d4f0;"><strong>${fmt(args.newPrices.perWorkCenter)}</strong></td></tr>
            <tr><td style="padding:8px;border:1px solid #e2d4f0;">Por trabajador</td><td style="text-align:right;padding:8px;border:1px solid #e2d4f0;">${fmt(args.oldPrices.perWorker)}</td><td style="text-align:right;padding:8px;border:1px solid #e2d4f0;"><strong>${fmt(args.newPrices.perWorker)}</strong></td></tr>
          </tbody>
        </table>
        <p>Si no estás de acuerdo, puedes cancelar tu suscripción antes del ${args.effectiveDate} desde tu panel de facturación.</p>
        <p style="margin: 28px 0;">
          <a href="${billingUrl}" style="background:#662D91;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:600;">Ver mi facturación</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#888;font-size:12px;">— Equipo ControlJobs</p>
      </div>
    `;
    return this.deliver({ to: args.to, subject, html, fromEmail, kind: 'rate-change-notice' });
  }

  async sendRateChangeCancelled(args: {
    to: string;
    name: string;
    planLabel: string;
  }): Promise<any> {
    const fromEmail = this.configService.get<string>('RESEND_FROM_EMAIL');
    const subject = `Cambio de tarifa cancelado`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #662D91;">Cambio de tarifa cancelado</h2>
        <p>Hola ${args.name},</p>
        <p>El cambio de tarifa programado para <strong>${args.planLabel}</strong> ha sido cancelado. Tu tarifa actual se mantiene sin cambios.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
        <p style="color:#888;font-size:12px;">— Equipo ControlJobs</p>
      </div>
    `;
    return this.deliver({ to: args.to, subject, html, fromEmail, kind: 'rate-change-cancelled' });
  }

  private async deliver(args: {
    to: string;
    subject: string;
    html: string;
    fromEmail: string | undefined;
    kind: string;
  }): Promise<any> {
    try {
      if (args.fromEmail && this.resendClient && this.resendClient.emails) {
        const overrideTo = this.configService.get<string>('RESEND_TO_EMAIL');
        const finalTo = overrideTo || args.to;
        const response = await this.resendClient.emails.send({
          from: args.fromEmail,
          to: finalTo,
          subject: args.subject,
          html: args.html,
        });
        console.log(`[Email] ${args.kind} sent to`, args.to, response);
        return response;
      }
      console.log(`=== ${args.kind.toUpperCase()} (no email provider configured) ===`);
      console.log(`To: ${args.to}`);
      console.log(`Subject: ${args.subject}`);
      console.log('=== END ===');
      return { statusCode: 200, body: 'Email not sent - logged to console' };
    } catch (error) {
      console.error(`Failed to send ${args.kind}:`, error);
      throw error;
    }
  }
}