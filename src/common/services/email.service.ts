import { Injectable } from '@nestjs/common';
import * as sgMail from '@sendgrid/mail';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  constructor(private configService: ConfigService) {
    // Initialize SendGrid with API key from environment variables
    const sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sendgridApiKey) {
      sgMail.setApiKey(sendgridApiKey);
    } else {
      console.warn('SENDGRID_API_KEY not found in environment variables');
    }
    
    // Log a warning if SENDGRID_FROM_EMAIL is not set
    const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!fromEmail) {
      console.warn('SENDGRID_FROM_EMAIL not found in environment variables. You must set this to a verified sender identity.');
      console.warn('Visit https://sendgrid.com/docs/for-developers/sending-email/sender-identity/ to learn how to verify a sender identity.');
    }
  }

  /**
   * Send an email with user credentials
   * @param to - Recipient email address
   * @param name - Recipient name
   * @param password - Generated password
   * @param userType - Type of user (partner, employer, client, worker)
   * @param loginEmail - Email address to use for login (if different from recipient)
   * @returns Promise resolving to SendGrid response
   */
  async sendUserCredentials(
    to: string,
    name: string,
    password: string,
    userType: 'partner' | 'employer' | 'client' | 'worker',
    loginEmail?: string,
  ): Promise<any> {
    try {
      // IMPORTANT: This email MUST be verified in SendGrid dashboard as a Sender Identity
      // Visit https://sendgrid.com/docs/for-developers/sending-email/sender-identity/ for more information
      const fromEmail = this.configService.get<string>('SENDGRID_FROM_EMAIL');
      
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
        // If we have a verified sender email, use SendGrid
        if (fromEmail) {
          const msg = {
            to,
            from: fromEmail,
            subject: emailSubject,
            html: emailHtml,
          };
          
          const response = await sgMail.send(msg);
          console.log('Email sent successfully to', to);
          return response;
        } else {
          // If no verified sender email is configured, log the credentials instead
          console.log('=== CREDENTIALS (NO EMAIL SENT - SENDGRID_FROM_EMAIL NOT CONFIGURED) ===');
          console.log(`User: ${name}`);
          console.log(`Type: ${userType}`);
          console.log(`Login Email: ${actualLoginEmail}`);
          console.log(`Password: ${password}`);
          console.log('=== END CREDENTIALS ===');
          console.log('To enable email sending, please configure SENDGRID_FROM_EMAIL with a verified sender identity');
          
          // Return a mock response
          return {
            statusCode: 200,
            body: 'Email not sent - credentials logged to console',
            headers: {},
          };
        }
      } catch (error) {
        // If SendGrid fails, log the credentials as a fallback
        console.error('Failed to send email. Logging credentials to console instead:');
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
      if (error.response) {
        console.error('SendGrid API error:', error.response.body);
      }
      throw error;
    }
  }
}