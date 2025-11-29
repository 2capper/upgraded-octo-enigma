import { Router } from "express";
import { organizationService } from "../services/organizationService";
import { isAuthenticated, requireOrgAdmin, requireDiamondBooking } from "../auth";
import { insertCoachInvitationSchema, insertAdminInvitationSchema } from "@shared/schema";
import { notificationService } from "../lib/notificationService";
import { nanoid } from "nanoid";

const router = Router();

// Get accepted coach invitations for current user
router.get("/coach-invitations/accepted", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
    const invitations = await organizationService.getAcceptedCoachInvitations(userId);
    res.json(invitations);
  } catch (error) {
    console.error("Error fetching accepted coach invitations:", error);
    res.status(500).json({ message: "Failed to fetch accepted coach invitations" });
  }
});

// Coach Invitation Routes
router.get('/organizations/:orgId/invitations', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { status } = req.query;
    
    const invitations = await organizationService.getCoachInvitations(orgId, status as string | undefined);
    res.json(invitations);
  } catch (error) {
    console.error("Error fetching invitations:", error);
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

router.post('/organizations/:orgId/invitations', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const userId = (req.user as any).id;
    
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const validatedData = insertCoachInvitationSchema.parse({
      ...req.body,
      organizationId: orgId,
      token,
      expiresAt,
      invitedBy: userId,
    });
    
    const invitation = await organizationService.createCoachInvitation(validatedData);
    
    const org = await organizationService.getOrganization(orgId);
    if (org && invitation.email) {
      try {
        const host = req.get('host') || 'localhost:5000';
        const protocol = host.includes('localhost') ? 'http' : (req.protocol || 'https');
        const inviteUrl = `${protocol}://${host}/invite/${token}`;
        
        await notificationService.sendNotification({
          organizationId: orgId,
          type: 'approval_requested',
          channel: 'email',
          recipient: { email: invitation.email },
          subject: `Invitation to ${org.name} Booking System`,
          body: `You've been invited to access the ${org.name} booking system.\n\nClick here to accept: ${inviteUrl}\n\nThis invitation expires on ${expiresAt.toLocaleDateString()}.`,
        });
      } catch (emailError) {
        console.error("Failed to send invitation email:", emailError);
      }
    }
    
    res.status(201).json(invitation);
  } catch (error) {
    console.error("Error creating invitation:", error);
    res.status(400).json({ error: "Failed to create invitation" });
  }
});

router.delete('/organizations/:orgId/invitations/:invitationId', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, invitationId } = req.params;
    await organizationService.revokeCoachInvitation(invitationId, orgId);
    res.status(204).send();
  } catch (error) {
    console.error("Error revoking invitation:", error);
    res.status(400).json({ error: "Failed to revoke invitation" });
  }
});

