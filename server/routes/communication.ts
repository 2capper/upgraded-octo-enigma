import { Router } from "express";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { isAuthenticated, requireOrgAdmin } from "../auth";
import { smsService } from "../services/smsService";
import { chatbotService } from "../services/chatbotService";
import { teamService } from "../services/teamService";
import { tournamentService } from "../services/tournamentService";
import { organizationService } from "../services/organizationService";
import {
  tournamentMessages,
  communicationTemplates,
  insertCommunicationTemplateSchema,
} from "@shared/schema";
import { nanoid } from "nanoid";
import twilio from "twilio";

const router = Router();

// Get Twilio settings for organization
router.get('/organizations/:orgId/twilio-settings', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const settings = await smsService.getTwilioSettings(orgId);
    
    if (!settings) {
      const now = new Date();
      return res.json({
        id: `temp-${orgId}`,
        organizationId: orgId,
        accountSid: "",
        phoneNumber: "",
        isEnabled: true,
        dailyLimit: 100,
        rateLimit: 100,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        authTokenConfigured: false,
      });
    }

    const { authToken, ...safeSettings } = settings;
    res.json({ ...safeSettings, authTokenConfigured: true });
  } catch (error) {
    console.error("Error fetching Twilio settings:", error);
    res.status(500).json({ error: "Failed to fetch Twilio settings" });
  }
});

// Save Twilio settings
router.post('/organizations/:orgId/twilio-settings', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { accountSid, authToken, phoneNumber, dailyLimit, rateLimit, autoReplyMessage } = req.body;

    if (!accountSid || !phoneNumber) {
      return res.status(400).json({ error: "Account SID and Phone Number are required" });
    }

    const existing = await smsService.getTwilioSettings(orgId);
    if (!existing && !authToken) {
      return res.status(400).json({ error: "Auth Token is required for initial setup" });
    }

    const settings = await smsService.saveTwilioSettings(
      orgId,
      accountSid,
      authToken,
      phoneNumber,
      dailyLimit,
      rateLimit,
      autoReplyMessage
    );

    const { authToken: _, ...safeSettings } = settings;
    res.json({ ...safeSettings, authTokenConfigured: true });
  } catch (error) {
    console.error("Error saving Twilio settings:", error);
    res.status(400).json({ error: "Failed to save Twilio settings" });
  }
});

// Check rate limit status
router.get('/organizations/:orgId/sms/rate-limit', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const status = await smsService.checkRateLimit(orgId);
    res.json(status);
  } catch (error) {
    console.error("Error checking rate limit:", error);
    res.status(500).json({ error: "Failed to check rate limit" });
  }
});

// Send SMS message
router.post('/organizations/:orgId/sms/send', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const userId = (req.user as any).id;
    const { recipientPhone, recipientName, messageBody, tournamentId, teamId } = req.body;

    if (!recipientPhone || !messageBody) {
      return res.status(400).json({ error: "Recipient phone and message body are required" });
    }

    const result = await smsService.sendSms({
      organizationId: orgId,
      recipientPhone,
      recipientName,
      messageBody,
      sentBy: userId,
      tournamentId,
      teamId,
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

// Bulk send SMS messages
router.post('/organizations/:orgId/sms/send-bulk', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const userId = (req.user as any).id;
    const { recipients, messageBody, tournamentId } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: "Recipients array is required" });
    }

    if (!messageBody) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const messages = recipients.map(recipient => ({
      organizationId: orgId,
      recipientPhone: recipient.phone,
      recipientName: recipient.name,
      messageBody,
      sentBy: userId,
      tournamentId,
      teamId: recipient.teamId,
    }));

    const results = await smsService.bulkSendSms(messages);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error("Error sending bulk SMS:", error);
    res.status(500).json({ error: "Failed to send bulk SMS" });
  }
});

// Get message history
router.get('/organizations/:orgId/sms/messages', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await smsService.getMessageHistory(orgId, limit, offset);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching message history:", error);
    res.status(500).json({ error: "Failed to fetch message history" });
  }
});

