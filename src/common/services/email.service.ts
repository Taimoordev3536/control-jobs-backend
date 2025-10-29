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
          const payload: any = {
            from: fromEmail,
            to,
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
}