// Public invitation routes (no auth or isAuthenticated only)
router.get('/invitations/:token', async (req: any, res) => {
  try {
    const { token } = req.params;
    const invitation = await organizationService.getCoachInvitationByToken(token);
    
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation has been ${invitation.status}` });
    }
    
    if (new Date() > new Date(invitation.expiresAt)) {
      return res.status(400).json({ error: "Invitation has expired" });
    }
    
    const org = await organizationService.getOrganization(invitation.organizationId);
    res.json({
      email: invitation.email,
      organizationName: org?.name,
      organizationId: invitation.organizationId,
      teamIds: invitation.teamIds,
      logoUrl: org?.logoUrl,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    });
  } catch (error) {
    console.error("Error validating invitation:", error);
    res.status(500).json({ error: "Failed to validate invitation" });
  }
});

router.post('/invitations/:token/accept', isAuthenticated, async (req: any, res) => {
  try {
    const { token } = req.params;
    const userId = (req.user as any).id;
    
    const invitation = await organizationService.getCoachInvitationByToken(token);
    
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
    }
    
    if (new Date() > new Date(invitation.expiresAt)) {
      return res.status(400).json({ error: "Invitation has expired" });
    }
    
    const acceptedInvitation = await organizationService.acceptCoachInvitation(token, userId);
    res.json(acceptedInvitation);
  } catch (error) {
    console.error("Error accepting invitation:", error);
    res.status(400).json({ error: "Failed to accept invitation" });
  }
});

// Admin Invitation Routes
router.get('/organizations/:orgId/admin-invitations', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { status } = req.query;
    
    const invitations = await organizationService.getAdminInvitations(orgId, status as string | undefined);
    res.json(invitations);
  } catch (error) {
    console.error("Error fetching admin invitations:", error);
    res.status(500).json({ error: "Failed to fetch admin invitations" });
  }
});

router.post('/organizations/:orgId/admin-invitations', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const userId = (req.user as any).id;
    
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    
    const validatedData = insertAdminInvitationSchema.parse({
      ...req.body,
      organizationId: orgId,
      token,
      expiresAt,
      invitedBy: userId,
    });
    
    const invitation = await organizationService.createAdminInvitation(validatedData);
    
    const org = await organizationService.getOrganization(orgId);
    if (org && invitation.email) {
      try {
        const host = req.get('host') || 'localhost:5000';
        const protocol = host.includes('localhost') ? 'http' : (req.protocol || 'https');
        const inviteUrl = `${protocol}://${host}/admin-invite/${token}`;
        
        await notificationService.sendNotification({
          organizationId: orgId,
          type: 'approval_requested',
          channel: 'email',
          recipient: { email: invitation.email },
          subject: `Admin Invitation to ${org.name}`,
          body: `You've been invited to become an administrator for ${org.name} on Dugout Desk.\n\nClick here to accept: ${inviteUrl}\n\nThis invitation expires on ${expiresAt.toLocaleDateString()}.`,
        });
      } catch (emailError) {
        console.error("Failed to send admin invitation email:", emailError);
      }
    }
    
    res.status(201).json(invitation);
  } catch (error) {
    console.error("Error creating admin invitation:", error);
    res.status(400).json({ error: "Failed to create admin invitation" });
  }
});

router.delete('/organizations/:orgId/admin-invitations/:invitationId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, invitationId } = req.params;
    await organizationService.revokeAdminInvitation(invitationId, orgId);
    res.status(204).send();
  } catch (error) {
    console.error("Error revoking admin invitation:", error);
    res.status(400).json({ error: "Failed to revoke admin invitation" });
  }
});

// Public admin invitation routes
router.get('/admin-invitations/:token', async (req: any, res) => {
  try {
    const { token } = req.params;
    const invitation = await organizationService.getAdminInvitationByToken(token);
    
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation has been ${invitation.status}` });
    }
    
    if (new Date() > new Date(invitation.expiresAt)) {
      return res.status(400).json({ error: "Invitation has expired" });
    }
    
    const org = await organizationService.getOrganization(invitation.organizationId);
    res.json({
      email: invitation.email,
      organizationName: org?.name,
      organizationId: invitation.organizationId,
      logoUrl: org?.logoUrl,
      expiresAt: invitation.expiresAt,
      status: invitation.status,
    });
  } catch (error) {
    console.error("Error validating admin invitation:", error);
    res.status(500).json({ error: "Failed to validate admin invitation" });
  }
});

router.post('/admin-invitations/:token/accept', isAuthenticated, async (req: any, res) => {
  try {
    const { token } = req.params;
    const userId = (req.user as any).id;
    
    const invitation = await organizationService.getAdminInvitationByToken(token);
    
    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }
    
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
    }
    
    if (new Date() > new Date(invitation.expiresAt)) {
      return res.status(400).json({ error: "Invitation has expired" });
    }
    
    // Accept the invitation
    const acceptedInvitation = await organizationService.acceptAdminInvitation(token, userId);
    
    // Add user as organization admin
    await organizationService.assignOrganizationAdmin(userId, invitation.organizationId);
    
    res.json(acceptedInvitation);
  } catch (error) {
    console.error("Error accepting admin invitation:", error);
    res.status(400).json({ error: "Failed to accept admin invitation" });
  }
});

// Remove organization admin
router.delete('/organizations/:orgId/admins/:userId', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId, userId } = req.params;
    
    // Prevent removing the last admin
    const admins = await organizationService.getOrganizationAdmins(orgId);
    if (admins.length <= 1) {
      return res.status(400).json({ error: "Cannot remove the last admin from the organization" });
    }
    
    await organizationService.removeOrganizationAdmin(userId, orgId);
    res.status(204).send();
  } catch (error) {
    console.error("Error removing admin:", error);
    res.status(400).json({ error: "Failed to remove admin" });
  }
});

export default router;
