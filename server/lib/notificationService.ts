import { getTwilioClient, getTwilioFromPhoneNumber } from './twilio';
import { getUncachableGmailClient } from './gmail';
import { db } from '../db';
import { notificationLog, users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import QRCode from 'qrcode';

export type NotificationChannel = 'email' | 'sms';
export type NotificationType = 
  | 'booking_submitted'
  | 'approval_requested'
  | 'approved'
  | 'declined'
  | 'uic_notification'
  | 'cancelled'
  | 'org_welcome'
  | 'tournament_created'
  | 'password_reset';

interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
}

interface NotificationPayload {
  scope?: 'system' | 'organization';
  organizationId?: string;
  bookingRequestId?: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: NotificationRecipient;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  
  async sendNotification(payload: NotificationPayload): Promise<void> {
    if (payload.channel === 'email') {
      await this.sendEmail(payload);
    } else if (payload.channel === 'sms') {
      await this.sendSMS(payload);
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    const gmail = await getUncachableGmailClient();
    
    if (!payload.recipient.email) {
      throw new Error('Email recipient address required');
    }

    const isHTML = payload.body.trim().startsWith('<!DOCTYPE html>') || payload.body.trim().startsWith('<html');
    
    const messageParts = [
      `To: ${payload.recipient.email}`,
      `Subject: ${payload.subject || 'Forest Glade Diamond Booking Notification'}`,
      'MIME-Version: 1.0',
      isHTML ? 'Content-Type: text/html; charset=utf-8' : 'Content-Type: text/plain; charset=utf-8',
      '',
      payload.body
    ];

    const message = messageParts.join('\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    try {
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      await this.logNotification(payload, 'sent', undefined, result.data.id || undefined);
    } catch (error) {
      await this.logNotification(payload, 'failed', (error as Error).message);
      throw error;
    }
  }

  private async sendSMS(payload: NotificationPayload): Promise<void> {
    const twilioClient = await getTwilioClient();
    const fromPhone = await getTwilioFromPhoneNumber();

    if (!payload.recipient.phone) {
      throw new Error('SMS recipient phone number required');
    }

    try {
      const message = await twilioClient.messages.create({
        body: payload.body,
        from: fromPhone,
        to: payload.recipient.phone,
      });

      await this.logNotification(payload, 'sent', undefined, message.sid);
    } catch (error) {
      await this.logNotification(payload, 'failed', (error as Error).message);
      throw error;
    }
  }

  private async logNotification(
    payload: NotificationPayload,
    status: 'pending' | 'sent' | 'failed',
    failureReason?: string,
    providerMessageId?: string
  ): Promise<void> {
    const scope = payload.scope || 'organization';
    
    if (scope === 'organization' && !payload.organizationId) {
      throw new Error('organizationId is required for organization-scoped notifications');
    }
    
    await db.insert(notificationLog).values({
      scope,
      organizationId: payload.organizationId || null,
      bookingRequestId: payload.bookingRequestId,
      notificationType: payload.type,
      channel: payload.channel,
      recipientUserId: payload.recipient.userId,
      recipientEmail: payload.recipient.email,
      recipientPhone: payload.recipient.phone,
      subject: payload.subject,
      body: payload.body,
      status,
      sentAt: status === 'sent' ? new Date() : undefined,
      failureReason,
      providerMessageId,
    });
  }

  async sendBookingSubmittedNotification(params: {
    organizationId: string;
    bookingRequestId: string;
    coachName: string;
    teamName: string;
    bookingType: string;
    date: string;
    time: string;
    diamondName?: string;
    coordinatorEmail?: string;
    coordinatorPhone?: string;
  }): Promise<void> {
    const { organizationId, bookingRequestId, coachName, teamName, bookingType, date, time, diamondName, coordinatorEmail, coordinatorPhone } = params;

    const emailBody = `
Hello,

A new diamond booking request has been submitted:

Coach: ${coachName}
Team: ${teamName}
Type: ${bookingType}
Date: ${date}
Time: ${time}
${diamondName ? `Diamond: ${diamondName}` : ''}

Please review and approve this request in the Forest Glade booking portal.

Thank you,
Forest Glade Baseball Association
    `.trim();

    const smsBody = `New booking: ${teamName} - ${bookingType} on ${date} at ${time}. Review at dugoutdesk.ca`;

    if (coordinatorEmail) {
      await this.sendNotification({
        organizationId,
        bookingRequestId,
        type: 'booking_submitted',
        channel: 'email',
        recipient: { email: coordinatorEmail },
        subject: 'New Diamond Booking Request',
        body: emailBody,
      });
    }

    if (coordinatorPhone) {
      await this.sendNotification({
        organizationId,
        bookingRequestId,
        type: 'booking_submitted',
        channel: 'sms',
        recipient: { phone: coordinatorPhone },
        body: smsBody,
      });
    }
  }

  async sendApprovalNotification(params: {
    organizationId: string;
    bookingRequestId: string;
    approved: boolean;
    recipientEmail?: string;
    recipientPhone?: string;
    teamName: string;
    date: string;
    time: string;
    approverName: string;
    notes?: string;
  }): Promise<void> {
    const { organizationId, bookingRequestId, approved, recipientEmail, recipientPhone, teamName, date, time, approverName, notes } = params;

    const status = approved ? 'approved' : 'declined';
    const emailBody = `
Hello,

Your diamond booking request has been ${status}:

Team: ${teamName}
Date: ${date}
Time: ${time}
${status.charAt(0).toUpperCase() + status.slice(1)} by: ${approverName}
${notes ? `\nNotes: ${notes}` : ''}

${approved ? 'Your booking is now confirmed.' : 'Please contact your coordinator for more information.'}

Thank you,
Forest Glade Baseball Association
    `.trim();

    const smsBody = `Booking ${status}: ${teamName} on ${date}. ${approved ? 'Confirmed!' : 'Contact coordinator.'}`;

    if (recipientEmail) {
      await this.sendNotification({
        organizationId,
        bookingRequestId,
        type: approved ? 'approved' : 'declined',
        channel: 'email',
        recipient: { email: recipientEmail },
        subject: `Booking Request ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        body: emailBody,
      });
    }

    if (recipientPhone) {
      await this.sendNotification({
        organizationId,
        bookingRequestId,
        type: approved ? 'approved' : 'declined',
        channel: 'sms',
        recipient: { phone: recipientPhone },
        body: smsBody,
      });
    }
  }

  async sendUICNotification(params: {
    organizationId: string;
    bookingRequestId: string;
    uicEmail?: string;
    uicPhone?: string;
    teamName: string;
    opponentName: string;
    date: string;
    time: string;
    diamondName?: string;
  }): Promise<void> {
    const { organizationId, bookingRequestId, uicEmail, uicPhone, teamName, opponentName, date, time, diamondName } = params;

    const emailBody = `
Hello,

A game requiring umpires has been confirmed:

Home Team: ${teamName}
Opponent: ${opponentName}
Date: ${date}
Time: ${time}
${diamondName ? `Diamond: ${diamondName}` : ''}

Please assign umpires for this game.

Thank you,
Forest Glade Baseball Association
    `.trim();

    const smsBody = `Umpire needed: ${teamName} vs ${opponentName} on ${date} at ${time}. ${diamondName || ''}`;

    if (uicEmail) {
      await this.sendNotification({
        organizationId,
        bookingRequestId,
        type: 'uic_notification',
        channel: 'email',
        recipient: { email: uicEmail },
        subject: 'Umpire Assignment Required',
        body: emailBody,
      });
    }

    if (uicPhone) {
      await this.sendNotification({
        organizationId,
        bookingRequestId,
        type: 'uic_notification',
        channel: 'sms',
        recipient: { phone: uicPhone },
        body: smsBody,
      });
    }
  }

  async sendWelcomeEmail(params: {
    organizationId: string;
    organizationName: string;
    adminName: string;
    adminEmail: string;
  }): Promise<void> {
    const { organizationId, organizationName, adminName, adminEmail } = params;

    const emailBody = `
Hi ${adminName},

Welcome to Dugout Desk! Your organization "${organizationName}" has been successfully created.

You can now access your admin portal and create your first tournament:
👉 https://app.dugoutdesk.ca/admin-portal

Need help getting started? Visit our documentation or reply to this email.

Best regards,
The Dugout Desk Team
    `.trim();

    await this.sendNotification({
      organizationId,
      type: 'org_welcome',
      channel: 'email',
      recipient: { email: adminEmail, name: adminName },
      subject: `Welcome to Dugout Desk - ${organizationName}`,
      body: emailBody,
    });
  }

  async sendTournamentEmail(params: {
    organizationId: string;
    organizationName: string;
    organizationLogoUrl?: string;
    primaryColor?: string;
    tournamentId: string;
    tournamentName: string;
    startDate: string;
    endDate: string;
    adminName: string;
    adminEmail: string;
  }): Promise<void> {
    const { organizationId, organizationName, organizationLogoUrl, primaryColor, tournamentId, tournamentName, startDate, endDate, adminName, adminEmail } = params;

    const publicUrl = `https://www.dugoutdesk.ca/tournament/${tournamentId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(publicUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: primaryColor || '#22c55e',
        light: '#ffffff'
      }
    });

    const logoSection = organizationLogoUrl 
      ? `<img src="${organizationLogoUrl}" alt="${organizationName}" style="max-width: 200px; height: auto; margin-bottom: 20px;" />`
      : `<h2 style="color: ${primaryColor || '#22c55e'}; margin-bottom: 20px;">${organizationName}</h2>`;

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    ${logoSection}
  </div>
  
  <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: ${primaryColor || '#22c55e'}; margin-top: 0;">Your Tournament is Ready!</h1>
    
    <p>Hi ${adminName},</p>
    
    <p>Great news! Your tournament <strong>"${tournamentName}"</strong> is now live and ready.</p>
    
    <div style="background-color: white; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>📅 Dates:</strong> ${startDate} - ${endDate}</p>
      <p style="margin: 10px 0;"><strong>📍 Manage:</strong> <a href="https://app.dugoutdesk.ca/tournament/${tournamentId}" style="color: ${primaryColor || '#22c55e'};">Admin Portal</a></p>
      <p style="margin: 10px 0;"><strong>🌐 Public View:</strong> <a href="${publicUrl}" style="color: ${primaryColor || '#22c55e'};">Share Link</a></p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-weight: bold; color: #374151; margin-bottom: 15px;">📱 Share via QR Code</p>
      <img src="${qrCodeDataUrl}" alt="Tournament QR Code" style="width: 200px; height: 200px; border: 2px solid ${primaryColor || '#22c55e'}; border-radius: 8px; padding: 10px; background: white;" />
      <p style="font-size: 12px; color: #6b7280; margin-top: 10px;">Scan to view tournament standings</p>
    </div>
    
    <p>You can now add teams, create schedules, and start managing your tournament.</p>
  </div>
  
  <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p>Powered by <strong style="color: ${primaryColor || '#22c55e'};">Dugout Desk</strong> 🏆</p>
  </div>
</body>
</html>
    `.trim();

    await this.sendNotification({
      organizationId,
      type: 'tournament_created',
      channel: 'email',
      recipient: { email: adminEmail, name: adminName },
      subject: `Your Tournament is Ready - ${tournamentName}`,
      body: emailBody,
    });
  }

  async sendPasswordResetEmail(params: {
    email: string;
    name?: string;
    resetToken: string;
  }): Promise<void> {
    const { email, name, resetToken } = params;
    
    const resetUrl = `https://app.dugoutdesk.ca/reset-password?token=${resetToken}`;
    const greeting = name ? `Hi ${name},` : 'Hello,';

    const emailBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h2 style="color: #1e3a8a; margin-bottom: 20px;">Dugout Desk</h2>
  </div>
  
  <div style="background-color: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
    <h1 style="color: #1e3a8a; margin-top: 0;">Password Reset Request</h1>
    
    <p>${greeting}</p>
    
    <p>We received a request to reset your password for your Dugout Desk account.</p>
    
    <p>Click the button below to create a new password. This link will expire in 1 hour.</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background-color: #1e3a8a; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
    </div>
    
    <p style="color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="color: #1e3a8a; word-break: break-all; font-size: 14px;">${resetUrl}</p>
    
    <p style="margin-top: 30px; color: #6b7280; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
  </div>
  
  <div style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
    <p>Powered by <strong style="color: #1e3a8a;">Dugout Desk</strong> 🏆</p>
  </div>
</body>
</html>
    `.trim();

    await this.sendNotification({
      scope: 'system',
      type: 'password_reset',
      channel: 'email',
      recipient: { email, name },
      subject: 'Reset Your Dugout Desk Password',
      body: emailBody,
    });
  }
}

export const notificationService = new NotificationService();