// Twilio webhook for delivery status updates
router.post('/sms/webhook', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    if (MessageSid && MessageStatus) {
      await smsService.updateMessageStatus(MessageSid, MessageStatus, ErrorCode, ErrorMessage);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error("Error processing Twilio webhook:", error);
    res.status(500).send('Error');
  }
});

// Get inbound message inbox for organization (Smart Concierge)
router.get('/organizations/:orgId/sms/inbound', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const messages = await smsService.getInboundMessages(orgId, limit, offset);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching inbound messages:", error);
    res.status(500).json({ error: "Failed to fetch inbound messages" });
  }
});

// Mark an inbound message as read
router.post('/organizations/:orgId/sms/inbound/:messageId/mark-read', requireOrgAdmin, async (req: any, res) => {
  try {
    const { messageId } = req.params;

    await smsService.markInboundMessageRead(messageId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ error: "Failed to mark message as read" });
  }
});

// Public chatbot endpoint - no auth required for tournament visitors
router.post('/tournaments/:tournamentId/chat', async (req: any, res) => {
  try {
    const { tournamentId } = req.params;
    const { message, conversationHistory = [], userContext } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: "Message too long (max 500 characters)" });
    }

    const contextToUse = userContext || (req.user ? {
      id: req.user.id,
      name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
      role: req.user.isAdmin ? 'Admin' : 'Visitor'
    } : undefined);

    const result = await chatbotService.chat(tournamentId, message, conversationHistory, contextToUse);
    res.json(result);
  } catch (error) {
    console.error("Error in chatbot:", error);
    res.status(500).json({ error: "Failed to process chat message" });
  }
});

// Get quick answer suggestions for a tournament
router.get('/tournaments/:tournamentId/chat/suggestions', async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const suggestions = await chatbotService.getQuickAnswers(tournamentId);
    res.json(suggestions);
  } catch (error) {
    console.error("Error getting chat suggestions:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// Public webhook for Twilio inbound SMS (no auth required)
router.post("/webhooks/twilio/inbound", async (req, res) => {
  try {
    const fromNumber = req.body.From;
    const toNumber = req.body.To;
    const messageBody = req.body.Body || "";

    if (!fromNumber || !toNumber) {
      return res.status(400).send("Missing required fields: From or To");
    }

    const twimlResponse = await smsService.handleInboundMessage(
      fromNumber,
      toNumber,
      messageBody
    );

    res.type("text/xml");
    res.send(twimlResponse);
  } catch (error) {
    console.error("Error handling inbound SMS:", error);
    
    const MessagingResponse = twilio.twiml.MessagingResponse;
    const twiml = new MessagingResponse();
    twiml.message("We're experiencing technical difficulties. Please try again later.");
    
    res.type("text/xml");
    res.send(twiml.toString());
  }
});

// Create communication template
router.post('/organizations/:orgId/templates', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    
    const templateData = insertCommunicationTemplateSchema.parse({
      ...req.body,
      organizationId: orgId,
    });

    const [template] = await db.insert(communicationTemplates).values(templateData).returning();
    res.json(template);
  } catch (error: any) {
    if (error.name === 'ZodError') {
      console.error("Template validation error:", error);
      return res.status(400).json({ 
        error: "Invalid template data", 
        details: error.errors 
      });
    }
    
    console.error("Error creating template:", error);
    res.status(500).json({ error: "Failed to create template" });
  }
});

