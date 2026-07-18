import { Injectable, Logger, Inject } from '@nestjs/common';
import { Resend } from 'resend';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  constructor(
    @Inject(AppConfigService)
    private readonly configService: AppConfigService,
  ) {
    if (!this.configService) {
      this.logger.error('AppConfigService was not injected successfully!');
      return;
    }
    const apiKey = this.configService.resendApiKey;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY is not defined. Emails will be logged to console instead.');
    }
  }

  async sendEmail(options: { to: string; subject: string; html: string; text?: string }) {
    const fromAddress = this.configService.emailFromAddress;

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        if (error) {
          this.logger.error(`Failed to send email via Resend: ${JSON.stringify(error)}`);
          throw new Error(error.message);
        }

        this.logger.log(`Email sent successfully to ${options.to}. Message ID: ${data?.id}`);
      } catch (err: any) {
        this.logger.error(`Error sending email to ${options.to}: ${err.message}`, err.stack);
        throw err;
      }
    } else {
      this.logger.log(`\n========================================================================\n[DEV MODE] Email to ${options.to}:\nSubject: ${options.subject}\nBody: ${options.html}\n========================================================================`);
    }
  }

  async sendVerificationOtp(to: string, otp: string) {
    const fromAddress = this.configService.emailFromAddress;
    const subject = `${otp} is your WorkSure verification code`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your email</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f9fafb;
            color: #1f2937;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 576px;
            margin: 40px auto;
            background-color: #ffffff;
            border: 1px border #e5e7eb;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            overflow: hidden;
          }
          .header {
            background-color: #4f46e5;
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 40px 32px;
          }
          .greeting {
            font-size: 16px;
            line-height: 24px;
            margin-bottom: 24px;
            color: #374151;
          }
          .instructions {
            font-size: 16px;
            line-height: 24px;
            color: #4b5563;
            margin-bottom: 32px;
          }
          .otp-container {
            text-align: center;
            margin: 32px 0;
            background-color: #f3f4f6;
            border-radius: 12px;
            padding: 24px;
            border: 1px dashed #d1d5db;
          }
          .otp-code {
            font-size: 36px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #4f46e5;
            font-family: 'Courier New', Courier, monospace;
            margin: 0;
          }
          .btn-primary {
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 16px;
            padding: 12px 32px;
            text-decoration: none;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
          }
          .expiry-note {
            font-size: 14px;
            color: #6b7280;
            margin-top: 12px;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #9ca3af;
            line-height: 18px;
          }
          .footer a {
            color: #4f46e5;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>WorkSure</h1>
          </div>
          <div class="content">
            <p class="greeting">Hello,</p>
            <p class="instructions">Thank you for registering with WorkSure! To complete your registration and verify your email address, please use the following one-time verification code:</p>
            
            <div class="otp-container">
              <p class="otp-code">${otp}</p>
              <p class="expiry-note">This code is valid for <strong>15 minutes</strong>.</p>
            </div>
            
            <p class="instructions" style="text-align: center; margin-bottom: 16px;">Or automatically verify your email by clicking the button below:</p>
            <div style="text-align: center; margin-bottom: 32px;">
              <a href="${this.configService.appUrl}/auth/verify-email?token=${otp}&email=${encodeURIComponent(to)}" class="btn-primary">Verify Email</a>
            </div>
            
            <p class="instructions">If you did not request this code, you can safely ignore this email. Someone may have entered your email address by mistake.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from WorkSure. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} WorkSure. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: fromAddress,
          to,
          subject,
          html: htmlContent,
        });

        if (error) {
          this.logger.error(`Failed to send email via Resend: ${JSON.stringify(error)}`);
          throw new Error(error.message);
        }

        this.logger.log(`Verification OTP email sent successfully to ${to}. Message ID: ${data?.id}`);
      } catch (err: any) {
        this.logger.error(`Error sending email to ${to}: ${err.message}`, err.stack);
        throw err;
      }
    } else {
      this.logger.log(`\n========================================================================\n[DEV MODE] Email verification OTP for ${to}:\n${otp}\n========================================================================`);
    }
  }

  async sendPasswordReset(to: string, token: string) {
    const fromAddress = this.configService.emailFromAddress;
    const appUrl = this.configService.appUrl;
    const subject = `Reset your WorkSure password`;
    const resetLink = `${appUrl}/auth/reset-password?token=${token}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset your password</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            background-color: #f9fafb;
            color: #1f2937;
            margin: 0;
            padding: 0;
            -webkit-font-smoothing: antialiased;
          }
          .container {
            max-width: 576px;
            margin: 40px auto;
            background-color: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
            overflow: hidden;
          }
          .header {
            background-color: #4f46e5;
            padding: 32px 24px;
            text-align: center;
          }
          .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.025em;
          }
          .content {
            padding: 40px 32px;
          }
          .greeting {
            font-size: 16px;
            line-height: 24px;
            margin-bottom: 24px;
            color: #374151;
          }
          .instructions {
            font-size: 16px;
            line-height: 24px;
            color: #4b5563;
            margin-bottom: 32px;
          }
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          .btn-primary {
            display: inline-block;
            background-color: #4f46e5;
            color: #ffffff !important;
            font-weight: 600;
            font-size: 16px;
            padding: 12px 32px;
            text-decoration: none;
            border-radius: 8px;
            box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2);
          }
          .expiry-note {
            font-size: 14px;
            color: #6b7280;
            margin-top: 24px;
            text-align: center;
          }
          .link-fallback {
            font-size: 12px;
            color: #9ca3af;
            word-break: break-all;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
          }
          .footer {
            background-color: #f9fafb;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #9ca3af;
            line-height: 18px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>WorkSure</h1>
          </div>
          <div class="content">
            <p class="greeting">Hello,</p>
            <p class="instructions">We received a request to reset the password for your WorkSure account. You can reset your password by clicking the button below:</p>
            
            <div class="button-container">
              <a href="${resetLink}" class="btn-primary">Reset Password</a>
            </div>
            
            <p class="expiry-note">This link is valid for <strong>30 minutes</strong>.</p>
            
            <p class="instructions">If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <div class="link-fallback">
              <p>If you're having trouble with the button above, copy and paste the link below into your web browser:</p>
              <p><a href="${resetLink}">${resetLink}</a></p>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated message from WorkSure. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} WorkSure. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    if (this.resend) {
      try {
        const { data, error } = await this.resend.emails.send({
          from: fromAddress,
          to,
          subject,
          html: htmlContent,
        });

        if (error) {
          this.logger.error(`Failed to send password reset email via Resend: ${JSON.stringify(error)}`);
          throw new Error(error.message);
        }

        this.logger.log(`Password reset email sent successfully to ${to}. Message ID: ${data?.id}`);
      } catch (err: any) {
        this.logger.error(`Error sending password reset email to ${to}: ${err.message}`, err.stack);
        throw err;
      }
    } else {
      this.logger.log(`\n========================================================================\n[DEV MODE] Password reset link for ${to}:\n${resetLink}\n========================================================================`);
    }
  }
}