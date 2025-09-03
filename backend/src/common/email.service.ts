import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    if (process.env.NODE_ENV === 'production' && process.env.EMAIL_HOST) {
      this.transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT || '587'),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });
    } else {
      this.transporter = nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true
      });
    }
  }

  async sendPasswordResetEmail(email: string, token: string, tenantHost?: string) {
    const resetUrl = tenantHost 
      ? `https://${tenantHost}/password-reset?token=${token}`
      : `${process.env.FRONTEND_URL || 'http://localhost:3000'}/password-reset?token=${token}`;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@watan.store',
      to: email,
      subject: 'إعادة تعيين كلمة المرور - Watan Store',
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif;">
          <h2>إعادة تعيين كلمة المرور</h2>
          <p>تم طلب إعادة تعيين كلمة المرور لحسابك.</p>
          <p>انقر على الرابط التالي لإعادة تعيين كلمة المرور:</p>
          <a href="${resetUrl}" style="background: #0ea5e9; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">إعادة تعيين كلمة المرور</a>
          <p>أو انسخ الرمز التالي: <strong>${token}</strong></p>
          <p>هذا الرابط صالح لمدة ساعة واحدة فقط.</p>
        </div>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('[EMAIL] Password reset sent to:', email, 'Token:', token);
      return result;
    } catch (error) {
      console.error('[EMAIL] Failed to send password reset:', error);
      throw error;
    }
  }
}
