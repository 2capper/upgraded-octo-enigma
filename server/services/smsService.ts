import { db } from "../db";
import {
  organizationTwilioSettings,
  outboundSmsMessages,
  type OrganizationTwilioSettings,
  type OutboundSmsMessage,
  type InsertOutboundSmsMessage,
} from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { isValidE164 } from "@shared/phoneUtils";

const twilio = require('twilio');

export interface SendSmsOptions {
  organizationId: string;
  recipientPhone: string;
  recipientName?: string;
  messageBody: string;
  sentBy: string;
  tournamentId?: string;
  teamId?: string;
}

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  twilioMessageSid?: string;
  error?: string;
  errorCode?: string;
}

export interface RateLimitCheck {
  allowed: boolean;
  remaining?: number;
  resetAt?: Date;
  error?: string;
}

export class SmsService {
  async getTwilioSettings(organizationId: string): Promise<OrganizationTwilioSettings | null> {
    const [settings] = await db
      .select()
      .from(organizationTwilioSettings)
      .where(eq(organizationTwilioSettings.organizationId, organizationId));

    return settings || null;
  }

  async saveTwilioSettings(
    organizationId: string,
    accountSid: string,
    authToken: string,
    phoneNumber: string,
    dailyLimit?: number,
    rateLimit?: number
  ): Promise<OrganizationTwilioSettings> {
    const existing = await this.getTwilioSettings(organizationId);

    if (existing) {
      const [updated] = await db
        .update(organizationTwilioSettings)
        .set({
          accountSid,
          authToken,
          phoneNumber,
          dailyLimit: dailyLimit ?? existing.dailyLimit,
          rateLimit: rateLimit ?? existing.rateLimit,
          updatedAt: new Date(),
        })
        .where(eq(organizationTwilioSettings.organizationId, organizationId))
        .returning();

      return updated;
    }

    const [created] = await db
      .insert(organizationTwilioSettings)
      .values({
        organizationId,
        accountSid,
        authToken,
        phoneNumber,
        dailyLimit: dailyLimit ?? 100,
        rateLimit: rateLimit ?? 100,
      })
      .returning();

    return created;
  }

  async checkRateLimit(organizationId: string): Promise<RateLimitCheck> {
    const settings = await this.getTwilioSettings(organizationId);

    if (!settings || !settings.isEnabled) {
      return {
        allowed: false,
        error: "Twilio is not configured or disabled for this organization",
      };
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [recentCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboundSmsMessages)
      .where(
        and(
          eq(outboundSmsMessages.organizationId, organizationId),
          gte(outboundSmsMessages.createdAt, fifteenMinutesAgo)
        )
      );

    const [dailyCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(outboundSmsMessages)
      .where(
        and(
          eq(outboundSmsMessages.organizationId, organizationId),
          gte(outboundSmsMessages.createdAt, today)
        )
      );

    if (dailyCount.count >= settings.dailyLimit) {
      return {
        allowed: false,
        error: `Daily limit of ${settings.dailyLimit} messages reached`,
        resetAt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    if (recentCount.count >= settings.rateLimit) {
      return {
        allowed: false,
        error: `Rate limit of ${settings.rateLimit} messages per 15 minutes reached`,
        resetAt: new Date(fifteenMinutesAgo.getTime() + 15 * 60 * 1000),
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        settings.dailyLimit - dailyCount.count,
        settings.rateLimit - recentCount.count
      ),
    };
  }

  private calculateSegments(message: string): number {
    const length = message.length;
    if (length === 0) return 0;
    if (length <= 160) return 1;
    return Math.ceil(length / 153);
  }

  async sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
    if (!isValidE164(options.recipientPhone)) {
      return {
        success: false,
        error: `Invalid phone number format: ${options.recipientPhone}`,
        errorCode: "INVALID_PHONE_NUMBER",
      };
    }

    const rateLimitCheck = await this.checkRateLimit(options.organizationId);
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: rateLimitCheck.error || "Rate limit exceeded",
        errorCode: "RATE_LIMIT_EXCEEDED",
      };
    }

    const settings = await this.getTwilioSettings(options.organizationId);
    if (!settings) {
      return {
        success: false,
        error: "Twilio settings not found",
        errorCode: "NO_TWILIO_SETTINGS",
      };
    }

    const characterCount = options.messageBody.length;
    const segmentCount = this.calculateSegments(options.messageBody);

    const messageRecord: InsertOutboundSmsMessage = {
      organizationId: options.organizationId,
      recipientPhone: options.recipientPhone,
      recipientName: options.recipientName || null,
      messageBody: options.messageBody,
      sentBy: options.sentBy,
      tournamentId: options.tournamentId || null,
      teamId: options.teamId || null,
      characterCount,
      segmentCount,
      status: "pending",
    };

    try {
      const client = twilio(settings.accountSid, settings.authToken);

      const message = await client.messages.create({
        body: options.messageBody,
        from: settings.phoneNumber,
        to: options.recipientPhone,
      });

      const [savedMessage] = await db
        .insert(outboundSmsMessages)
        .values({
          ...messageRecord,
          status: "sent",
          twilioMessageSid: message.sid,
        })
        .returning();

      return {
        success: true,
        messageId: savedMessage.id,
        twilioMessageSid: message.sid,
      };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to send SMS";
      const errorCode = error.code || "TWILIO_ERROR";

      await db.insert(outboundSmsMessages).values({
        ...messageRecord,
        status: "failed",
        errorCode,
        errorMessage,
      });

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  async bulkSendSms(messages: SendSmsOptions[]): Promise<SendSmsResult[]> {
    const results: SendSmsResult[] = [];

    for (const message of messages) {
      const result = await this.sendSms(message);
      results.push(result);

      if (!result.success) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    return results;
  }

  async getMessageHistory(
    organizationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<OutboundSmsMessage[]> {
    const messages = await db
      .select()
      .from(outboundSmsMessages)
      .where(eq(outboundSmsMessages.organizationId, organizationId))
      .orderBy(sql`${outboundSmsMessages.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return messages;
  }

  async updateMessageStatus(
    twilioMessageSid: string,
    status: string,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    await db
      .update(outboundSmsMessages)
      .set({
        status,
        errorCode: errorCode || null,
        errorMessage: errorMessage || null,
        updatedAt: new Date(),
      })
      .where(eq(outboundSmsMessages.twilioMessageSid, twilioMessageSid));
  }
}

export const smsService = new SmsService();
