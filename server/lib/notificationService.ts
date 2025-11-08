import { getTwilioClient, getTwilioFromPhoneNumber } from './twilio';
import { getUncachableGmailClient } from './gmail';
import { db } from '@db';
import { notificationLog, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export type NotificationChannel = 'email' | 'sms';
export type NotificationType = 
  | 'booking_submitted'
  | 'approval_requested'
  | 'approved'
  | 'declined'
  | 'uic_notification'
  | 'cancelled';

interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  name?: string;
}

interface NotificationPayload {
  organizationId: string;
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

    const message = [
      `To: ${payload.recipient.email}`,
      `Subject: ${payload.subject || 'Forest Glade Diamond Booking Notification'}`,
      '',
      payload.body
    ].join('\n');

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
    await db.insert(notificationLog).values({
      organizationId: payload.organizationId,
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
}

export const notificationService = new NotificationService();