// Get all templates for an organization
router.get('/organizations/:orgId/templates', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const templates = await db.select()
      .from(communicationTemplates)
      .where(eq(communicationTemplates.organizationId, orgId))
      .orderBy(communicationTemplates.createdAt);
    
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Update template
router.patch('/organizations/:orgId/templates/:templateId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, templateId } = req.params;
    const { name, content } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: "Template name is required and cannot be empty" });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: "Template content is required and cannot be empty" });
    }

    const [updated] = await db.update(communicationTemplates)
      .set({
        name,
        content,
      })
      .where(
        and(
          eq(communicationTemplates.id, templateId),
          eq(communicationTemplates.organizationId, orgId)
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json(updated);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(500).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete('/organizations/:orgId/templates/:templateId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, templateId } = req.params;

    const result = await db.delete(communicationTemplates)
      .where(
        and(
          eq(communicationTemplates.id, templateId),
          eq(communicationTemplates.organizationId, orgId)
        )
      )
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Template not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// Get message history for a tournament
router.get('/organizations/:orgId/tournaments/:tournamentId/messages', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, tournamentId } = req.params;

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.organizationId !== orgId) {
      return res.status(403).json({ error: "Access denied: Tournament does not belong to this organization" });
    }

    const messages = await db.select()
      .from(tournamentMessages)
      .where(eq(tournamentMessages.tournamentId, tournamentId))
      .orderBy(sql`${tournamentMessages.sentAt} DESC`);

    res.json(messages);
  } catch (error) {
    console.error("Error fetching tournament messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// Send tournament-specific message to coaches and/or staff
router.post('/organizations/:orgId/tournaments/:tournamentId/send-message', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, tournamentId } = req.params;
    const { content, recipientType } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: "Message content is required and cannot be empty" });
    }

    if (!recipientType || !["coaches_only", "all_staff"].includes(recipientType)) {
      return res.status(400).json({ error: "Invalid recipient type. Must be 'coaches_only' or 'all_staff'" });
    }

    const organization = await organizationService.getOrganization(orgId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.organizationId !== orgId) {
      return res.status(403).json({ error: "Access denied: Tournament does not belong to this organization" });
    }

    const teams = await teamService.getTeams(tournamentId);
    
    const recipients = new Set<string>();
    for (const team of teams) {
      if (team.coachPhone) {
        recipients.add(team.coachPhone);
      }

      if (recipientType === "all_staff") {
        if (team.managerPhone) {
          recipients.add(team.managerPhone);
        }
        if (team.assistantPhone) {
          recipients.add(team.assistantPhone);
        }
      }
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const phone of recipients) {
      try {
        await smsService.sendSMS({
          organizationId: orgId,
          to: phone,
          message: `${tournament.name}: ${content}`,
        });
        successCount++;
      } catch (smsError: any) {
        console.error(`Error sending SMS to ${phone}:`, smsError);
        errorCount++;
        errors.push(`${phone}: ${smsError.message}`);
      }
    }

    const userId = req.user?.id;
    if (userId) {
      await db.insert(tournamentMessages).values({
        tournamentId,
        sentBy: userId,
        content,
        recipientType,
        recipientCount: successCount,
      });
    }

    res.json({
      success: true,
      message: `Message sent to ${successCount} recipient(s)`,
      totalRecipients: recipients.size,
      sentCount: successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error sending tournament message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// Request staff contacts from coaches via SMS
router.post('/organizations/:orgId/tournaments/:tournamentId/request-staff-contacts', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, tournamentId } = req.params;

    const organization = await organizationService.getOrganization(orgId);
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament || tournament.organizationId !== orgId) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const teams = await teamService.getTeams(tournamentId);
    
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const team of teams) {
      try {
        if (!team.coachPhone) {
          console.log(`Skipping team ${team.name} - no coach phone`);
          continue;
        }

        let token = team.managementToken;
        if (!token) {
          token = nanoid(32);
          await teamService.updateTeam(team.id, { managementToken: token });
        }

        const updateUrl = `${req.protocol}://${req.get('host')}/team/update/${token}`;

        await smsService.sendSMS({
          organizationId: orgId,
          to: team.coachPhone,
          message: `${tournament.name}: Please add your Team Manager and Assistant Coach contacts for ${team.name}. Click here: ${updateUrl}`,
        });

        successCount++;
      } catch (teamError: any) {
        console.error(`Error sending SMS to team ${team.name}:`, teamError);
        errorCount++;
        errors.push(`${team.name}: ${teamError.message}`);
      }
    }

    res.json({
      success: true,
      message: `Staff contact requests sent to ${successCount} coach(es)`,
      totalTeams: teams.length,
      sentCount: successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error requesting staff contacts:", error);
    res.status(500).json({ error: "Failed to request staff contacts" });
  }
});

export default router;
