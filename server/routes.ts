import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { userService } from "./services/userService";
import { organizationService } from "./services/organizationService";
import { diamondService } from "./services/diamondService";
import { teamService } from "./services/teamService";
import { tournamentService } from "./services/tournamentService";
import { gameService } from "./services/gameService";
import { playoffService } from "./services/playoffService";
import { smsService } from "./services/smsService";
import { weatherService } from "./services/weatherService";
import { 
  insertOrganizationSchema,
  insertTournamentSchema, 
  insertAgeDivisionSchema, 
  insertPoolSchema, 
  insertTeamSchema, 
  insertGameSchema,
  gameUpdateSchema,
  insertAdminRequestSchema,
  insertOrganizationCoordinatorSchema,
  insertCoachInvitationSchema,
  insertAdminInvitationSchema,
  tournamentMessages,
  communicationTemplates,
  insertCommunicationTemplateSchema
} from "@shared/schema";
import { setupAuth, isAuthenticated, requireAdmin, requireSuperAdmin, requireOrgAdmin, requireDiamondBooking } from "./replitAuth";
import { generateValidationReport } from "./validationReport";
import { generatePoolPlaySchedule, generateUnplacedMatchups, validateGameGuarantee } from "@shared/scheduleGeneration";
import { nanoid } from "nanoid";
import { calculateStats, resolveTie } from "@shared/standings";
import { calculateStandingsWithTiebreaking } from "@shared/standingsCalculation";
import { getPlayoffTeamsFromStandings } from "@shared/bracketGeneration";
import { getBracketStructure } from "@shared/bracketStructure";
import { generateICSFile, type CalendarEvent } from "./utils/ics-generator";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { notificationService } from "./lib/notificationService";
import twilio from "twilio";

// Helper function to get all organization IDs a user has access to
async function getUserOrganizationIds(userId: string): Promise<Set<string>> {
  const user = await userService.getUser(userId);
  const orgIds = new Set<string>();
  
  if (!user) {
    return orgIds;
  }
  
  // Super admins have access to all organizations
  if (user.isSuperAdmin) {
    const allOrgs = await organizationService.getOrganizations();
    allOrgs.forEach(org => orgIds.add(org.id));
    return orgIds;
  }
  
  // Get admin organizations
  if (user.isAdmin) {
    const adminOrgs = await userService.getUserOrganizations(userId);
    adminOrgs.forEach(org => orgIds.add(org.id));
  }
  
  // Get coach organizations (accepted invitations)
  const coachInvites = await organizationService.getAcceptedCoachInvitations(userId);
  coachInvites.forEach(inv => orgIds.add(inv.organizationId));
  
  // Get coordinator organizations
  const coordinatorAssignments = await userService.getUserCoordinatorAssignments(userId);
  coordinatorAssignments.forEach(assignment => orgIds.add(assignment.organizationId));
  
  return orgIds;
}

// Helper function to check tournament access for authenticated users
async function checkTournamentAccess(req: any, res: any, tournamentId: string): Promise<boolean> {
  const tournament = await tournamentService.getTournament(tournamentId);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return false;
  }
  
  // Authorization check for authenticated users
  if (req.user && req.user.claims) {
    const userId = req.user.claims.sub;
    const userOrgIds = await getUserOrganizationIds(userId);
    
    // Deny access if tournament is not in user's organizations
    // Empty org set means no access to any org-specific data
    if (!userOrgIds.has(tournament.organizationId)) {
      res.status(403).json({ error: "Access denied to this tournament" });
      return false;
    }
  }
  
  return true;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware (must be first so Passport is initialized)
  await setupAuth(app);
  
  // Test-only login endpoint for Cypress (after setupAuth so Passport is available)
  if (process.env.NODE_ENV !== 'production') {
    app.post('/api/test/login', async (req, res) => {
      try {
        const { email } = req.body;
        
        // Create or update test admin user
        const user = await userService.upsertUser({
          id: 'test-admin-cypress-id',
          email: email || 'test-admin@dugoutdesk.ca',
          name: 'Test Admin (Cypress)',
          isAdmin: true,
          isSuperAdmin: true,
        });
        
        // Create Express.User object matching Replit Auth structure
        // Set expires_at to 7 days in the future (matches session TTL)
        const futureExpiry = Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60);
        
        const expressUser: Express.User = {
          claims: {
            sub: user.id,
            email: user.email,
            name: user.name,
          },
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: futureExpiry,
        };
        
        // Use Passport's req.login() to properly serialize the session
        const reqWithLogin = req as any;
        await new Promise<void>((resolve, reject) => {
          reqWithLogin.login(expressUser, (err: any) => {
            if (err) return reject(err);
            // Also set userId for compatibility with existing code
            reqWithLogin.session.userId = user.id;
            resolve();
          });
        });
        
        res.json({ success: true, user });
      } catch (error) {
        console.error("Test login error:", error);
        res.status(500).json({ error: "Test login failed" });
      }
    });
  }
  
  // Hostname context endpoint (public, no auth required)
  app.get('/api/context', (req, res) => {
    const hostname = req.hostname;
    const isStorefront = hostname.startsWith('www.') || hostname === 'dugoutdesk.ca';
    
    res.json({
      hostname,
      isStorefront,
      isAdminApp: !isStorefront,
    });
  });
  
  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await userService.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get organizations for the currently logged-in user
  app.get("/api/users/me/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await userService.getUser(userId);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      let organizations;
      if (user.isSuperAdmin) {
        // Super Admins can see EVERYTHING
        organizations = await organizationService.getOrganizations();
      } else {
        // Collect all organizations user has access to (union of admin, coach, coordinator)
        const orgIds = new Set<string>();
        
        // Get admin organizations
        if (user.isAdmin) {
          const adminOrgs = await userService.getUserOrganizations(userId);
          adminOrgs.forEach(org => orgIds.add(org.id));
        }
        
        // Get coach organizations (accepted invitations)
        const coachInvites = await organizationService.getAcceptedCoachInvitations(userId);
        coachInvites.forEach(invite => orgIds.add(invite.organizationId));
        
        // Get coordinator organizations
        const coordinatorAssignments = await userService.getUserCoordinatorAssignments(userId);
        coordinatorAssignments.forEach(assignment => orgIds.add(assignment.organizationId));
        
        // Get unique organizations from collected IDs
        const allOrgs = await organizationService.getOrganizations();
        organizations = allOrgs.filter(org => orgIds.has(org.id));
      }
      
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching user organizations:", error);
      res.status(500).json({ error: "Failed to fetch user organizations" });
    }
  });

  // User list endpoint - super admin only
  app.get('/api/users', requireSuperAdmin, async (req, res) => {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin request routes
  app.post('/api/admin-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await userService.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.isAdmin || user.isSuperAdmin) {
        return res.status(400).json({ error: "You already have admin access" });
      }

      const existingRequest = await userService.getUserAdminRequest(userId);
      if (existingRequest && existingRequest.status === 'pending') {
        return res.status(400).json({ error: "You already have a pending admin request" });
      }

      // Check if organization slug already exists
      const existingOrg = await organizationService.getOrganizationBySlug(req.body.organizationSlug);
      if (existingOrg) {
        return res.status(400).json({ error: "An organization with this URL slug already exists. Please choose a different slug." });
      }

      const validatedData = insertAdminRequestSchema.parse({
        userId,
        userEmail: user.email || '',
        userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown',
        message: req.body.message,
        organizationName: req.body.organizationName,
        organizationSlug: req.body.organizationSlug,
        organizationDescription: req.body.organizationDescription,
        logoUrl: req.body.logoUrl,
        primaryColor: req.body.primaryColor || '#22c55e',
        secondaryColor: req.body.secondaryColor || '#ffffff',
        websiteUrl: req.body.websiteUrl,
        contactEmail: req.body.contactEmail,
        timezone: req.body.timezone || 'America/Toronto',
        defaultPlayoffFormat: req.body.defaultPlayoffFormat || 'top_6',
        defaultSeedingPattern: req.body.defaultSeedingPattern || 'standard',
        status: 'pending'
      });
      
      const request = await organizationService.createAdminRequest(validatedData);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating admin request:", error);
      res.status(400).json({ error: "Failed to create admin request" });
    }
  });

  app.get('/api/admin-requests', requireSuperAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await organizationService.getAdminRequests(status);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching admin requests:", error);
      res.status(500).json({ error: "Failed to fetch admin requests" });
    }
  });

  app.get('/api/admin-requests/my-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const request = await userService.getUserAdminRequest(userId);
      res.json(request || null);
    } catch (error) {
      console.error("Error fetching user admin request:", error);
      res.status(500).json({ error: "Failed to fetch admin request" });
    }
  });

  app.put('/api/admin-requests/:id/approve', requireSuperAdmin, async (req: any, res) => {
    try {
      const reviewerId = req.user.claims.sub;
      const request = await organizationService.approveAdminRequest(req.params.id, reviewerId);
      res.json(request);
    } catch (error: any) {
      console.error("Error approving admin request:", error);
      if (error.message === 'Admin request not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Admin request has already been processed') {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to approve admin request" });
    }
  });

  app.put('/api/admin-requests/:id/reject', requireSuperAdmin, async (req: any, res) => {
    try {
      const reviewerId = req.user.claims.sub;
      const request = await organizationService.rejectAdminRequest(req.params.id, reviewerId);
      res.json(request);
    } catch (error: any) {
      console.error("Error rejecting admin request:", error);
      if (error.message === 'Admin request not found') {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === 'Admin request has already been processed') {
        return res.status(409).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to reject admin request" });
    }
  });

  // Feature flag routes
  app.get('/api/feature-flags', async (req, res) => {
    try {
      const flags = await organizationService.getFeatureFlags();
      res.json(flags);
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ error: "Failed to fetch feature flags" });
    }
  });

  app.put('/api/feature-flags/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { isEnabled } = req.body;
      const updatedFlag = await organizationService.updateFeatureFlag(req.params.id, { isEnabled });
      res.json(updatedFlag);
    } catch (error: any) {
      console.error("Error updating feature flag:", error);
      if (error.message === 'Feature flag not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to update feature flag" });
    }
  });

  // Organization routes
  app.get("/api/organizations", async (req, res) => {
    try {
      const organizations = await organizationService.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Get organization by ID (for internal use, e.g., from tournament.organizationId)
  app.get("/api/organizations/by-id/:id", async (req, res) => {
    try {
      const organization = await organizationService.getOrganization(req.params.id);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  // Get organization by slug (for public pages)
  app.get("/api/organizations/:slug", async (req, res) => {
    try {
      const organization = await organizationService.getOrganizationBySlug(req.params.slug);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      res.json(organization);
    } catch (error) {
      console.error("Error fetching organization:", error);
      res.status(500).json({ error: "Failed to fetch organization" });
    }
  });

  app.get("/api/organizations/:slug/tournaments", async (req, res) => {
    try {
      const organization = await organizationService.getOrganizationBySlug(req.params.slug);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      const tournaments = await tournamentService.getTournaments(organization.id);
      res.json(tournaments);
    } catch (error) {
      console.error("Error fetching organization tournaments:", error);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  // Onboarding endpoint: allows any authenticated user to create their FIRST organization
  app.post("/api/onboarding/create-organization", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Check if user already has organizations
      const existingOrgs = await userService.getUserOrganizations(userId);
      if (existingOrgs.length > 0) {
        return res.status(403).json({ 
          error: "You already have an organization. Use the admin portal to manage it." 
        });
      }

      // Create the organization
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await organizationService.createOrganization(validatedData);

      // Automatically make the user an admin of their new organization
      await organizationService.assignOrganizationAdmin(userId, organization.id, 'admin');

      // Send welcome email
      const user = await userService.getUser(userId);
      if (organization.adminEmail && user) {
        const adminName = user.firstName 
          ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
          : user.email || 'Admin';
        
        try {
          await notificationService.sendWelcomeEmail({
            organizationId: organization.id,
            organizationName: organization.name,
            adminName,
            adminEmail: organization.adminEmail,
          });
        } catch (emailError) {
          console.error("Failed to send welcome email:", emailError);
        }
      }

      res.status(201).json(organization);
    } catch (error) {
      console.error("Error creating organization during onboarding:", error);
      res.status(400).json({ error: "Invalid organization data" });
    }
  });

  app.post("/api/organizations", requireSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await organizationService.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(400).json({ error: "Invalid organization data" });
    }
  });

  app.put("/api/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.partial().parse(req.body);
      const organization = await organizationService.updateOrganization(req.params.id, validatedData);
      res.json(organization);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(400).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      await organizationService.deleteOrganization(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting organization:", error);
      res.status(500).json({ error: "Failed to delete organization" });
    }
  });

  // Organization admin management routes
  app.post("/api/organizations/:organizationId/admins", requireSuperAdmin, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const { userId, role } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      const admin = await organizationService.assignOrganizationAdmin(userId, organizationId, role);
      res.status(201).json(admin);
    } catch (error) {
      console.error("Error assigning organization admin:", error);
      res.status(400).json({ error: "Failed to assign organization admin" });
    }
  });

  app.delete("/api/organizations/:organizationId/admins/:userId", requireSuperAdmin, async (req, res) => {
    try {
      const { organizationId, userId } = req.params;
      await organizationService.removeOrganizationAdmin(userId, organizationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing organization admin:", error);
      res.status(400).json({ error: "Failed to remove organization admin" });
    }
  });

  app.get("/api/organizations/:organizationId/admins", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const admins = await organizationService.getOrganizationAdmins(organizationId);
      res.json(admins);
    } catch (error) {
      console.error("Error fetching organization admins:", error);
      res.status(500).json({ error: "Failed to fetch organization admins" });
    }
  });

  app.get("/api/organizations/:organizationId/user-role", isAuthenticated, async (req: any, res) => {
    try {
      const { organizationId } = req.params;
      const userId = req.user.claims.sub;
      
      const admins = await organizationService.getOrganizationAdmins(organizationId);
      const userAdmin = admins.find(admin => admin.userId === userId);
      
      if (!userAdmin) {
        return res.json({ isAdmin: false, role: null });
      }
      
      res.json({
        isAdmin: true,
        role: userAdmin.role
      });
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({ error: "Failed to fetch user role" });
    }
  });

  app.get("/api/users/:userId/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      // Users can only view their own organizations unless they're a super admin
      if (requestingUserId !== targetUserId) {
        const user = await userService.getUser(requestingUserId);
        if (!user || !user.isSuperAdmin) {
          return res.status(403).json({ error: "Forbidden - Cannot view other users' organizations" });
        }
      }
      
      const organizations = await userService.getUserOrganizations(targetUserId);
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching user organizations:", error);
      res.status(500).json({ error: "Failed to fetch user organizations" });
    }
  });

  // Organization feature flag routes
  app.get("/api/organizations/:organizationId/feature-flags", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId } = req.params;
      
      // Get all global feature flags
      const globalFlags = await organizationService.getFeatureFlags();
      
      // Get organization-specific flag settings
      const orgFlags = await organizationService.getOrganizationFeatureFlags(organizationId);
      
      // Merge the data
      const flagsWithOrgSettings = globalFlags.map(flag => {
        const orgFlag = orgFlags.find(of => of.featureFlagId === flag.id);
        return {
          ...flag,
          orgEnabled: orgFlag ? orgFlag.isEnabled : null, // null means org hasn't set preference
          effectivelyEnabled: flag.isEnabled && (orgFlag ? orgFlag.isEnabled : true),
        };
      });
      
      res.json(flagsWithOrgSettings);
    } catch (error) {
      console.error("Error fetching organization feature flags:", error);
      res.status(500).json({ error: "Failed to fetch organization feature flags" });
    }
  });

  app.post("/api/organizations/:organizationId/feature-flags/:featureFlagId", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId, featureFlagId } = req.params;
      const { isEnabled } = req.body;
      
      if (typeof isEnabled !== 'boolean') {
        return res.status(400).json({ error: "isEnabled must be a boolean" });
      }
      
      const orgFlag = await organizationService.setOrganizationFeatureFlag(organizationId, featureFlagId, isEnabled);
      res.json(orgFlag);
    } catch (error) {
      console.error("Error setting organization feature flag:", error);
      res.status(500).json({ error: "Failed to set organization feature flag" });
    }
  });

  app.delete("/api/organizations/:organizationId/feature-flags/:featureFlagId", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId, featureFlagId } = req.params;
      await organizationService.removeOrganizationFeatureFlag(organizationId, featureFlagId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing organization feature flag:", error);
      res.status(500).json({ error: "Failed to remove organization feature flag" });
    }
  });

  // Check if a feature is enabled for an organization (public endpoint)
  app.get("/api/organizations/:organizationId/features/:featureKey/enabled", async (req, res) => {
    try {
      const { organizationId, featureKey } = req.params;
      const isEnabled = await organizationService.isFeatureEnabledForOrganization(organizationId, featureKey);
      res.json({ enabled: isEnabled });
    } catch (error) {
      console.error("Error checking feature enabled status:", error);
      res.status(500).json({ error: "Failed to check feature status" });
    }
  });

  // Diamond routes
  app.get("/api/organizations/:organizationId/diamonds", requireDiamondBooking, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const diamonds = await diamondService.getDiamonds(organizationId);
      res.json(diamonds);
    } catch (error) {
      console.error("Error fetching diamonds:", error);
      res.status(500).json({ error: "Failed to fetch diamonds" });
    }
  });

  app.post("/api/organizations/:organizationId/diamonds", requireDiamondBooking, requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const diamond = await diamondService.createDiamond({ ...req.body, organizationId });
      res.status(201).json(diamond);
    } catch (error) {
      console.error("Error creating diamond:", error);
      res.status(500).json({ error: "Failed to create diamond" });
    }
  });

  app.put("/api/diamonds/:id", requireOrgAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const diamond = await diamondService.updateDiamond(id, req.body);
      res.json(diamond);
    } catch (error) {
      console.error("Error updating diamond:", error);
      res.status(500).json({ error: "Failed to update diamond" });
    }
  });

  app.delete("/api/diamonds/:id", requireOrgAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await diamondService.deleteDiamond(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting diamond:", error);
      res.status(500).json({ error: "Failed to delete diamond" });
    }
  });

  // Diamond Restrictions routes
  app.get("/api/organizations/:organizationId/diamond-restrictions", isAuthenticated, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const restrictions = await diamondService.getDiamondRestrictions(organizationId);
      res.json(restrictions);
    } catch (error) {
      console.error("Error fetching diamond restrictions:", error);
      res.status(500).json({ error: "Failed to fetch diamond restrictions" });
    }
  });

  app.post("/api/organizations/:organizationId/diamond-restrictions", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const restriction = await diamondService.createDiamondRestriction({
        ...req.body,
        organizationId,
      });
      res.status(201).json(restriction);
    } catch (error) {
      console.error("Error creating diamond restriction:", error);
      res.status(500).json({ error: "Failed to create diamond restriction" });
    }
  });

  app.put("/api/diamond-restrictions/:id", requireOrgAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const restriction = await diamondService.updateDiamondRestriction(id, req.body);
      res.json(restriction);
    } catch (error) {
      console.error("Error updating diamond restriction:", error);
      res.status(500).json({ error: "Failed to update diamond restriction" });
    }
  });

  app.delete("/api/diamond-restrictions/:id", requireOrgAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await diamondService.deleteDiamondRestriction(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting diamond restriction:", error);
      res.status(500).json({ error: "Failed to delete diamond restriction" });
    }
  });

  // Public tournament directory endpoint (no auth required)
  app.get("/api/public/tournaments", async (req, res) => {
    try {
      // Get all tournaments
      let tournaments = await tournamentService.getTournaments();
      
      // Filter to only public tournaments
      tournaments = tournaments.filter(t => t.visibility === 'public');
      
      // Get organization details for each tournament
      const tournamentsWithOrgs = await Promise.all(
        tournaments.map(async (tournament) => {
          const org = tournament.organizationId 
            ? await organizationService.getOrganization(tournament.organizationId)
            : null;
          
          return {
            id: tournament.id,
            name: tournament.name,
            startDate: tournament.startDate,
            endDate: tournament.endDate,
            type: tournament.type,
            primaryColor: tournament.primaryColor,
            secondaryColor: tournament.secondaryColor,
            logoUrl: tournament.logoUrl,
            organization: org ? {
              id: org.id,
              name: org.name,
              slug: org.slug,
              logoUrl: org.logoUrl,
            } : null,
          };
        })
      );
      
      res.json(tournamentsWithOrgs);
    } catch (error) {
      console.error("Error fetching public tournaments:", error);
      res.status(500).json({ error: "Failed to fetch public tournaments" });
    }
  });

  // Tournament routes
  app.get("/api/tournaments", async (req: any, res) => {
    try {
      let tournaments = await tournamentService.getTournaments();
      
      // Role-aware filtering for authenticated users
      if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        const user = await userService.getUser(userId);
        
        // Super admins see all tournaments (no filtering)
        if (user && user.isSuperAdmin) {
          // No filtering - super admins see everything
        }
        // Regular org admins only see tournaments from their organizations
        else if (user && user.isAdmin) {
          const userOrgs = await userService.getUserOrganizations(userId);
          const userOrgIds = userOrgs.map(org => org.id);
          tournaments = tournaments.filter(t => userOrgIds.includes(t.organizationId));
        }
        // Coaches/coordinators see tournaments from their affiliated organizations
        else if (user) {
          const orgIds = new Set<string>();
          
          // Get coach organizations
          const acceptedInvites = await organizationService.getAcceptedCoachInvitations(userId);
          acceptedInvites.forEach(inv => orgIds.add(inv.organizationId));
          
          // Get coordinator organizations
          const coordinatorAssignments = await userService.getUserCoordinatorAssignments(userId);
          coordinatorAssignments.forEach(assignment => orgIds.add(assignment.organizationId));
          
          if (orgIds.size > 0) {
            // Filter to only show tournaments from affiliated organizations
            tournaments = tournaments.filter(t => orgIds.has(t.organizationId));
          }
          // If no affiliations, show all tournaments (public viewing)
        }
      }
      // Unauthenticated users see all tournaments (public viewing)
      
      res.json(tournaments);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/:id", async (req: any, res) => {
    try {
      const tournament = await tournamentService.getTournament(req.params.id);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Authorization check for authenticated users
      if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        const userOrgIds = await getUserOrganizationIds(userId);
        
        // If user has org affiliations and tournament is not in their orgs, deny access
        if (userOrgIds.size > 0 && !userOrgIds.has(tournament.organizationId)) {
          return res.status(403).json({ error: "Access denied to this tournament" });
        }
      }
      
      res.json(tournament);
    } catch (error) {
      console.error("Error fetching tournament:", error);
      res.status(500).json({ error: "Failed to fetch tournament" });
    }
  });

  app.post("/api/tournaments", requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await userService.getUser(userId);
      
      // Validate tournament data
      const validatedData = insertTournamentSchema.parse({
        ...req.body,
        createdBy: userId
      });

      // Authorization check: Verify user is admin for the target organization
      if (!user?.isSuperAdmin) {
        // Get user's organizations
        const userOrgs = await userService.getUserOrganizations(userId);
        const userOrgIds = userOrgs.map(org => org.id);
        
        // Check if user is admin for the target organization
        if (!userOrgIds.includes(validatedData.organizationId)) {
          return res.status(403).json({ 
            error: "You can only create tournaments for organizations you administer" 
          });
        }
      }

      const tournament = await tournamentService.createTournament(validatedData);

      // Send tournament creation email
      if (tournament.organizationId && user) {
        const organization = await organizationService.getOrganization(tournament.organizationId);
        if (organization?.adminEmail) {
          const adminName = user.firstName 
            ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
            : user.email || 'Admin';
          
          try {
            await notificationService.sendTournamentEmail({
              organizationId: organization.id,
              organizationName: organization.name,
              organizationLogoUrl: organization.logoUrl || undefined,
              primaryColor: organization.primaryColor || tournament.primaryColor || '#22c55e',
              tournamentId: tournament.id,
              tournamentName: tournament.name,
              startDate: tournament.startDate,
              endDate: tournament.endDate,
              adminName,
              adminEmail: organization.adminEmail,
            });
          } catch (emailError) {
            console.error("Failed to send tournament email:", emailError);
          }
        }
      }

      res.status(201).json(tournament);
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(400).json({ error: "Invalid tournament data" });
    }
  });

  app.put("/api/tournaments/:id", requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await userService.getUser(userId);
      const tournament = await tournamentService.getTournament(req.params.id);

      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      if (!user?.isSuperAdmin && tournament.createdBy !== userId) {
        return res.status(403).json({ error: "You can only edit tournaments you created" });
      }

      const validatedData = insertTournamentSchema.partial().parse(req.body);
      const updatedTournament = await tournamentService.updateTournament(req.params.id, validatedData);
      res.json(updatedTournament);
    } catch (error) {
      console.error("Error updating tournament:", error);
      res.status(400).json({ error: "Invalid tournament data" });
    }
  });

  app.delete("/api/tournaments/:id", requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await userService.getUser(userId);
      const tournament = await tournamentService.getTournament(req.params.id);

      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      if (!user?.isSuperAdmin && tournament.createdBy !== userId) {
        return res.status(403).json({ error: "You can only delete tournaments you created" });
      }

      await tournamentService.deleteTournament(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tournament:", error);
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // Age Division routes
  app.get("/api/tournaments/:tournamentId/age-divisions", async (req: any, res) => {
    try {
      if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
        return;
      }
      const ageDivisions = await tournamentService.getAgeDivisions(req.params.tournamentId);
      res.json(ageDivisions);
    } catch (error) {
      console.error("Error fetching age divisions:", error);
      res.status(500).json({ error: "Failed to fetch age divisions" });
    }
  });

  // Helper function to auto-create pools for a division
  async function autoCreatePoolsForDivision(tournamentId: string, divisionId: string) {
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      throw new Error("Tournament not found");
    }

    const numberOfPools = tournament.numberOfPools || 2;
    
    // Check if pools already exist for this division
    const existingPools = await tournamentService.getPools(tournamentId);
    const divisionPools = existingPools.filter(p => p.ageDivisionId === divisionId);
    if (divisionPools.length > 0) {
      console.log(`Pools already exist for division ${divisionId}, skipping auto-creation`);
      return;
    }
    
    // Generate pool names dynamically for any number of pools
    function getPoolName(index: number): string {
      if (index < 26) {
        return String.fromCharCode(65 + index); // A-Z
      }
      // For pools beyond Z, use AA, AB, AC, etc.
      const firstLetter = String.fromCharCode(65 + Math.floor(index / 26) - 1);
      const secondLetter = String.fromCharCode(65 + (index % 26));
      return firstLetter + secondLetter;
    }
    
    for (let i = 0; i < numberOfPools; i++) {
      await tournamentService.createPool({
        id: nanoid(),
        name: getPoolName(i),
        tournamentId,
        ageDivisionId: divisionId,
      });
    }
    
    console.log(`Auto-created ${numberOfPools} pools for division ${divisionId}`);
  }

  app.post("/api/tournaments/:tournamentId/age-divisions", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAgeDivisionSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const ageDivision = await tournamentService.createAgeDivision(validatedData);
      
      // Auto-create pools for this division
      await autoCreatePoolsForDivision(req.params.tournamentId, ageDivision.id);
      
      res.status(201).json(ageDivision);
    } catch (error) {
      console.error("Error creating age division:", error);
      res.status(400).json({ error: "Invalid age division data" });
    }
  });

  app.put("/api/age-divisions/:divisionId", requireAdmin, async (req, res) => {
    try {
      const { divisionId } = req.params;
      const updateData = insertAgeDivisionSchema.partial().parse(req.body);
      
      const updated = await tournamentService.updateAgeDivision(divisionId, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Age division not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error updating age division:", error);
      res.status(400).json({ error: "Invalid age division data" });
    }
  });

  // Pool routes
  app.get("/api/tournaments/:tournamentId/pools", async (req: any, res) => {
    try {
      if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
        return;
      }
      const pools = await tournamentService.getPools(req.params.tournamentId);
      res.json(pools);
    } catch (error) {
      console.error("Error fetching pools:", error);
      res.status(500).json({ error: "Failed to fetch pools" });
    }
  });

  app.post("/api/tournaments/:tournamentId/pools", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertPoolSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const pool = await tournamentService.createPool(validatedData);
      res.status(201).json(pool);
    } catch (error) {
      console.error("Error creating pool:", error);
      res.status(400).json({ error: "Invalid pool data" });
    }
  });

  // Team routes
  app.get("/api/tournaments/:tournamentId/teams", async (req: any, res) => {
    try {
      if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
        return;
      }
      // Prevent caching to ensure mobile devices get fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const teams = await teamService.getTeams(req.params.tournamentId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post("/api/tournaments/:tournamentId/teams", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertTeamSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const team = await teamService.createTeam(validatedData);
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(400).json({ error: "Invalid team data" });
    }
  });

  app.put("/api/teams/:id", requireAdmin, async (req, res) => {
    try {
      // Handle both direct data and wrapped data formats
      const updateData = req.body.data || req.body;
      console.log("Team update request body:", req.body);
      console.log("Update data to use:", updateData);
      
      if (!updateData || Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No data provided for update" });
      }
      
      const team = await teamService.updateTeam(req.params.id, updateData);
      res.json(team);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(400).json({ error: "Failed to update team" });
    }
  });

  // Scan team ID range endpoint
  app.post("/api/roster/scan-range", requireAdmin, async (req, res) => {
    const { startId, endId, batchSize = 10 } = req.body;
    
    if (!startId || !endId) {
      return res.status(400).json({ error: "Missing startId or endId" });
    }
    
    try {
      const { spawn } = await import("child_process");
      
      const python = spawn("python", [
        "server/roster_scraper.py",
        "scan_range",
        startId.toString(),
        endId.toString(),
        batchSize.toString()
      ]);
      
      let result = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        result += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to scan team IDs" });
        }
        
        try {
          const data = JSON.parse(result);
          res.json(data);
        } catch (e) {
          console.error("Failed to parse scan result:", e);
          res.status(500).json({ error: "Failed to process scan results" });
        }
      });
    } catch (error) {
      console.error("Error scanning team IDs:", error);
      res.status(500).json({ error: "Failed to scan team IDs" });
    }
  });

  // COBA Team Scanner - Import all COBA teams to database using web data
  app.post("/api/roster/scan-coba-web", isAuthenticated, async (req, res) => {
    try {
      console.log("🚀 Starting COBA web scan...");
      
      // First, fetch the COBA teams page using web_fetch (simulated)
      // In a real implementation, we'd use the web_fetch tool here
      const cobaUrl = "https://www.playoba.ca/stats#/2102/teams?season_id=8236";
      
      // For now, use the markdown content we already have
      const markdownContent = `
## [Rep] 10U A

![](https://digitalshift-stats.us-lax-1.linodeobjects.com/4f80bdf1-6796-4c95-b0b3-3a5933b1a675/team-logo_url-351753-burlington-10u-3-1710779767063117608-large.png)

Burlington 10U 3 A

[Roster](https://www.playoba.ca/stats#/team/499401/roster)

Halton Hills 10U A

[Roster](https://www.playoba.ca/stats#/team/499455/roster)

Milton 10U A

[Roster](https://www.playoba.ca/stats#/team/499475/roster)

Miss Majors 10U A

[Roster](https://www.playoba.ca/stats#/team/499530/roster)

![](https://digitalshift-stats.us-lax-1.linodeobjects.com/4f80bdf1-6796-4c95-b0b3-3a5933b1a675/team-logo_url-247656-miss-sw-9u-1-1683652836642067569-large.png)

Miss SW 10U A

[Roster](https://www.playoba.ca/stats#/team/499549/roster)

![](https://digitalshift-stats.us-lax-1.linodeobjects.com/4f80bdf1-6796-4c95-b0b3-3a5933b1a675/team-logo_url-499500-mississauga-north-10u-a-1745323149674887270-large.png)

Mississauga North 10U A

[Roster](https://www.playoba.ca/stats#/team/499500/roster)

Oakville 10U Team A

[Roster](https://www.playoba.ca/stats#/team/525820/roster)

## [Rep] 10U AA

Brampton 10U AA

[Roster](https://www.playoba.ca/stats#/team/520469/roster)

Burlington 10U AA

[Roster](https://www.playoba.ca/stats#/team/499400/roster)

Milton 10U AA

[Roster](https://www.playoba.ca/stats#/team/499476/roster)

Miss SW 10U AA

[Roster](https://www.playoba.ca/stats#/team/502262/roster)

Oakville 10U Team AA

[Roster](https://www.playoba.ca/stats#/team/499561/roster)

Waterdown 10U AA

[Roster](https://www.playoba.ca/stats#/team/527241/roster)
`;
      
      const { spawn } = await import("child_process");
      
      const python = spawn("python", [
        "server/coba_web_scraper.py",
        "process",
        markdownContent
      ]);
      
      let result = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        result += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
        console.log("COBA scraper output:", data.toString());
      });
      
      python.on("close", (code) => {
        if (code !== 0) {
          console.error("COBA web scanner error:", error);
          return res.status(500).json({ error: "Failed to scan COBA teams from web" });
        }
        
        try {
          const data = JSON.parse(result);
          res.json(data);
        } catch (e) {
          console.error("Failed to parse COBA web scan result:", e);
          res.status(500).json({ error: "Failed to process COBA web scan results" });
        }
      });
    } catch (error) {
      console.error("Error scanning COBA teams from web:", error);
      res.status(500).json({ error: "Failed to scan COBA teams from web" });
    }
  });

  // COBA Team Scanner - Import all COBA teams to database using static data
  app.post("/api/roster/scan-coba", isAuthenticated, async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      
      const python = spawn("python", [
        "server/coba_team_scraper.py",
        "scan"
      ]);
      
      let result = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        result += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code !== 0) {
          console.error("COBA scanner error:", error);
          return res.status(500).json({ error: "Failed to scan COBA teams" });
        }
        
        try {
          const data = JSON.parse(result);
          res.json(data);
        } catch (e) {
          console.error("Failed to parse COBA scan result:", e);
          res.status(500).json({ error: "Failed to process COBA scan results" });
        }
      });
    } catch (error) {
      console.error("Error scanning COBA teams:", error);
      res.status(500).json({ error: "Failed to scan COBA teams" });
    }
  });

  // Smart team matching for roster import  
  app.post("/api/teams/:id/find-oba-matches", async (req, res) => {
    try {
      const teamId = req.params.id;
      const { spawn } = await import("child_process");
      
      // Get the tournament team details
      const team = await teamService.getTeamById(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Get the team's pool to find the age division
      const pool = await tournamentService.getPoolById(team.poolId);
      if (!pool) {
        return res.status(404).json({ error: "Team's pool not found" });
      }

      // Use Python script to find matching OBA teams
      const python = spawn("python", [
        "server/roster_scraper.py",
        "find_matches",
        team.name,
        pool.ageDivisionId,
        "500000", // start range
        "505000"  // end range - smaller for faster testing
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to find OBA matches" });
        }

        try {
          const data = JSON.parse(result);
          res.json({
            team: {
              id: team.id,
              name: team.name,
              division: pool.ageDivisionId
            },
            matches: data.matches || [],
            total_found: data.total_found || 0
          });
        } catch (e) {
          console.error("Failed to parse result:", e);
          res.status(500).json({ error: "Failed to process match results" });
        }
      });
    } catch (error) {
      console.error("Error finding OBA matches:", error);
      res.status(500).json({ error: "Failed to find OBA matches" });
    }
  });

  // Direct team ID import endpoint
  app.post("/api/teams/:id/roster/import-by-team-id", isAuthenticated, async (req, res) => {
    const { teamId, obaTeamId } = req.body;
    
    if (!teamId || !obaTeamId) {
      return res.status(400).json({ error: "Missing teamId or obaTeamId" });
    }
    
    try {
      const { spawn } = await import("child_process");
      // Use any affiliate number since it doesn't matter
      const teamUrl = `https://www.playoba.ca/stats#/2111/team/${obaTeamId}/roster`;
      
      const python = spawn("python", [
        "server/roster_scraper.py",
        "import",
        teamUrl
      ]);
      
      let result = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        result += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", async (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to import roster" });
        }
        
        try {
          const data = JSON.parse(result);
          console.log("Team ID import data:", data);
          
          if (data.success && data.roster) {
            const players = data.roster.players || [];
            
            const updateData: any = {};
            updateData.rosterLink = teamUrl;
            if (players.length > 0) {
              updateData.rosterData = JSON.stringify(players);
            }
            
            if (Object.keys(updateData).length > 0) {
              const team = await teamService.updateTeam(teamId, updateData);
              res.json({ 
                success: true, 
                team, 
                roster: data.roster,
                player_count: players.length 
              });
            } else {
              res.status(400).json({ error: "No data to update" });
            }
          } else {
            res.status(400).json({ error: data.error || "Failed to import roster" });
          }
        } catch (e) {
          console.error("Failed to parse result:", e);
          res.status(500).json({ error: "Failed to process import results" });
        }
      });
    } catch (error) {
      console.error("Error importing roster by team ID:", error);
      res.status(500).json({ error: "Failed to import roster" });
    }
  });

  // Roster import endpoints
  // Get all affiliates with their organizations
  app.get("/api/affiliates", isAuthenticated, async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "get_affiliates"
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to get affiliates" });
        }
        
        try {
          const data = JSON.parse(result.trim());
          res.json(data);
        } catch (e) {
          console.error("Failed to parse affiliates:", e);
          res.status(500).json({ error: "Failed to process affiliates" });
        }
      });
    } catch (error) {
      console.error("Error getting affiliates:", error);
      res.status(500).json({ error: "Failed to get affiliates" });
    }
  });

  // Get teams for a specific organization and division
  app.post("/api/organizations/:organization/teams", isAuthenticated, async (req, res) => {
    try {
      const { organization } = req.params;
      const { affiliateNumber, division } = req.body;
      
      if (!affiliateNumber || !division) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "get_organization_teams",
        affiliateNumber,
        organization,
        division
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to get organization teams" });
        }
        
        try {
          const data = JSON.parse(result.trim());
          res.json(data);
        } catch (e) {
          console.error("Failed to parse organization teams:", e);
          res.status(500).json({ error: "Failed to process organization teams" });
        }
      });
    } catch (error) {
      console.error("Error getting organization teams:", error);
      res.status(500).json({ error: "Failed to get organization teams" });
    }
  });

  // Team matching endpoint for roster import
  app.post("/api/roster/match-teams", async (req, res) => {
    try {
      const { teamName, division } = req.body;
      
      if (!teamName || !division) {
        return res.status(400).json({ error: "Missing teamName or division" });
      }

      // Call simple team matcher to find matching teams
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/simple_team_matcher.py",
        "search",
        teamName,
        division
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to find team matches" });
        }
        
        try {
          const data = JSON.parse(result.trim());
          
          res.json({
            success: true,
            matches: data.matches || [],
            total_found: data.total_found || 0
          });
        } catch (e) {
          console.error("Failed to parse match results:", e);
          res.status(500).json({ error: "Failed to process match results" });
        }
      });
    } catch (error) {
      console.error("Error finding team matches:", error);
      res.status(500).json({ error: "Failed to find team matches" });
    }
  });

  // Start comprehensive team scanning
  app.post("/api/admin/scan-oba-teams", isAuthenticated, async (req, res) => {
    try {
      const { startId = 500000, endId = 510000 } = req.body;
      
      // Start the scanning process in background
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/team_discovery.py",
        "scan",
        startId.toString(),
        endId.toString()
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Team scanning error:", error);
        } else {
          console.log("Team scanning completed:", result);
        }
      });

      res.json({ 
        success: true, 
        message: "Team scanning started",
        range: { startId, endId }
      });
    } catch (error) {
      console.error("Failed to start team scanning:", error);
      res.status(500).json({ error: "Failed to start team scanning" });
    }
  });

  // Get scanning statistics
  app.get("/api/admin/oba-teams/stats", isAuthenticated, async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/team_discovery.py",
        "stats"
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Stats error:", error);
          return res.status(500).json({ error: "Failed to get statistics" });
        }
        
        res.json({ success: true, stats: result.trim() });
      });
    } catch (error) {
      console.error("Statistics error:", error);
      res.status(500).json({ error: "Failed to get scanning statistics" });
    }
  });

  app.post("/api/teams/:teamId/roster/search", isAuthenticated, async (req, res) => {
    try {
      const { affiliate, season, division, teamName } = req.body;
      
      if (!affiliate || !season || !division || !teamName) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Call Python scraper
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/roster_scraper.py",
        "search",
        affiliate,
        season,
        division,
        teamName
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python script error code:", code);
          console.error("Python script stderr:", error);
          console.error("Python script stdout:", result);
          return res.status(500).json({ error: "Failed to search for team" });
        }
        
        try {
          // Clean the output in case there are extra whitespaces or newlines
          const cleanedResult = result.trim();
          const data = JSON.parse(cleanedResult);
          res.json(data);
        } catch (e) {
          console.error("Failed to parse JSON result:", e);
          console.error("Raw stdout output:", result);
          console.error("Raw stderr output:", error);
          console.error("Result length:", result.length);
          console.error("First 100 chars:", result.substring(0, 100));
          res.status(500).json({ error: "Failed to process search results" });
        }
      });
    } catch (error) {
      console.error("Error searching for roster:", error);
      res.status(500).json({ error: "Failed to search for roster" });
    }
  });

  app.post("/api/teams/:teamId/roster/import", requireAdmin, async (req, res) => {
    try {
      const { teamUrl, obaTeamId } = req.body;
      const { teamId } = req.params;
      
      let finalUrl = teamUrl;
      
      // If no URL but we have an OBA team ID, construct the URL
      if (!teamUrl && obaTeamId) {
        finalUrl = `https://www.playoba.ca/stats#/2106/team/${obaTeamId}/roster`;
      }
      
      if (!finalUrl) {
        return res.status(400).json({ error: "Team URL or OBA team ID required" });
      }

      console.log(`🎯 Importing roster from: ${finalUrl}`);

      // Call Python scraper to get authentic roster data
      const { spawn } = await import("child_process");
      const python = spawn("python", [
        "server/real_oba_scraper.py",
        "import",
        finalUrl
      ]);

      let result = "";
      let error = "";

      python.stdout.on("data", (data) => {
        result += data.toString();
      });

      python.stderr.on("data", (data) => {
        error += data.toString();
      });

      python.on("close", async (code) => {
        if (code !== 0) {
          console.error("Python script error:", error);
          return res.status(500).json({ error: "Failed to import roster" });
        }
        
        try {
          console.log("Python script output:", result);
          const data = JSON.parse(result);
          console.log("Parsed data:", data);
          
          if (data.success && data.roster) {
            const players = data.roster.players || [];
            console.log(`✅ Found ${players.length} authentic players`);
            
            // Verify we have real player data (not navigation text)
            const validPlayers = players.filter((p: any) => 
              p.name && 
              p.name.length > 3 &&
              !p.name.toLowerCase().includes('skip') &&
              !p.name.toLowerCase().includes('content') &&
              p.name.split(' ').length >= 2
            );
            
            if (validPlayers.length === 0) {
              return res.status(400).json({ 
                error: "No valid player data found",
                suggestion: "The team may not exist or roster may be empty" 
              });
            }
            
            // Update team with authentic roster data
            const updateData: any = {
              rosterLink: finalUrl,
              rosterData: JSON.stringify(validPlayers)
            };
            
            const team = await teamService.updateTeam(teamId, updateData);
            
            res.json({ 
              success: true, 
              team, 
              roster: {
                ...data.roster,
                players: validPlayers
              },
              players_imported: validPlayers.length,
              authentic_data: data.roster.authentic_data || true
            });
          } else {
            res.status(400).json({ error: data.error || "Failed to import roster" });
          }
        } catch (e) {
          console.error("Failed to parse result:", e);
          console.error("Raw result:", result);
          res.status(500).json({ error: "Failed to process import results" });
        }
      });
    } catch (error) {
      console.error("Error importing roster:", error);
      res.status(500).json({ error: "Failed to import roster" });
    }
  });

  app.delete("/api/teams/:id", requireAdmin, async (req, res) => {
    try {
      await teamService.deleteTeam(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting team:", error);
      res.status(400).json({ error: "Failed to delete team" });
    }
  });

  // Helper endpoint to populate team data fields
  app.post("/api/teams/:id/populate-data", isAuthenticated, async (req, res) => {
    try {
      const teamId = req.params.id;
      const { teamName } = req.body;
      
      // Generate suggested data based on team name
      const formattedTeamName = teamName.toLowerCase().replace(/\s+/g, '-');
      const rosterLink = `https://playoba.ca/stats/${formattedTeamName}`;
      
      // For now, we'll leave the other fields for manual entry
      // In the future, this could be extended to fetch data from external sources
      const suggestedData = {
        rosterLink,
        pitchCountAppName: '', // To be filled manually
        pitchCountName: '',    // To be filled manually
        gameChangerName: ''    // To be filled manually
      };
      
      // Update the team with the suggested data
      const updatedTeam = await teamService.updateTeam(teamId, suggestedData);
      
      res.json({
        team: updatedTeam,
        suggestions: suggestedData
      });
    } catch (error) {
      console.error("Error populating team data:", error);
      res.status(400).json({ error: "Failed to populate team data" });
    }
  });

  // Matchup routes
  app.get("/api/tournaments/:tournamentId/matchups", async (req: any, res) => {
    try {
      if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
        return;
      }
      const { tournamentId } = req.params;
      const { poolId } = req.query;
      
      const matchups = await tournamentService.getMatchups(tournamentId, poolId as string | undefined);
      res.json(matchups);
    } catch (error) {
      console.error("Error fetching matchups:", error);
      res.status(500).json({ error: "Failed to fetch matchups" });
    }
  });

  // Game routes
  app.get("/api/tournaments/:tournamentId/games", async (req: any, res) => {
    try {
      if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
        return;
      }
      const games = await gameService.getGames(req.params.tournamentId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  // CSV export endpoint
  app.get("/api/tournaments/:tournamentId/schedule-export", async (req: any, res) => {
    try {
      if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
        return;
      }
      const tournamentId = req.params.tournamentId;
      const divisionId = req.query.divisionId as string | undefined;
      const dateFilter = req.query.date as string | undefined;
      
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      let allGames = await gameService.getGames(tournamentId);
      const teams = await teamService.getTeams(tournamentId);
      const pools = await tournamentService.getPools(tournamentId);
      const ageDivisions = await tournamentService.getAgeDivisions(tournamentId);
      
      // Fetch diamonds with error handling for permission issues
      let diamonds: any[] = [];
      try {
        diamonds = await diamondService.getDiamonds(tournament.organizationId);
      } catch (error) {
        console.warn("Could not fetch diamonds for CSV export:", error);
        // Continue without diamond names
      }

      // Create lookup maps
      const teamMap = new Map(teams.map(t => [t.id, t]));
      const poolMap = new Map(pools.map(p => [p.id, p]));
      const diamondMap = new Map(diamonds.map(d => [d.id, d]));
      const ageDivisionMap = new Map(ageDivisions.map(d => [d.id, d]));

      // Filter games by division if specified
      let games = allGames;
      if (divisionId) {
        const divisionPools = pools.filter(p => p.ageDivisionId === divisionId);
        const divisionPoolIds = new Set(divisionPools.map(p => p.id));
        games = allGames.filter(g => g.poolId && divisionPoolIds.has(g.poolId));
      }
      
      // Filter games by date if specified
      if (dateFilter) {
        games = games.filter(g => g.date === dateFilter);
      }

      // Helper function to escape CSV fields
      const escapeCSV = (field: string | null | undefined): string => {
        if (!field) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Sort games chronologically using Date objects
      const sortedGames = games.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}:00`);
        const dateB = new Date(`${b.date}T${b.time}:00`);
        const timeDiff = dateA.getTime() - dateB.getTime();
        
        // If same time, sort by diamond
        if (timeDiff === 0) {
          return (a.diamondId || '').localeCompare(b.diamondId || '');
        }
        return timeDiff;
      });

      // Generate CSV headers
      const headers = ['Date', 'Time', 'Diamond', 'Home Team', 'Away Team', 'Pool', 'Division', 'Duration (min)'];
      const csvRows = [headers.join(',')];

      // Generate CSV rows
      for (const game of sortedGames) {
        const homeTeam = teamMap.get(game.homeTeamId);
        const awayTeam = teamMap.get(game.awayTeamId);
        const pool = game.poolId ? poolMap.get(game.poolId) : null;
        const diamond = game.diamondId ? diamondMap.get(game.diamondId) : null;
        
        // Get division from pool's age division (more reliable than team.division)
        const division = pool?.ageDivisionId ? ageDivisionMap.get(pool.ageDivisionId)?.name : '';

        const row = [
          escapeCSV(game.date),
          escapeCSV(game.time),
          escapeCSV(diamond?.name || ''),
          escapeCSV(homeTeam?.name || ''),
          escapeCSV(awayTeam?.name || ''),
          escapeCSV(pool?.name || ''),
          escapeCSV(division || ''),
          escapeCSV(String(game.durationMinutes || 90))
        ];
        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\n');

      // Set headers for file download
      const safeFileName = tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}-schedule.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error("Error exporting schedule:", error);
      res.status(500).json({ error: "Failed to export schedule" });
    }
  });

  app.post("/api/tournaments/:tournamentId/games", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const game = await gameService.createGame(validatedData);
      res.status(201).json(game);
    } catch (error) {
      console.error("Error creating game:", error);
      res.status(400).json({ error: "Invalid game data" });
    }
  });

  app.put("/api/games/:id", requireAdmin, async (req, res) => {
    try {
      // Validate the game update data
      const validatedData = gameUpdateSchema.parse(req.body);
      
      // If duration, time, date, or diamond is being updated, validate no overlaps
      if (validatedData.durationMinutes !== undefined || validatedData.time !== undefined || 
          validatedData.date !== undefined || validatedData.diamondId !== undefined) {
        const currentGame = await gameService.getGame(req.params.id);
        if (!currentGame) {
          return res.status(404).json({ error: "Game not found" });
        }
        
        // Compute effective game attributes (use updated values or fall back to current)
        const effectiveDate = validatedData.date ?? currentGame.date;
        const effectiveTime = validatedData.time ?? currentGame.time;
        const effectiveDiamond = validatedData.diamondId ?? currentGame.diamondId;
        const effectiveDuration = validatedData.durationMinutes ?? currentGame.durationMinutes;
        
        // Get all games on the same diamond and date
        const tournamentGames = await gameService.getGames(currentGame.tournamentId);
        const conflictingGames = tournamentGames.filter(g => 
          g.id !== currentGame.id && 
          g.diamondId === effectiveDiamond && 
          g.date === effectiveDate
        );
        
        // Calculate effective game time range
        const [hours, minutes] = effectiveTime.split(':').map(Number);
        const gameStartMinutes = hours * 60 + minutes;
        const gameEndMinutes = gameStartMinutes + effectiveDuration;
        
        // Check for overlaps
        for (const otherGame of conflictingGames) {
          const [otherHours, otherMinutes] = otherGame.time.split(':').map(Number);
          const otherStartMinutes = otherHours * 60 + otherMinutes;
          const otherEndMinutes = otherStartMinutes + (otherGame.durationMinutes || 90);
          
          // Overlap if: gameEnd > otherStart AND gameStart < otherEnd
          if (gameEndMinutes > otherStartMinutes && gameStartMinutes < otherEndMinutes) {
            return res.status(409).json({ 
              error: "Game would overlap with another game on the same diamond" 
            });
          }
        }
      }
      
      // Get user ID from the authenticated session
      const user = req.user as any;
      const userId = user.claims.sub;
      
      // Prepare metadata for audit trail
      const metadata = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      };
      
      // Update game with audit logging
      const game = await gameService.updateGameWithAudit(req.params.id, validatedData, userId, metadata);
      
      res.json(game);
    } catch (error) {
      console.error("Error updating game:", error);
      
      // Provide specific error messages for validation failures
      if ((error as any).name === 'ZodError') {
        return res.status(400).json({ 
          error: "Invalid score data", 
          details: (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`) 
        });
      }
      
      res.status(400).json({ error: "Failed to update game" });
    }
  });

  app.delete("/api/games/:id", requireAdmin, async (req, res) => {
    try {
      await gameService.deleteGame(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting game:", error);
      res.status(400).json({ error: "Failed to delete game" });
    }
  });

  // Helper function to generate playoff games based on format
  function generatePlayoffGames(
    standings: any[],
    playoffFormat: string,
    seedingPattern: string,
    tournamentId: string,
    ageDivisionId: string
  ) {
    const bracketStructure = getBracketStructure(playoffFormat, seedingPattern);
    
    const games = bracketStructure.map(slot => {
      const game: any = {
        id: nanoid(),
        tournamentId,
        ageDivisionId,
        isPlayoff: true,
        playoffRound: slot.round,
        playoffGameNumber: slot.gameNumber,
        status: 'scheduled',
        date: '',
        time: '',
        location: '',
        subVenue: '',
        poolId: null,
      };
      
      // Handle home team source
      if (slot.homeSource.type === 'seed') {
        game.homeTeamId = standings[slot.homeSource.rank - 1]?.id || null;
      } else {
        game.homeTeamId = null;
        game.team1Source = {
          type: 'winner',
          gameNumber: slot.homeSource.gameNumber,
          round: slot.homeSource.round
        };
      }
      
      // Handle away team source
      if (slot.awaySource.type === 'seed') {
        game.awayTeamId = standings[slot.awaySource.rank - 1]?.id || null;
      } else {
        game.awayTeamId = null;
        game.team2Source = {
          type: 'winner',
          gameNumber: slot.awaySource.gameNumber,
          round: slot.awaySource.round
        };
      }
      
      return game;
    });
    
    return games;
  }

  // Generate playoff bracket from pool play standings
  app.post("/api/tournaments/:tournamentId/generate-playoffs", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      
      // Fetch tournament to get playoff format and seeding pattern
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const playoffFormat = tournament.playoffFormat || 'top_8';
      const seedingPattern = tournament.seedingPattern || 'standard';
      
      // Fetch all pools, teams, and games for this tournament
      const pools = await tournamentService.getPools(tournamentId);
      const teams = await teamService.getTeams(tournamentId);
      const allGames = await gameService.getGames(tournamentId);
      const divisions = await tournamentService.getAgeDivisions(tournamentId);
      
      // Filter pool play games only (not playoff games)
      const poolPlayGames = allGames.filter(g => !g.isPlayoff);
      
      // Delete all existing playoff games for this tournament
      const playoffGames = allGames.filter(g => g.isPlayoff);
      for (const game of playoffGames) {
        await gameService.deleteGame(game.id);
      }
      
      // Generate playoff games for each division
      const newPlayoffGames: any[] = [];
      
      for (const division of divisions) {
        // Get pools for this division
        const divisionPools = pools.filter(p => p.ageDivisionId === division.id);
        const divisionPoolIds = divisionPools.map(p => p.id);
        
        // Get teams in this division
        const divisionTeams = teams.filter(t => divisionPoolIds.includes(t.poolId));
        const divisionTeamIds = divisionTeams.map(t => t.id);
        
        // Get pool play games for this division
        const divisionGames = poolPlayGames.filter(g => 
          g.homeTeamId && g.awayTeamId &&
          divisionTeamIds.includes(g.homeTeamId) && divisionTeamIds.includes(g.awayTeamId)
        );
        
        // Calculate standings using shared logic
        const teamsWithStats = divisionTeams.map(team => {
          const stats = calculateStats(team.id, divisionGames);
          return {
            ...team,
            ...stats,
            points: (stats.wins * 2) + (stats.ties * 1),
            runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : 0,
            runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
          };
        });
        
        // Sort by points first, then use tie-breaking logic
        const sortedByPoints = teamsWithStats.sort((a, b) => b.points - a.points);
        const overallStandings = resolveTie(sortedByPoints, divisionGames);
        
        // Generate playoff games based on format
        const divisionPlayoffGames = generatePlayoffGames(
          overallStandings,
          playoffFormat,
          seedingPattern,
          tournamentId,
          division.id
        );
        
        newPlayoffGames.push(...divisionPlayoffGames);
      }
      
      // Insert new playoff games into database
      for (const gameData of newPlayoffGames) {
        await gameService.createGame(gameData);
      }
      
      res.json({ 
        message: "Playoffs generated successfully", 
        gamesCreated: newPlayoffGames.length 
      });
    } catch (error) {
      console.error("Error generating playoffs:", error);
      res.status(500).json({ 
        error: "Failed to generate playoffs",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Pre-schedule playoff games (slot manager)
  app.post("/api/tournaments/:tournamentId/divisions/:divisionId/playoff-slots", requireAdmin, async (req, res) => {
    try {
      const { tournamentId, divisionId } = req.params;
      const { slots } = req.body;

      if (!slots || typeof slots !== 'object') {
        return res.status(400).json({ error: "Invalid request body. Expected { slots: {...} }" });
      }

      // Delegate to storage layer
      const updatedGames = await playoffService.savePlayoffSlots(tournamentId, divisionId, slots);

      res.json({ 
        message: "Playoff schedule saved successfully",
        gamesCreated: updatedGames.length,
        games: updatedGames
      });
    } catch (error: any) {
      console.error("Error saving playoff slots:", error);
      
      // Map domain errors to appropriate HTTP status codes
      if (error.httpStatus) {
        return res.status(error.httpStatus).json({ 
          error: error.message,
          details: error.name
        });
      }
      
      // Default to 500 for unexpected errors
      res.status(500).json({ 
        error: "Failed to save playoff schedule",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Move game to new date/time/diamond via drag-and-drop
  app.put("/api/games/:gameId/move", requireAdmin, async (req, res) => {
    try {
      const { gameId } = req.params;
      const { date, time, diamondId } = req.body;

      // Validate required fields
      if (!date || !time || !diamondId) {
        return res.status(400).json({ error: "Missing required fields: date, time, diamondId" });
      }

      // Get the game being moved
      const game = await gameService.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Get tournament to validate date range
      const tournament = await tournamentService.getTournament(game.tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      // Validate date is within tournament range
      if (date < tournament.startDate || date > tournament.endDate) {
        return res.status(400).json({ 
          error: `Game date must be between ${tournament.startDate} and ${tournament.endDate}` 
        });
      }

      // Verify diamond exists and belongs to tournament's organization
      const diamonds = await diamondService.getDiamonds(tournament.organizationId);
      const targetDiamond = diamonds.find(d => d.id === diamondId);
      if (!targetDiamond) {
        return res.status(400).json({ error: "Invalid diamond for this tournament" });
      }

      // Check diamond availability hours
      const [hours, minutes] = time.split(':').map(Number);
      const timeMinutes = hours * 60 + minutes;
      const [startHours, startMinutes] = targetDiamond.availableStartTime.split(':').map(Number);
      const startTimeMinutes = startHours * 60 + startMinutes;
      const [endHours, endMinutes] = targetDiamond.availableEndTime.split(':').map(Number);
      const endTimeMinutes = endHours * 60 + endMinutes;
      const gameDuration = game.durationMinutes || 90;
      const gameEndMinutes = timeMinutes + gameDuration;

      if (timeMinutes < startTimeMinutes || gameEndMinutes > endTimeMinutes) {
        return res.status(400).json({ 
          error: `${targetDiamond.name} is not available at ${time}. Operating hours: ${targetDiamond.availableStartTime} - ${targetDiamond.availableEndTime}` 
        });
      }

      // Get all games from the tournament to check for conflicts
      const tournamentGames = await gameService.getGames(game.tournamentId);
      
      // Filter games on the same date, excluding the game being moved
      const gamesOnSameDate = tournamentGames.filter(g => 
        g.id !== gameId && g.date === date
      );

      // Use timeMinutes and gameEndMinutes already calculated above for availability check
      const gameStartMinutes = timeMinutes;

      // Check for diamond conflicts
      for (const otherGame of gamesOnSameDate) {
        if (otherGame.diamondId === diamondId) {
          const [otherHours, otherMinutes] = otherGame.time.split(':').map(Number);
          const otherStartMinutes = otherHours * 60 + otherMinutes;
          const otherEndMinutes = otherStartMinutes + (otherGame.durationMinutes || 90);

          // Check for overlap: gameEnd > otherStart AND gameStart < otherEnd
          if (gameEndMinutes > otherStartMinutes && gameStartMinutes < otherEndMinutes) {
            return res.status(409).json({ 
              error: `Game would overlap with another game on ${targetDiamond.name}` 
            });
          }
        }
      }

      // Check for team conflicts
      for (const otherGame of gamesOnSameDate) {
        const hasTeamConflict = 
          otherGame.homeTeamId === game.homeTeamId ||
          otherGame.awayTeamId === game.homeTeamId ||
          otherGame.homeTeamId === game.awayTeamId ||
          otherGame.awayTeamId === game.awayTeamId;

        if (hasTeamConflict) {
          const [otherHours, otherMinutes] = otherGame.time.split(':').map(Number);
          const otherStartMinutes = otherHours * 60 + otherMinutes;
          const otherEndMinutes = otherStartMinutes + (otherGame.durationMinutes || 90);

          // Check for overlap
          if (gameEndMinutes > otherStartMinutes && gameStartMinutes < otherEndMinutes) {
            return res.status(409).json({ 
              error: "One or more teams already has a game that overlaps with this time slot" 
            });
          }
        }
      }

      // All validations passed - update the game
      const updatedGame = await gameService.updateGame(gameId, {
        date,
        time,
        diamondId
      });

      res.json(updatedGame);
    } catch (error) {
      console.error("Error moving game:", error);
      res.status(500).json({ error: "Failed to move game" });
    }
  });

  // Generate unplaced matchups (team pairings only, no time/diamond assignments)
  app.post("/api/tournaments/:tournamentId/generate-matchups", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      const { divisionId } = req.body;
      
      // Get tournament details
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      if (tournament.type !== 'pool_play') {
        return res.status(400).json({ error: "Matchup generation is only available for pool play tournaments" });
      }
      
      // Get all pools and teams for this tournament
      const allPools = await tournamentService.getPools(tournamentId);
      const allTeams = await teamService.getTeams(tournamentId);
      
      // Filter pools by division if divisionId is provided
      const pools = divisionId 
        ? allPools.filter(p => p.ageDivisionId === divisionId)
        : allPools;
      
      // DELETE EXISTING GAMES for this tournament/division before generating new matchups
      // This makes "Generate Schedule" a true reset button
      const allGames = await gameService.getGames(tournamentId);
      const poolIds = new Set(pools.map(p => p.id));
      const gamesToDelete = divisionId 
        ? allGames.filter(g => poolIds.has(g.poolId) && !g.isPlayoff)
        : allGames.filter(g => !g.isPlayoff);
      
      for (const game of gamesToDelete) {
        await gameService.deleteGame(game.id);
      }
      
      console.log(`Deleted ${gamesToDelete.length} existing pool play games before generating new matchups`);
      
      // Organize teams by pool
      const poolsWithTeams = pools.map(pool => ({
        id: pool.id,
        name: pool.name,
        teamIds: allTeams.filter(team => team.poolId === pool.id).map(team => team.id)
      }));
      
      // Generate matchups without time/diamond assignments
      const matchupResult = generateUnplacedMatchups(poolsWithTeams, {
        tournamentId,
        minGameGuarantee: tournament.minGameGuarantee || undefined,
      });
      
      console.log('Generated matchups:', matchupResult.metadata);
      
      // Save matchups to database (replace existing matchups for each pool)
      const savedMatchups: any[] = [];
      for (const pool of pools) {
        const poolMatchups = matchupResult.matchups.filter(m => m.poolId === pool.id);
        const saved = await tournamentService.replaceMatchups(tournamentId, pool.id, poolMatchups);
        savedMatchups.push(...saved);
      }
      
      console.log(`Saved ${savedMatchups.length} matchups to database`);
      
      // Return both matchups and pools for atomic cache update on frontend
      res.status(200).json({
        message: `Generated ${matchupResult.metadata.totalMatchups} unplaced matchups`,
        matchups: savedMatchups,
        pools: pools, // Include pools to enable atomic cache synchronization
        metadata: matchupResult.metadata
      });
    } catch (error: any) {
      console.error("Error generating matchups:", error);
      res.status(500).json({ error: "Failed to generate matchups" });
    }
  });

  // Generate pool play schedule (draft - not saved to database)
  app.post("/api/tournaments/:tournamentId/generate-schedule", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      const { divisionId } = req.body;
      
      // Get tournament details
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      if (tournament.type !== 'pool_play') {
        return res.status(400).json({ error: "Schedule generation is only available for pool play tournaments" });
      }
      
      // Get all pools and teams for this tournament
      const allPools = await tournamentService.getPools(tournamentId);
      const allTeams = await teamService.getTeams(tournamentId);
      
      // Filter pools by division if divisionId is provided
      const pools = divisionId 
        ? allPools.filter(p => p.ageDivisionId === divisionId)
        : allPools;
      
      console.log('Schedule generation debug:', {
        divisionId,
        allPoolsCount: allPools.length,
        filteredPoolsCount: pools.length,
        allTeamsCount: allTeams.length
      });
      
      // Organize teams by pool
      const poolsWithTeams = pools.map(pool => ({
        id: pool.id,
        name: pool.name,
        teamIds: allTeams.filter(team => team.poolId === pool.id).map(team => team.id)
      }));
      
      console.log('Pools with teams:', poolsWithTeams.map(p => ({ 
        name: p.name, 
        teamCount: p.teamIds.length 
      })));
      
      // Validate game guarantee if specified
      if (tournament.minGameGuarantee && tournament.numberOfDiamonds) {
        const startDate = new Date(tournament.startDate);
        const endDate = new Date(tournament.endDate);
        const tournamentDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        // Validate for the largest pool (worst case)
        const largestPoolSize = Math.max(...poolsWithTeams.map(p => p.teamIds.length));
        const validation = validateGameGuarantee(
          largestPoolSize,
          tournament.minGameGuarantee,
          tournamentDays,
          tournament.numberOfDiamonds
        );
        
        if (!validation.valid) {
          return res.status(400).json({ error: validation.message });
        }
      }
      
      console.log('Schedule generation config:', {
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        minGameGuarantee: tournament.minGameGuarantee,
        numberOfDiamonds: tournament.numberOfDiamonds,
        hasDiamondDetails: !!tournament.diamondDetails
      });
      
      // Fetch diamonds if selectedDiamondIds is set
      let diamonds = undefined;
      if (tournament.selectedDiamondIds && tournament.selectedDiamondIds.length > 0) {
        diamonds = [];
        for (const diamondId of tournament.selectedDiamondIds) {
          const diamond = await diamondService.getDiamond(diamondId);
          if (diamond) {
            diamonds.push(diamond);
          }
        }
      }

      // Generate the schedule (draft only - not saved)
      const scheduleResult = generatePoolPlaySchedule(poolsWithTeams, {
        tournamentId,
        startDate: tournament.startDate,
        endDate: tournament.endDate,
        minGameGuarantee: tournament.minGameGuarantee || undefined,
        numberOfDiamonds: tournament.numberOfDiamonds || undefined,
        diamondDetails: tournament.diamondDetails ? tournament.diamondDetails as Array<{ venue: string; subVenue?: string }> : undefined,
        diamonds: diamonds,
        minRestMinutes: tournament.minRestMinutes,
        restBetween2nd3rdGame: tournament.restBetween2nd3rdGame,
        maxGamesPerDay: tournament.maxGamesPerDay,
      });
      
      console.log('Generated games count:', scheduleResult.games.length);
      console.log('Violations count:', scheduleResult.violations.length);
      
      // Return draft games and violations without saving to database
      res.status(200).json({
        message: `Generated draft schedule with ${scheduleResult.games.length} pool play games`,
        gamesCount: scheduleResult.games.length,
        violationsCount: scheduleResult.violations.length,
        draftGames: scheduleResult.games,
        violations: scheduleResult.violations
      });
    } catch (error: any) {
      console.error("Error generating schedule:", error);
      
      // If it's a capacity/scheduling error, return 400
      if (error.message && (
        error.message.includes('Cannot schedule all games') ||
        error.message.includes('Cannot guarantee')
      )) {
        return res.status(400).json({ error: error.message });
      }
      
      // For other errors, return 500
      res.status(500).json({ error: "Failed to generate schedule" });
    }
  });

  // Commit draft schedule to database
  app.post("/api/tournaments/:tournamentId/commit-schedule", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      const { draftGames } = req.body;
      
      if (!draftGames || !Array.isArray(draftGames) || draftGames.length === 0) {
        return res.status(400).json({ error: "Draft games are required" });
      }
      
      // Verify tournament exists
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Get valid pools for this tournament to verify games belong to correct tournament
      const validPools = await tournamentService.getPools(tournamentId);
      const validPoolIds = new Set(validPools.map(p => p.id));
      
      // Get valid teams for this tournament
      const validTeams = await teamService.getTeams(tournamentId);
      const validTeamIds = new Set(validTeams.map(t => t.id));
      
      // Fetch diamonds if tournament uses them
      let diamonds = undefined;
      if (tournament.selectedDiamondIds && tournament.selectedDiamondIds.length > 0) {
        diamonds = [];
        for (const diamondId of tournament.selectedDiamondIds) {
          const diamond = await diamondService.getDiamond(diamondId);
          if (diamond) {
            diamonds.push(diamond);
          }
        }
      }
      
      // Re-validate constraints server-side
      // This prevents bypassing frontend validation via direct API calls
      const constraintErrors: string[] = [];
      
      if (diamonds && diamonds.length > 0) {
        // Track team game counts per day for validation
        const teamGamesPerDay = new Map<string, Map<string, number>>();
        const teamGameTimes = new Map<string, Array<{ date: string; time: string; gameNumber: number }>>();
        
        for (let i = 0; i < draftGames.length; i++) {
          const game = draftGames[i];
          const gameDate = game.date;
          const gameTime = game.time;
          
          // Check diamond assignment if diamondId is present
          if (game.diamondId) {
            const diamond = diamonds.find(d => d.id === game.diamondId);
            if (!diamond) {
              constraintErrors.push(`Game ${i + 1}: Invalid diamond assignment`);
            } else {
              // Validate diamond availability hours
              const parseTime = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
              };
              
              const gameMinutes = parseTime(gameTime);
              const startMinutes = parseTime(diamond.availableStartTime);
              const endMinutes = parseTime(diamond.availableEndTime);
              
              if (gameMinutes < startMinutes || gameMinutes > endMinutes) {
                constraintErrors.push(
                  `Game ${i + 1}: Time ${gameTime} is outside diamond "${diamond.name}" available hours (${diamond.availableStartTime}-${diamond.availableEndTime})`
                );
              }
            }
          }
          
          // Track games per team per day
          for (const teamId of [game.homeTeamId, game.awayTeamId]) {
            if (!teamId) continue;
            
            if (!teamGamesPerDay.has(teamId)) {
              teamGamesPerDay.set(teamId, new Map());
              teamGameTimes.set(teamId, []);
            }
            
            const dayMap = teamGamesPerDay.get(teamId)!;
            const currentCount = dayMap.get(gameDate) || 0;
            dayMap.set(gameDate, currentCount + 1);
            
            // Check max games per day
            if (tournament.maxGamesPerDay && currentCount + 1 > tournament.maxGamesPerDay) {
              constraintErrors.push(
                `Game ${i + 1}: Team exceeds max ${tournament.maxGamesPerDay} games per day on ${gameDate}`
              );
            }
            
            // Track game times for rest period validation
            teamGameTimes.get(teamId)!.push({ 
              date: gameDate, 
              time: gameTime, 
              gameNumber: currentCount + 1 
            });
          }
        }
        
        // Validate rest periods between games
        for (const [teamId, games] of Array.from(teamGameTimes.entries())) {
          // Sort games by date and time
          games.sort((a: { date: string; time: string; gameNumber: number }, b: { date: string; time: string; gameNumber: number }) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return a.time.localeCompare(b.time);
          });
          
          for (let i = 1; i < games.length; i++) {
            const prevGame = games[i - 1];
            const currentGame = games[i];
            
            // Only check rest on same day
            if (prevGame.date === currentGame.date) {
              const parseTime = (t: string) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
              };
              
              const prevMinutes = parseTime(prevGame.time);
              const currentMinutes = parseTime(currentGame.time);
              const restMinutes = currentMinutes - prevMinutes;
              
              // Check special rest between 2nd and 3rd game
              if (currentGame.gameNumber === 3 && tournament.restBetween2nd3rdGame) {
                if (restMinutes < tournament.restBetween2nd3rdGame) {
                  constraintErrors.push(
                    `Team ${teamId}: Only ${restMinutes} minutes rest between 2nd and 3rd game (requires ${tournament.restBetween2nd3rdGame} minutes)`
                  );
                }
              }
              // Check minimum rest between any consecutive games
              else if (tournament.minRestMinutes && restMinutes < tournament.minRestMinutes) {
                constraintErrors.push(
                  `Team ${teamId}: Only ${restMinutes} minutes rest between games (requires ${tournament.minRestMinutes} minutes)`
                );
              }
            }
          }
        }
      }
      
      // If there are constraint errors, reject the commit
      if (constraintErrors.length > 0) {
        return res.status(400).json({ 
          error: "Schedule violates constraints",
          violations: constraintErrors
        });
      }
      
      // Validate each draft game before saving
      const validatedGames = [];
      for (let i = 0; i < draftGames.length; i++) {
        const game = draftGames[i];
        
        // Validate game belongs to this tournament
        if (game.tournamentId !== tournamentId) {
          return res.status(400).json({ 
            error: `Game ${i + 1} belongs to different tournament` 
          });
        }
        
        // Validate pool exists in this tournament
        if (!validPoolIds.has(game.poolId)) {
          return res.status(400).json({ 
            error: `Game ${i + 1} references invalid pool for this tournament` 
          });
        }
        
        // Validate teams exist in this tournament
        if (game.homeTeamId && !validTeamIds.has(game.homeTeamId)) {
          return res.status(400).json({ 
            error: `Game ${i + 1} references invalid home team` 
          });
        }
        if (game.awayTeamId && !validTeamIds.has(game.awayTeamId)) {
          return res.status(400).json({ 
            error: `Game ${i + 1} references invalid away team` 
          });
        }
        
        // Validate using schema and regenerate ID for security
        try {
          const validated = insertGameSchema.parse(game);
          // Regenerate ID on server to prevent ID spoofing/conflicts
          const safeGame = {
            ...validated,
            id: `${tournamentId}-pool-${game.poolId}-game-${nanoid(8)}`
          };
          validatedGames.push(safeGame);
        } catch (validationError: any) {
          return res.status(400).json({ 
            error: `Game ${i + 1} validation failed: ${validationError.message}` 
          });
        }
      }
      
      // Save all validated games to database
      const createdGames = [];
      for (const game of validatedGames) {
        const created = await gameService.createGame(game);
        createdGames.push(created);
      }
      
      res.status(201).json({
        message: `Successfully committed ${createdGames.length} pool play games`,
        gamesCreated: createdGames.length,
        games: createdGames
      });
    } catch (error: any) {
      console.error("Error committing schedule:", error);
      res.status(500).json({ error: "Failed to commit schedule" });
    }
  });

  // Place a single game (for drag-and-drop schedule builder)
  app.post("/api/games/place", requireAdmin, async (req, res) => {
    try {
      const { tournamentId, poolId, homeTeamId, awayTeamId, date, time, diamondId, matchupId, durationMinutes } = req.body;
      
      if (!tournamentId || !poolId || !homeTeamId || !awayTeamId || !date || !time) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      
      // Verify tournament exists
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Get all teams to validate
      const teams = await teamService.getTeams(tournamentId);
      const validTeamIds = new Set(teams.map(t => t.id));
      
      if (!validTeamIds.has(homeTeamId) || !validTeamIds.has(awayTeamId)) {
        return res.status(400).json({ error: "Invalid team ID" });
      }
      
      // Get diamond if specified
      let diamond = null;
      let location = '';
      let subVenue = '';
      
      if (diamondId) {
        diamond = await diamondService.getDiamond(diamondId);
        if (!diamond) {
          return res.status(400).json({ error: "Invalid diamond ID" });
        }
        location = diamond.location || diamond.name;
        subVenue = diamond.name;
        
        // Validate diamond hours
        const parseTime = (t: string) => {
          const [h, m] = t.split(':').map(Number);
          return h * 60 + m;
        };
        
        const gameMinutes = parseTime(time);
        const startMinutes = parseTime(diamond.availableStartTime);
        const endMinutes = parseTime(diamond.availableEndTime);
        
        if (gameMinutes < startMinutes || gameMinutes > endMinutes) {
          return res.status(400).json({ 
            error: `Time ${time} is outside diamond "${diamond.name}" available hours (${diamond.availableStartTime}-${diamond.availableEndTime})`
          });
        }
      }
      
      // Check for team conflicts at this time slot
      const allGames = await gameService.getGames(tournamentId);
      const gamesAtTime = allGames.filter(g => g.date === date && g.time === time);
      
      for (const game of gamesAtTime) {
        if (game.homeTeamId === homeTeamId || game.awayTeamId === homeTeamId ||
            game.homeTeamId === awayTeamId || game.awayTeamId === awayTeamId) {
          return res.status(400).json({ 
            error: "One or both teams are already scheduled at this time" 
          });
        }
        
        // Check diamond conflict
        if (diamondId && game.diamondId === diamondId) {
          return res.status(400).json({ 
            error: `Diamond "${diamond!.name}" is already in use at this time` 
          });
        }
      }
      
      // Check rest period constraints if configured
      if (tournament.minRestMinutes || tournament.maxGamesPerDay) {
        const gamesOnDate = allGames.filter(g => g.date === date);
        
        // Check for both teams
        for (const teamId of [homeTeamId, awayTeamId]) {
          const teamGames = gamesOnDate.filter(g => 
            g.homeTeamId === teamId || g.awayTeamId === teamId
          );
          
          // Check max games per day
          if (tournament.maxGamesPerDay && teamGames.length >= tournament.maxGamesPerDay) {
            const team = teams.find(t => t.id === teamId);
            return res.status(400).json({ 
              error: `Team "${team?.name}" already has ${tournament.maxGamesPerDay} games on ${date}` 
            });
          }
          
          // Check rest periods
          if (tournament.minRestMinutes) {
            const parseTime = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
            
            const gameTimeMinutes = parseTime(time);
            
            for (const existingGame of teamGames) {
              const existingTimeMinutes = parseTime(existingGame.time);
              const timeDiff = Math.abs(gameTimeMinutes - existingTimeMinutes);
              
              if (timeDiff < tournament.minRestMinutes) {
                const team = teams.find(t => t.id === teamId);
                return res.status(400).json({ 
                  error: `Team "${team?.name}" needs ${tournament.minRestMinutes} minutes rest between games (only ${timeDiff} minutes between ${existingGame.time} and ${time})` 
                });
              }
            }
          }
        }
      }
      
      // Create the game
      const gameId = `${tournamentId}-pool-${poolId}-game-${nanoid(8)}`;
      const gameData = {
        id: gameId,
        homeTeamId,
        awayTeamId,
        tournamentId,
        poolId,
        status: 'scheduled' as const,
        date,
        time,
        durationMinutes: durationMinutes || 90, // Default to 90 minutes (1.5 hours)
        location,
        subVenue,
        diamondId: diamondId || null,
        matchupId: matchupId || null,
        isPlayoff: false,
        forfeitStatus: 'none' as const,
        homeScore: null,
        awayScore: null
      };
      
      const createdGame = await gameService.createGame(gameData);
      
      res.status(201).json({
        message: "Game placed successfully",
        game: createdGame
      });
    } catch (error: any) {
      console.error("Error placing game:", error);
      res.status(500).json({ error: "Failed to place game" });
    }
  });

  // Auto-distribute teams across pools
  app.post("/api/tournaments/:tournamentId/auto-distribute-pools", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      const { numberOfPools, divisionId } = req.body;
      
      if (!numberOfPools || numberOfPools < 1) {
        return res.status(400).json({ error: "Number of pools must be at least 1" });
      }

      if (!divisionId) {
        return res.status(400).json({ error: "Division ID is required" });
      }
      
      // Get tournament
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      // Verify division exists
      const ageDivisions = await tournamentService.getAgeDivisions(tournamentId);
      const division = ageDivisions.find(d => d.id === divisionId);
      if (!division) {
        return res.status(404).json({ error: "Division not found" });
      }
      
      // Get all teams and pools
      const allTeams = await teamService.getTeams(tournamentId);
      const allPools = await tournamentService.getPools(tournamentId);

      // Filter teams for this division
      // Teams belong to a division if:
      // 1. Their division text field matches the ageDivision name, OR
      // 2. They're in a pool that belongs to this division
      const divisionPoolIds = allPools
        .filter(p => p.ageDivisionId === divisionId)
        .map(p => p.id);
      
      const teams = allTeams.filter(t => {
        // Match by division text field (primary method for newly imported teams)
        if (t.division === division.name) {
          return true;
        }
        // Match by pool assignment (for already distributed teams)
        if (t.poolId && divisionPoolIds.includes(t.poolId)) {
          return true;
        }
        return false;
      });
      
      if (teams.length === 0) {
        return res.status(400).json({ error: `No teams found for ${division.name} division. Make sure teams have the division field set to "${division.name}" when importing.` });
      }
      
      // Delete existing pools for THIS DIVISION only (non-temp first)
      const divisionPools = allPools.filter(p => p.ageDivisionId === divisionId);
      const nonTempPools = divisionPools.filter(p => !p.id.includes('_pool_temp_'));
      for (const pool of nonTempPools) {
        await tournamentService.deletePool(pool.id);
      }
      
      // Create new pools for this division
      const poolNames = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      const createdPools = [];
      for (let i = 0; i < numberOfPools; i++) {
        const pool = await tournamentService.createPool({
          id: `${tournamentId}-${divisionId}-pool-${poolNames[i].toLowerCase()}`,
          name: `Pool ${poolNames[i]}`,
          tournamentId,
          ageDivisionId: divisionId
        });
        createdPools.push(pool);
      }
      
      // Distribute teams evenly across pools (round-robin)
      const updatedTeams = [];
      for (let i = 0; i < teams.length; i++) {
        const poolIndex = i % numberOfPools;
        const team = teams[i];
        const updated = await teamService.updateTeam(team.id, {
          poolId: createdPools[poolIndex].id
        });
        updatedTeams.push(updated);
      }
      
      // Delete temporary pools for this division
      const tempPools = divisionPools.filter(p => p.id.includes('_pool_temp_'));
      for (const pool of tempPools) {
        await tournamentService.deletePool(pool.id);
      }
      
      res.status(200).json({
        message: `Successfully distributed ${teams.length} ${division.name} teams across ${numberOfPools} pools`,
        pools: createdPools,
        teams: updatedTeams
      });
    } catch (error: any) {
      console.error("Error auto-distributing teams:", error);
      res.status(500).json({ error: "Failed to auto-distribute teams" });
    }
  });

  // Validation report generation
  app.get("/api/tournaments/:tournamentId/validation-report", requireAdmin, async (req, res) => {
    try {
      const tournamentId = req.params.tournamentId;
      const reportType = (req.query.type as 'post-pool-play' | 'final-convenor') || 'post-pool-play';
      
      // Fetch all necessary data
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const allPools = await tournamentService.getPools(tournamentId);
      const teams = await teamService.getTeams(tournamentId);
      const games = await gameService.getGames(tournamentId);
      
      // Filter to get only REAL pools (exclude system pools like Playoff, Unassigned, temp)
      const pools = allPools.filter(pool => {
        const poolNameLower = pool.name.toLowerCase();
        return (
          !!pool.ageDivisionId && // Must be assigned to a division
          !poolNameLower.includes('unassigned') && 
          !poolNameLower.includes('playoff') &&
          !pool.id.includes('_pool_temp_')
        );
      });
      
      // Generate validation report
      const report = generateValidationReport(tournament, pools, teams, games, reportType);
      
      res.json(report);
    } catch (error) {
      console.error("Error generating validation report:", error);
      res.status(500).json({ error: "Failed to generate validation report" });
    }
  });

  // End of Pool Play standings report (division-scoped to ensure seeding parity)
  app.get("/api/tournaments/:tournamentId/standings-report", requireAdmin, async (req, res) => {
    try {
      const tournamentId = req.params.tournamentId;
      const divisionId = req.query.divisionId as string;
      
      if (!divisionId) {
        return res.status(400).json({ 
          error: "Division ID is required. Please specify divisionId query parameter." 
        });
      }
      
      // Fetch all necessary data
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      // Check for playoff configuration
      if (!tournament.playoffFormat || !tournament.seedingPattern) {
        return res.status(400).json({ 
          error: "Tournament playoff format or seeding pattern not configured. Please configure these settings first." 
        });
      }
      
      // Get the specified division
      const divisions = await tournamentService.getAgeDivisions(tournamentId);
      const division = divisions.find(d => d.id === divisionId);
      if (!division || division.tournamentId !== tournamentId) {
        return res.status(404).json({ 
          error: "Division not found or does not belong to this tournament" 
        });
      }
      
      // Get all pools in this division (same scoping as generatePlayoffBracket)
      const allPools = await tournamentService.getPools(tournamentId);
      const divisionPools = allPools.filter(p => p.ageDivisionId === division.id);
      const regularPools = divisionPools.filter(p => !p.name.toLowerCase().includes('playoff'));
      
      if (regularPools.length === 0) {
        return res.status(400).json({ 
          error: "No regular pools found for standings calculation" 
        });
      }
      
      // Get teams in this division
      const allTeams = await teamService.getTeams(tournamentId);
      const regularPoolIds = regularPools.map(p => p.id);
      const divisionTeams = allTeams.filter(t => regularPoolIds.includes(t.poolId));
      
      if (divisionTeams.length === 0) {
        return res.status(400).json({ 
          error: "No teams found in division" 
        });
      }
      
      // Get only completed pool play games for this division (same as generatePlayoffBracket)
      const allGames = await gameService.getGames(tournamentId);
      const teamIds = divisionTeams.map(t => t.id);
      const poolPlayGames = allGames.filter(g => 
        g.status === 'completed' &&
        g.isPlayoff === false && 
        teamIds.includes(g.homeTeamId) && teamIds.includes(g.awayTeamId)
      );
      
      // Step 1: Calculate standings within each pool using shared helper
      const poolStandingsData = regularPools.map(pool => {
        const poolTeams = divisionTeams.filter(t => t.poolId === pool.id);
        const poolTeamIds = poolTeams.map(t => t.id);
        
        // Filter games to only include those where BOTH teams are in this pool
        const poolGames = poolPlayGames.filter(g => 
          poolTeamIds.includes(g.homeTeamId) && poolTeamIds.includes(g.awayTeamId)
        );
        
        const standings = calculateStandingsWithTiebreaking(poolTeams, poolGames);
        return {
          pool,
          standings,
        };
      });
      
      // Step 2: Prepare standings for global seeding (pool-specific ranks)
      const standingsForSeeding = poolStandingsData.flatMap(({ pool, standings }) =>
        standings.map(s => ({
          teamId: s.teamId,
          rank: s.rank, // Pool-specific rank
          poolId: s.poolId,
          poolName: pool.name,
        }))
      );
      
      // Step 3: Get globally seeded teams using actual playoff seeding logic
      // Pass the count of non-playoff division pools (EXACTLY as generatePlayoffBracket does)
      const seededTeams = getPlayoffTeamsFromStandings(
        standingsForSeeding,
        tournament.playoffFormat,
        tournament.seedingPattern as any,
        divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).length
      );
      
      if (seededTeams.length === 0) {
        return res.status(400).json({ 
          error: "No playoff teams could be determined from current standings" 
        });
      }
      
      // Step 4: Build lookup map for efficient stat retrieval
      const statsMap = new Map();
      poolStandingsData.forEach(({ standings }) => {
        standings.forEach(standing => {
          statsMap.set(standing.teamId, standing);
        });
      });
      
      // Step 5: Enrich seeded teams with full stats and format for display
      const standingsReport = seededTeams.map((seededTeam) => {
        const stats = statsMap.get(seededTeam.teamId);
        if (!stats) {
          console.warn(`No stats found for team ${seededTeam.teamId}`);
          return null;
        }
        
        return {
          rank: seededTeam.seed, // Global playoff seed
          teamName: stats.teamName,
          poolName: seededTeam.poolName || stats.poolId,
          poolRank: seededTeam.poolRank || stats.rank,
          record: `${stats.wins}-${stats.losses}-${stats.ties}`,
          points: stats.points,
          runsFor: stats.runsFor,
          runsAgainst: stats.runsAgainst,
          runDifferential: stats.runsFor - stats.runsAgainst,
          tieBreaker_RunsAgainstPerInning: stats.defensiveInnings > 0 
            ? (stats.runsAgainst / stats.defensiveInnings).toFixed(2) 
            : 'N/A',
          offensiveInnings: stats.offensiveInnings,
          defensiveInnings: stats.defensiveInnings,
        };
      }).filter(Boolean); // Remove any null entries
      
      res.json(standingsReport);
    } catch (error) {
      console.error("Error generating standings report:", error);
      res.status(500).json({ error: "Failed to generate standings report" });
    }
  });

  // Playoff bracket generation
  app.post("/api/tournaments/:tournamentId/divisions/:divisionId/generate-bracket", requireAdmin, async (req, res) => {
    try {
      const { tournamentId, divisionId } = req.params;
      const games = await playoffService.generatePlayoffBracket(tournamentId, divisionId);
      res.status(201).json({ 
        message: `Generated ${games.length} playoff games`, 
        games 
      });
    } catch (error) {
      console.error("Error generating playoff bracket:", error);
      res.status(400).json({ error: (error as any).message || "Failed to generate playoff bracket" });
    }
  });

  // Bulk operations for data import
  app.post("/api/tournaments/:tournamentId/bulk-import", requireAdmin, async (req, res) => {
    try {
      const { ageDivisions, pools, teams, games } = req.body;
      const tournamentId = req.params.tournamentId;

      // Clear existing games only (preserve teams from registration import)
      await tournamentService.clearTournamentData(tournamentId);

      // Get existing divisions and pools to avoid duplicates
      const existingDivisions = await tournamentService.getAgeDivisions(tournamentId);
      const existingPools = await tournamentService.getPools(tournamentId);
      
      // Create or reuse divisions
      const createdAgeDivisions = await Promise.all(
        ageDivisions.map(async (div: any) => {
          const existing = existingDivisions.find(d => d.id === div.id);
          if (existing) {
            return existing;
          }
          const newDivision = await tournamentService.createAgeDivision({ ...div, tournamentId });
          // Auto-create pools for new divisions
          await autoCreatePoolsForDivision(tournamentId, newDivision.id);
          return newDivision;
        })
      );

      // Create or reuse pools
      const createdPools = await Promise.all(
        pools.map(async (pool: any) => {
          const existing = existingPools.find(p => p.id === pool.id);
          if (existing) {
            return existing;
          }
          return tournamentService.createPool({ ...pool, tournamentId });
        })
      );

      // Update existing teams with new pool assignments
      const createdTeams = await teamService.bulkCreateTeams(
        teams.map((team: any) => ({ ...team, tournamentId }))
      );

      const createdGames = await gameService.bulkCreateGames(
        games.map((game: any) => ({ ...game, tournamentId }))
      );

      res.status(201).json({
        ageDivisions: createdAgeDivisions,
        pools: createdPools,
        teams: createdTeams,
        games: createdGames
      });
    } catch (error) {
      console.error("Error bulk importing data:", error);
      res.status(400).json({ error: "Failed to import data" });
    }
  });

  // Import teams from Registrations CSV
  app.post("/api/tournaments/:tournamentId/import-registrations", requireAdmin, async (req, res) => {
    try {
      const { teams } = req.body;
      const tournamentId = req.params.tournamentId;

      // Verify tournament exists
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      // Import teams - they will be associated with pools later when Matches CSV is imported
      const createdTeams = await teamService.bulkCreateOrUpdateTeamsFromRegistrations(
        teams.map((team: any) => ({ ...team, tournamentId }))
      );

      res.status(201).json({
        teams: createdTeams,
        message: `Successfully imported ${createdTeams.length} teams`
      });
    } catch (error) {
      console.error("Error importing registrations:", error);
      res.status(400).json({ error: "Failed to import registrations data" });
    }
  });

  // OBA Roster API Routes - Enhanced team search with improved scraping
  app.get("/api/roster/teams/search", async (req, res) => {
    try {
      const { query } = req.query;
      
      if (!query || typeof query !== 'string' || query.trim().length < 2) {
        return res.json({ success: false, error: "Please provide a search term with at least 2 characters" });
      }

      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "search", query.toString()], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse search results:", parseError);
            res.status(500).json({ success: false, error: "Invalid search response format" });
          }
        } else {
          console.error("Python script error:", error);
          res.status(500).json({ success: false, error: "Failed to search teams" });
        }
      });
    } catch (error) {
      console.error("Roster search error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Team discovery endpoint - discover new teams by scanning ID ranges
  app.post("/api/roster/teams/discover", requireAdmin, async (req, res) => {
    try {
      const { startId, endId } = req.body;
      
      if (!startId || !endId) {
        return res.status(400).json({ success: false, error: "Start ID and End ID are required" });
      }

      if (endId - startId > 100) {
        return res.status(400).json({ success: false, error: "Range too large. Maximum 100 teams per discovery" });
      }

      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "discover", startId.toString(), endId.toString()], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse discovery results:", parseError);
            res.status(500).json({ success: false, error: "Invalid discovery response format" });
          }
        } else {
          console.error("Python discovery script error:", error);
          res.status(500).json({ success: false, error: "Failed to discover teams" });
        }
      });
    } catch (error) {
      console.error("Team discovery error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Get all cached teams endpoint
  app.get("/api/roster/teams/cached", async (req, res) => {
    try {
      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "list"], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse cached teams:", parseError);
            res.status(500).json({ success: false, error: "Invalid cached teams response format" });
          }
        } else {
          console.error("Python cached teams script error:", error);
          res.status(500).json({ success: false, error: "Failed to get cached teams" });
        }
      });
    } catch (error) {
      console.error("Cached teams error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });
  
  app.get("/api/roster/teams/:teamId", async (req, res) => {
    try {
      const { teamId } = req.params;
      const { noCache } = req.query;
      const { spawn } = await import("child_process");
      
      const args = ["oba_roster_service.py", "roster", teamId];
      if (noCache === "true") args.push("--no-cache");
      
      const python = spawn("python", args, { cwd: "server" });
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            res.json(result);
          } catch (parseError) {
            console.error("Failed to parse roster data:", parseError);
            res.status(500).json({ success: false, error: "Invalid response format" });
          }
        } else {
          console.error("Python script error:", error);
          res.status(500).json({ success: false, error: "Failed to fetch roster" });
        }
      });
    } catch (error) {
      console.error("Roster fetch error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });
  
  app.post("/api/roster/teams/:teamId/import", isAuthenticated, async (req, res) => {
    try {
      const { teamId } = req.params;
      const { tournamentTeamId } = req.body;
      
      if (!tournamentTeamId) {
        return res.status(400).json({ success: false, error: "Tournament team ID required" });
      }
      
      // Fetch roster data
      const { spawn } = await import("child_process");
      const python = spawn("python", ["oba_roster_service.py", "roster", teamId], { cwd: "server" });
      
      let output = "";
      let error = "";
      
      python.stdout.on("data", (data) => {
        output += data.toString();
      });
      
      python.stderr.on("data", (data) => {
        error += data.toString();
      });
      
      python.on("close", async (code) => {
        if (code === 0) {
          try {
            const rosterData = JSON.parse(output);
            
            if (rosterData.success && rosterData.players) {
              // Update the tournament team with roster data
              await teamService.updateTeamRoster(tournamentTeamId, JSON.stringify(rosterData.players));
              
              res.json({ 
                success: true, 
                message: `Imported ${rosterData.players.length} players from ${rosterData.team_name}`,
                playerCount: rosterData.players.length
              });
            } else {
              res.status(400).json({ 
                success: false, 
                error: rosterData.error || "No roster data available" 
              });
            }
          } catch (parseError) {
            console.error("Failed to parse roster data:", parseError);
            res.status(500).json({ success: false, error: "Invalid response format" });
          }
        } else {
          console.error("Python script error:", error);
          res.status(500).json({ success: false, error: "Failed to fetch roster" });
        }
      });
    } catch (error) {
      console.error("Roster import error:", error);
      res.status(500).json({ success: false, error: "Internal server error" });
    }
  });

  // Populate test tournament data (admin only)
  app.post("/api/tournaments/:tournamentId/populate-test-data", requireAdmin, async (req, res) => {
    try {
      const { tournamentId } = req.params;
      
      // Get tournament configuration
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const numberOfTeams = tournament.numberOfTeams || 16;
      const numberOfPools = tournament.numberOfPools || 4;
      
      // Pool of Ontario city names
      const allCityNames = [
        "Chatham", "Leamington", "Sarnia", "Windsor", "Brantford", "Simcoe", 
        "St. Thomas", "Woodstock", "Welland", "Grimsby", "St. Catharines", 
        "Niagara Falls", "Orangeville", "Caledon", "Bolton", "Shelburne",
        "London", "Kitchener", "Cambridge", "Waterloo", "Guelph", "Barrie",
        "Oshawa", "Hamilton", "Kingston", "Peterborough", "Thunder Bay", "Sudbury"
      ];
      
      // Pick the right number of cities
      const selectedCities = allCityNames.slice(0, numberOfTeams);
      
      // Calculate teams per pool
      const teamsPerPool = Math.floor(numberOfTeams / numberOfPools);
      const extraTeams = numberOfTeams % numberOfPools;
      
      // Pool names (A, B, C, D, E, F, etc.)
      const poolNames = Array.from({ length: numberOfPools }, (_, i) => 
        String.fromCharCode(65 + i)
      );
      
      // Create age division
      const ageDivisionId = `${tournamentId}-11u`;
      await tournamentService.createAgeDivision({
        id: ageDivisionId,
        name: "11U",
        tournamentId
      });
      
      // Create pools and distribute teams
      const poolIds: Record<string, string> = {};
      const poolTeams: Record<string, string[]> = {};
      let cityIndex = 0;
      
      for (let i = 0; i < numberOfPools; i++) {
        const poolName = poolNames[i];
        const poolId = `${tournamentId}-pool-${poolName.toLowerCase()}`;
        
        await tournamentService.createPool({
          id: poolId,
          name: poolName,
          tournamentId,
          ageDivisionId
        });
        
        poolIds[poolName] = poolId;
        poolTeams[poolName] = [];
        
        // Add teams to this pool (some pools get 1 extra team if there's a remainder)
        const teamCount = teamsPerPool + (i < extraTeams ? 1 : 0);
        for (let j = 0; j < teamCount; j++) {
          const city = selectedCities[cityIndex];
          const teamId = `${tournamentId}-${city.toLowerCase().replace(/\s+/g, '-')}`;
          
          await teamService.createTeam({
            id: teamId,
            name: city,
            city,
            division: "11U",
            tournamentId,
            poolId: poolId
          });
          
          poolTeams[poolName].push(teamId);
          cityIndex++;
        }
      }
      
      // Generate round-robin games for each pool
      let gameNumber = 1;
      let totalPoolGames = 0;
      
      for (const [poolName, teamList] of Object.entries(poolTeams)) {
        const poolId = poolIds[poolName];
        
        // Round-robin: each team plays every other team once
        for (let i = 0; i < teamList.length; i++) {
          for (let j = i + 1; j < teamList.length; j++) {
            const homeTeamId = teamList[i];
            const awayTeamId = teamList[j];
            
            // Generate randomized but realistic scores
            const homeScore = Math.floor(Math.random() * 8) + 3; // 3-10
            const awayScore = Math.floor(Math.random() * 8) + 1; // 1-8
            
            await gameService.createGame({
              id: `${tournamentId}-game-${gameNumber}`,
              tournamentId,
              poolId: poolId,
              homeTeamId,
              awayTeamId,
              homeScore,
              awayScore,
              homeInningsBatted: homeScore > awayScore ? "6.0" : "6.0",
              awayInningsBatted: awayScore > homeScore ? "6.0" : "6.0",
              status: "completed",
              date: tournament.startDate || "2025-11-15",
              time: `${9 + Math.floor((gameNumber - 1) / 4)}:${((gameNumber - 1) % 4) * 15}0`,
              location: `Diamond ${((gameNumber - 1) % 4) + 1}`
            });
            
            gameNumber++;
            totalPoolGames++;
          }
        }
      }
      
      // Generate playoff bracket for the division
      const playoffGames = await playoffService.generatePlayoffBracket(tournamentId, ageDivisionId);
      
      res.json({
        success: true,
        message: "Test data populated successfully including playoff bracket",
        summary: {
          pools: numberOfPools,
          teams: numberOfTeams,
          poolPlayGames: totalPoolGames,
          playoffGames: playoffGames.length
        }
      });
    } catch (error) {
      console.error("Error populating test data:", error);
      res.status(500).json({ error: "Failed to populate test data" });
    }
  });

  // =============================================
  // FOREST GLADE BOOKING SYSTEM ROUTES
  // =============================================

  // House League Teams
  app.get('/api/organizations/:orgId/house-league-teams', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const teams = await diamondService.getHouseLeagueTeams(orgId);
      res.json(teams);
    } catch (error) {
      console.error("Error fetching house league teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  app.post('/api/organizations/:orgId/house-league-teams', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const team = await diamondService.createHouseLeagueTeam({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(team);
    } catch (error) {
      console.error("Error creating house league team:", error);
      res.status(400).json({ error: "Failed to create team" });
    }
  });

  app.patch('/api/organizations/:orgId/house-league-teams/:teamId', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, teamId } = req.params;
      const team = await diamondService.updateHouseLeagueTeam(teamId, req.body, orgId);
      res.json(team);
    } catch (error) {
      console.error("Error updating house league team:", error);
      res.status(400).json({ error: "Failed to update team" });
    }
  });

  app.delete('/api/organizations/:orgId/house-league-teams/:teamId', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, teamId } = req.params;
      await diamondService.deleteHouseLeagueTeam(teamId, orgId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting house league team:", error);
      res.status(500).json({ error: "Failed to delete team" });
    }
  });

  // Booking Requests
  app.get('/api/organizations/:orgId/booking-requests', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { status, teamId, startDate, endDate } = req.query;
      
      const requests = await diamondService.getBookingRequests(orgId, {
        status: status as string | undefined,
        teamId: teamId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      
      res.json(requests);
    } catch (error) {
      console.error("Error fetching booking requests:", error);
      res.status(500).json({ error: "Failed to fetch booking requests" });
    }
  });

  // Calendar view endpoint with populated team and diamond data
  app.get('/api/organizations/:orgId/booking-requests/calendar/:startDate/:endDate', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId, startDate, endDate } = req.params;
      
      const requests = await diamondService.getBookingRequests(orgId, {
        startDate,
        endDate,
      });
      
      // Populate team and diamond details for each request
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          const [team, diamond] = await Promise.all([
            diamondService.getHouseLeagueTeam(request.houseLeagueTeamId, orgId),
            request.diamondId ? diamondService.getDiamond(request.diamondId) : null,
          ]);
          
          return {
            ...request,
            team,
            diamond,
          };
        })
      );
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error("Error fetching calendar bookings:", error);
      res.status(500).json({ error: "Failed to fetch calendar bookings" });
    }
  });

  app.get('/api/organizations/:orgId/booking-requests/:requestId', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId, requestId } = req.params;
      const userId = req.user.claims.sub;
      const request = await diamondService.getBookingRequest(requestId, orgId);
      
      if (!request) {
        return res.status(404).json({ error: "Booking request not found" });
      }
      
      // Verify user owns this booking OR is an admin
      const dbUser = await userService.getUser(userId);
      const isOrgAdmin = dbUser?.isSuperAdmin || await organizationService.isOrganizationAdmin(userId, orgId);
      
      if (!isOrgAdmin && request.submittedBy !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Return rich response with team, diamond, and approvals
      const [team, diamond, approvals] = await Promise.all([
        diamondService.getHouseLeagueTeam(request.houseLeagueTeamId, orgId),
        diamondService.getDiamond(request.diamondId),
        diamondService.getBookingApprovals(requestId, orgId),
      ]);
      
      res.json({
        ...request,
        team,
        diamond,
        approvals,
      });
    } catch (error) {
      console.error("Error fetching booking request:", error);
      res.status(500).json({ error: "Failed to fetch booking request" });
    }
  });

  app.post('/api/organizations/:orgId/booking-requests', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const userId = req.user.claims.sub;
      
      // Validate diamond restrictions
      const team = await diamondService.getHouseLeagueTeam(req.body.houseLeagueTeamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      if (req.body.diamondId) {
        const isValid = await diamondService.validateDiamondRestriction(
          orgId,
          team.division,
          req.body.diamondId
        );
        
        if (!isValid) {
          return res.status(400).json({ 
            error: `${team.division} teams are not permitted to use this diamond due to size restrictions` 
          });
        }
      }
      
      const request = await diamondService.createBookingRequest({
        ...req.body,
        organizationId: orgId,
        submittedBy: userId,
        status: 'draft',
      });
      
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating booking request:", error);
      res.status(400).json({ error: "Failed to create booking request" });
    }
  });

  app.patch('/api/organizations/:orgId/booking-requests/:requestId', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId, requestId } = req.params;
      const request = await diamondService.updateBookingRequest(requestId, req.body, orgId);
      res.json(request);
    } catch (error) {
      console.error("Error updating booking request:", error);
      res.status(400).json({ error: "Failed to update booking request" });
    }
  });

  // Submit booking request (changes status from draft to submitted)
  app.post('/api/organizations/:orgId/booking-requests/:requestId/submit', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId, requestId } = req.params;
      const userId = req.user.claims.sub;
      
      const request = await diamondService.submitBookingRequest(requestId, userId, orgId);
      
      const coordinators = await organizationService.getOrganizationCoordinators(orgId, 'select_coordinator');
      const team = await diamondService.getHouseLeagueTeam(request.houseLeagueTeamId);
      const coach = await userService.getUser(userId);
      
      const { notificationService } = await import('./lib/notificationService');
      
      for (const coordinator of coordinators) {
        await notificationService.sendBookingSubmittedNotification({
          organizationId: orgId,
          bookingRequestId: requestId,
          coachName: coach?.email || 'Unknown',
          teamName: team?.name || 'Unknown Team',
          bookingType: request.bookingType,
          date: request.date,
          time: request.startTime,
          diamondName: request.requestedDiamondName || undefined,
          coordinatorEmail: coordinator.email || undefined,
          coordinatorPhone: coordinator.phone || undefined,
        }).catch(err => console.error('Error sending notification:', err));
      }
      
      res.json(request);
    } catch (error) {
      console.error("Error submitting booking request:", error);
      res.status(400).json({ error: "Failed to submit booking request" });
    }
  });

  // Approve/Decline booking request
  app.post('/api/organizations/:orgId/booking-requests/:requestId/approve', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, requestId } = req.params;
      const userId = req.user.claims.sub;
      const { approved, notes } = req.body;
      
      // Server-side validation: Get user's actual role from database
      const admins = await organizationService.getOrganizationAdmins(orgId);
      const userAdmin = admins.find(admin => admin.userId === userId);
      
      if (!userAdmin) {
        return res.status(403).json({ error: "User is not an admin of this organization" });
      }
      
      // Validate user has a coordinator role
      if (userAdmin.role !== 'select_coordinator' && userAdmin.role !== 'diamond_coordinator') {
        return res.status(403).json({ error: "User does not have coordinator permissions" });
      }
      
      const result = await diamondService.processBookingApproval(requestId, {
        approverId: userId,
        approverRole: userAdmin.role,
        decision: approved ? 'approved' : 'declined',
        notes,
      }, orgId);
      
      const request = result.request;
      const team = await diamondService.getHouseLeagueTeam(request.houseLeagueTeamId);
      const coach = await userService.getUser(request.submittedBy);
      const approver = await userService.getUser(userId);
      
      const { notificationService } = await import('./lib/notificationService');
      
      await notificationService.sendApprovalNotification({
        organizationId: orgId,
        bookingRequestId: requestId,
        approved: approved,
        recipientEmail: coach?.email || undefined,
        recipientPhone: coach?.phone || undefined,
        teamName: team?.name || 'Unknown Team',
        date: request.date,
        time: request.startTime,
        approverName: approver?.email || 'Coordinator',
        notes: notes || undefined,
      }).catch(err => console.error('Error sending notification:', err));
      
      if (approved && userAdmin.role === 'diamond_coordinator' && request.requiresUmpire) {
        const uicCoordinators = await organizationService.getOrganizationCoordinators(orgId, 'diamond_coordinator');
        
        for (const uic of uicCoordinators) {
          await notificationService.sendUICNotification({
            organizationId: orgId,
            bookingRequestId: requestId,
            uicEmail: uic.email || undefined,
            uicPhone: uic.phone || undefined,
            teamName: team?.name || 'Unknown Team',
            opponentName: request.opponentName || 'Unknown Opponent',
            date: request.date,
            time: request.startTime,
            diamondName: request.requestedDiamondName || undefined,
          }).catch(err => console.error('Error sending UIC notification:', err));
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error processing booking approval:", error);
      res.status(400).json({ error: "Failed to process approval" });
    }
  });

  // Cancel booking request
  app.post('/api/organizations/:orgId/booking-requests/:requestId/cancel', requireDiamondBooking, async (req: any, res) => {
    try {
      const { orgId, requestId } = req.params;
      const request = await diamondService.cancelBookingRequest(requestId, orgId);
      res.json(request);
    } catch (error) {
      console.error("Error cancelling booking request:", error);
      res.status(400).json({ error: "Failed to cancel booking request" });
    }
  });

  // Booking Reports - Diamond Utilization
  app.get('/api/organizations/:orgId/reports/diamond-utilization', isAuthenticated, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { startDate, endDate } = req.query;
      
      const bookings = await diamondService.getBookingRequests(orgId, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      
      const diamonds = await diamondService.getDiamonds(orgId);
      
      const utilizationMap = new Map();
      
      for (const diamond of diamonds) {
        utilizationMap.set(diamond.id, {
          diamondId: diamond.id,
          diamondName: diamond.name,
          totalBookings: 0,
          totalHours: 0,
          confirmedBookings: 0,
          confirmedHours: 0,
          peakHours: [],
        });
      }
      
      for (const booking of bookings) {
        if (!booking.diamondId) continue;
        
        const util = utilizationMap.get(booking.diamondId);
        if (!util) continue;
        
        const duration = booking.durationMinutes / 60;
        util.totalBookings++;
        util.totalHours += duration;
        
        if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
          util.confirmedBookings++;
          util.confirmedHours += duration;
        }
      }
      
      res.json(Array.from(utilizationMap.values()));
    } catch (error) {
      console.error("Error fetching diamond utilization:", error);
      res.status(500).json({ error: "Failed to fetch diamond utilization" });
    }
  });

  // Booking Reports - Division Statistics
  app.get('/api/organizations/:orgId/reports/division-stats', isAuthenticated, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { startDate, endDate } = req.query;
      
      const bookings = await diamondService.getBookingRequests(orgId, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      
      const teams = await diamondService.getHouseLeagueTeams(orgId);
      const teamMap = new Map(teams.map(t => [t.id, t]));
      
      const divisionMap = new Map();
      
      for (const booking of bookings) {
        const team = teamMap.get(booking.houseLeagueTeamId);
        if (!team) continue;
        
        const division = team.division;
        if (!divisionMap.has(division)) {
          divisionMap.set(division, {
            division,
            totalRequests: 0,
            confirmedRequests: 0,
            declinedRequests: 0,
            pendingRequests: 0,
            totalHours: 0,
            averageBookingHours: 0,
          });
        }
        
        const stats = divisionMap.get(division);
        stats.totalRequests++;
        stats.totalHours += booking.durationMinutes / 60;
        
        if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
          stats.confirmedRequests++;
        } else if (booking.status === 'declined') {
          stats.declinedRequests++;
        } else if (booking.status === 'submitted' || booking.status === 'select_coordinator_approved') {
          stats.pendingRequests++;
        }
      }
      
      const result = Array.from(divisionMap.values()).map(stats => ({
        ...stats,
        averageBookingHours: stats.totalRequests > 0 ? stats.totalHours / stats.totalRequests : 0,
      }));
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching division stats:", error);
      res.status(500).json({ error: "Failed to fetch division stats" });
    }
  });

  // Booking Reports - Approval Metrics
  app.get('/api/organizations/:orgId/reports/approval-metrics', isAuthenticated, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { startDate, endDate } = req.query;
      
      const bookings = await diamondService.getBookingRequests(orgId, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      });
      
      let totalRequests = bookings.length;
      let confirmedCount = 0;
      let declinedCount = 0;
      let pendingCount = 0;
      let cancelledCount = 0;
      let totalApprovalTimeMs = 0;
      let approvedRequestsWithTime = 0;
      let selectCoordinatorApprovals = 0;
      let diamondCoordinatorApprovals = 0;
      
      for (const booking of bookings) {
        if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
          confirmedCount++;
          
          if (booking.submittedAt && booking.confirmedAt) {
            const submitted = new Date(booking.submittedAt).getTime();
            const confirmed = new Date(booking.confirmedAt).getTime();
            totalApprovalTimeMs += (confirmed - submitted);
            approvedRequestsWithTime++;
          }
        } else if (booking.status === 'declined') {
          declinedCount++;
        } else if (booking.status === 'submitted' || booking.status === 'select_coordinator_approved') {
          pendingCount++;
          
          if (booking.status === 'select_coordinator_approved') {
            selectCoordinatorApprovals++;
          }
        } else if (booking.status === 'cancelled') {
          cancelledCount++;
        }
        
        if (booking.status === 'diamond_coordinator_approved' || booking.status === 'confirmed') {
          diamondCoordinatorApprovals++;
        }
      }
      
      const averageApprovalTimeHours = approvedRequestsWithTime > 0
        ? (totalApprovalTimeMs / approvedRequestsWithTime) / (1000 * 60 * 60)
        : 0;
      
      const approvalRate = totalRequests > 0 ? confirmedCount / totalRequests : 0;
      
      res.json({
        totalRequests,
        confirmedCount,
        declinedCount,
        pendingCount,
        cancelledCount,
        averageApprovalTimeHours,
        approvalRate,
        selectCoordinatorApprovals,
        diamondCoordinatorApprovals,
      });
    } catch (error) {
      console.error("Error fetching approval metrics:", error);
      res.status(500).json({ error: "Failed to fetch approval metrics" });
    }
  });

  // Diamond Restrictions
  app.get('/api/organizations/:orgId/diamond-restrictions', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const restrictions = await diamondService.getDiamondRestrictions(orgId);
      res.json(restrictions);
    } catch (error) {
      console.error("Error fetching diamond restrictions:", error);
      res.status(500).json({ error: "Failed to fetch restrictions" });
    }
  });

  app.post('/api/organizations/:orgId/diamond-restrictions', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const restriction = await diamondService.createDiamondRestriction({
        ...req.body,
        organizationId: orgId,
      });
      res.status(201).json(restriction);
    } catch (error) {
      console.error("Error creating diamond restriction:", error);
      res.status(400).json({ error: "Failed to create restriction" });
    }
  });

  app.patch('/api/organizations/:orgId/diamond-restrictions/:restrictionId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { restrictionId } = req.params;
      const restriction = await diamondService.updateDiamondRestriction(restrictionId, req.body);
      res.json(restriction);
    } catch (error) {
      console.error("Error updating diamond restriction:", error);
      res.status(400).json({ error: "Failed to update restriction" });
    }
  });

  app.delete('/api/organizations/:orgId/diamond-restrictions/:restrictionId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { restrictionId } = req.params;
      await diamondService.deleteDiamondRestriction(restrictionId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting diamond restriction:", error);
      res.status(500).json({ error: "Failed to delete restriction" });
    }
  });

  // Calendar Subscription Endpoints (Public - no auth required)
  app.get('/api/calendar/team/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const team = await diamondService.getHouseLeagueTeamByToken(token);
      if (!team) {
        return res.status(404).send('Calendar not found');
      }
      
      const org = await organizationService.getOrganization(team.organizationId);
      if (!org) {
        return res.status(404).send('Organization not found');
      }
      
      const bookings = await diamondService.getBookingRequests(team.organizationId, {
        teamId: team.id,
        status: 'confirmed',
      });
      
      const timezone = org.timezone || 'America/Toronto';
      
      const events: CalendarEvent[] = bookings.map(booking => {
        const startDateTime = fromZonedTime(`${booking.date} ${booking.startTime}`, timezone);
        const endDateTime = fromZonedTime(`${booking.date} ${booking.endTime}`, timezone);
        
        let summary = `${booking.bookingType.toUpperCase()}: ${team.name}`;
        if (booking.opponentName) {
          summary += ` vs ${booking.opponentName}`;
        }
        
        let description = `${booking.bookingType} for ${team.name}`;
        if (booking.notes) {
          description += `\n\nNotes: ${booking.notes}`;
        }
        
        const location = booking.requestedDiamondName || 'TBD';
        
        return {
          id: booking.id,
          summary,
          description,
          location,
          startDateTime,
          endDateTime,
          status: booking.status,
        };
      });
      
      const icsContent = generateICSFile(
        events,
        org.timezone || 'America/Toronto',
        `${team.name} - ${team.division}`
      );
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${team.name.replace(/\s+/g, '-')}-calendar.ics"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating team calendar:", error);
      res.status(500).send('Error generating calendar');
    }
  });

  app.get('/api/calendar/organization/:token', async (req, res) => {
    try {
      const { token } = req.params;
      
      const org = await organizationService.getOrganizationByToken(token);
      if (!org) {
        return res.status(404).send('Calendar not found');
      }
      
      const bookings = await diamondService.getBookingRequests(org.id, {
        status: 'confirmed',
      });
      
      const teams = await diamondService.getHouseLeagueTeams(org.id);
      const teamsMap = new Map(teams.map(t => [t.id, t]));
      const timezone = org.timezone || 'America/Toronto';
      
      const events: CalendarEvent[] = bookings.map(booking => {
        const startDateTime = fromZonedTime(`${booking.date} ${booking.startTime}`, timezone);
        const endDateTime = fromZonedTime(`${booking.date} ${booking.endTime}`, timezone);
        
        const team = teamsMap.get(booking.houseLeagueTeamId);
        const teamName = team?.name || 'Unknown Team';
        
        let summary = `${booking.bookingType.toUpperCase()}: ${teamName}`;
        if (booking.opponentName) {
          summary += ` vs ${booking.opponentName}`;
        }
        
        let description = `${booking.bookingType} for ${teamName}`;
        if (booking.notes) {
          description += `\n\nNotes: ${booking.notes}`;
        }
        
        const location = booking.requestedDiamondName || 'TBD';
        
        return {
          id: booking.id,
          summary,
          description,
          location,
          startDateTime,
          endDateTime,
          status: booking.status,
        };
      });
      
      const icsContent = generateICSFile(
        events,
        org.timezone || 'America/Toronto',
        `${org.name} - All Bookings`
      );
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${org.name.replace(/\s+/g, '-')}-calendar.ics"`);
      res.send(icsContent);
    } catch (error) {
      console.error("Error generating organization calendar:", error);
      res.status(500).send('Error generating calendar');
    }
  });

  // Token Generation Endpoints (Admin only)
  app.post('/api/organizations/:orgId/house-league-teams/:teamId/generate-calendar-token', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, teamId } = req.params;
      const token = nanoid(32);
      
      const team = await diamondService.updateHouseLeagueTeam(teamId, { calendarSubscriptionToken: token }, orgId);
      
      res.json({ token: team.calendarSubscriptionToken });
    } catch (error) {
      console.error("Error generating team calendar token:", error);
      res.status(500).json({ error: "Failed to generate calendar token" });
    }
  });

  app.post('/api/organizations/:orgId/generate-calendar-token', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const token = nanoid(32);
      
      const org = await organizationService.updateOrganization(orgId, { calendarSubscriptionToken: token });
      
      res.json({ token: org.calendarSubscriptionToken });
    } catch (error) {
      console.error("Error generating organization calendar token:", error);
      res.status(500).json({ error: "Failed to generate calendar token" });
    }
  });

  // iCal Feed Management (Admin only)
  app.get('/api/organizations/:orgId/ical-feeds', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const feeds = await diamondService.getOrganizationIcalFeeds(orgId);
      res.json(feeds);
    } catch (error) {
      console.error("Error fetching iCal feeds:", error);
      res.status(500).json({ error: "Failed to fetch iCal feeds" });
    }
  });

  app.post('/api/organizations/:orgId/ical-feeds', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { name, url, diamondMapping } = req.body;
      
      if (!name || !url) {
        return res.status(400).json({ error: "Name and URL are required" });
      }
      
      const feed = await diamondService.createOrganizationIcalFeed({
        id: nanoid(),
        organizationId: orgId,
        name,
        url,
        diamondMapping: diamondMapping || null,
        lastSyncedAt: null,
        lastSyncError: null,
      });
      
      res.status(201).json(feed);
    } catch (error) {
      console.error("Error creating iCal feed:", error);
      res.status(500).json({ error: "Failed to create iCal feed" });
    }
  });

  app.put('/api/organizations/:orgId/ical-feeds/:feedId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, feedId } = req.params;
      const { name, url, diamondMapping } = req.body;
      
      const feed = await diamondService.updateOrganizationIcalFeed(feedId, {
        name,
        url,
        diamondMapping: diamondMapping || null,
      }, orgId);
      
      res.json(feed);
    } catch (error) {
      console.error("Error updating iCal feed:", error);
      res.status(500).json({ error: "Failed to update iCal feed" });
    }
  });

  app.delete('/api/organizations/:orgId/ical-feeds/:feedId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, feedId } = req.params;
      
      await diamondService.deleteExternalCalendarEventsByFeed(feedId);
      await diamondService.deleteOrganizationIcalFeed(feedId, orgId);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting iCal feed:", error);
      res.status(500).json({ error: "Failed to delete iCal feed" });
    }
  });

  app.post('/api/organizations/:orgId/ical-feeds/:feedId/sync', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, feedId } = req.params;
      
      const org = await organizationService.getOrganization(orgId);
      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }
      
      const { syncSingleFeed } = await import('./services/calendar-sync');
      const result = await syncSingleFeed(feedId, orgId, org.timezone || 'America/Toronto');
      
      res.json(result);
    } catch (error) {
      console.error("Error syncing iCal feed:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to sync iCal feed" });
    }
  });

  // External Calendar Events (Read-only for now)
  app.get('/api/organizations/:orgId/external-events', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { icalFeedId, startDate, endDate, diamondId } = req.query;
      
      const events = await diamondService.getExternalCalendarEvents(orgId, {
        icalFeedId: icalFeedId as string | undefined,
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        diamondId: diamondId as string | undefined,
      });
      
      res.json(events);
    } catch (error) {
      console.error("Error fetching external events:", error);
      res.status(500).json({ error: "Failed to fetch external events" });
    }
  });

  // Tournament games for organization's diamonds (for calendar view)
  app.get('/api/tournaments/organization-settings/games', isAuthenticated, async (req: any, res) => {
    try {
      const { organizationId, startDate, endDate, diamondId } = req.query;
      
      if (!organizationId) {
        return res.status(400).json({ error: "organizationId is required" });
      }
      
      const organizationDiamonds = await diamondService.getDiamonds(organizationId as string);
      const organizationDiamondIds = organizationDiamonds.map(d => d.id);
      
      if (organizationDiamondIds.length === 0) {
        return res.json([]);
      }
      
      const allGames = await gameService.getAllGames();
      
      const filteredGames = allGames.filter(game => {
        if (!game.diamondId) return false;
        
        const isOrgDiamond = organizationDiamondIds.includes(game.diamondId);
        if (!isOrgDiamond) return false;
        
        if (diamondId && game.diamondId !== diamondId) return false;
        
        if (startDate && game.date < (startDate as string)) return false;
        if (endDate && game.date > (endDate as string)) return false;
        
        return true;
      });
      
      res.json(filteredGames);
    } catch (error) {
      console.error("Error fetching tournament games:", error);
      res.status(500).json({ error: "Failed to fetch tournament games" });
    }
  });

  // Organization Coordinator Routes
  app.get('/api/organizations/:orgId/coordinators', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { role } = req.query;
      
      const coordinators = await organizationService.getOrganizationCoordinators(orgId, role as string | undefined);
      res.json(coordinators);
    } catch (error) {
      console.error("Error fetching coordinators:", error);
      res.status(500).json({ error: "Failed to fetch coordinators" });
    }
  });

  app.post('/api/organizations/:orgId/coordinators', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const validatedData = insertOrganizationCoordinatorSchema.parse(req.body);
      
      const coordinator = await organizationService.upsertOrganizationCoordinator(
        orgId,
        validatedData.role,
        validatedData
      );
      
      res.status(201).json(coordinator);
    } catch (error) {
      console.error("Error creating/updating coordinator:", error);
      res.status(400).json({ error: "Failed to create/update coordinator" });
    }
  });

  app.put('/api/organizations/:orgId/coordinators/:coordinatorId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, coordinatorId } = req.params;
      const validatedData = insertOrganizationCoordinatorSchema.partial().parse(req.body);
      
      const coordinator = await organizationService.updateOrganizationCoordinator(coordinatorId, validatedData, orgId);
      res.json(coordinator);
    } catch (error) {
      console.error("Error updating coordinator:", error);
      res.status(400).json({ error: "Failed to update coordinator" });
    }
  });

  app.delete('/api/organizations/:orgId/coordinators/:coordinatorId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, coordinatorId } = req.params;
      await organizationService.deleteOrganizationCoordinator(coordinatorId, orgId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting coordinator:", error);
      res.status(500).json({ error: "Failed to delete coordinator" });
    }
  });

  // Coach Invitation Routes
  
  // Get accepted coach invitations for current user
  app.get("/api/coach-invitations/accepted", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const invitations = await organizationService.getAcceptedCoachInvitations(userId);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching accepted coach invitations:", error);
      res.status(500).json({ message: "Failed to fetch accepted coach invitations" });
    }
  });
  
  app.get('/api/organizations/:orgId/invitations', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
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

  app.post('/api/organizations/:orgId/invitations', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const userId = req.user.claims.sub;
      
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

  app.delete('/api/organizations/:orgId/invitations/:invitationId', requireDiamondBooking, requireOrgAdmin, async (req: any, res) => {
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
  app.get('/api/invitations/:token', async (req: any, res) => {
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

  app.post('/api/invitations/:token/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.params;
      const userId = req.user.claims.sub;
      
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
  app.get('/api/organizations/:orgId/admin-invitations', requireOrgAdmin, async (req: any, res) => {
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

  app.post('/api/organizations/:orgId/admin-invitations', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const userId = req.user.claims.sub;
      
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

  app.delete('/api/organizations/:orgId/admin-invitations/:invitationId', requireOrgAdmin, async (req: any, res) => {
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
  app.get('/api/admin-invitations/:token', async (req: any, res) => {
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

  app.post('/api/admin-invitations/:token/accept', isAuthenticated, async (req: any, res) => {
    try {
      const { token } = req.params;
      const userId = req.user.claims.sub;
      
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
  app.delete('/api/organizations/:orgId/admins/:userId', requireOrgAdmin, async (req: any, res) => {
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

  // =============================================
  // SMS COMMUNICATIONS ROUTES
  // =============================================

  // Get organization tournaments with teams and coaches (for SMS communications)
  app.get('/api/organizations/:orgId/tournaments-with-teams', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      
      // Get tournaments scoped to this organization (uses SQL WHERE clause)
      const orgTournaments = await tournamentService.getTournaments(orgId);
      
      // Fetch teams for each tournament
      const tournamentsWithTeams = await Promise.all(
        orgTournaments.map(async (tournament: any) => {
          const teams = await teamService.getTeams(tournament.id);
          return {
            id: tournament.id,
            name: tournament.name,
            organizationId: tournament.organizationId,
            teams: teams,
          };
        })
      );
      
      res.json(tournamentsWithTeams);
    } catch (error) {
      console.error("Error fetching organization tournaments:", error);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  // Get Twilio settings for organization
  app.get('/api/organizations/:orgId/twilio-settings', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const settings = await smsService.getTwilioSettings(orgId);
      
      if (!settings) {
        // Return defaults for first-time setup matching OrganizationTwilioSettings schema
        const now = new Date();
        return res.json({
          id: `temp-${orgId}`, // Temporary ID that will be replaced on save
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

      // Don't send auth token to frontend for security
      const { authToken, ...safeSettings } = settings;
      res.json({ ...safeSettings, authTokenConfigured: true });
    } catch (error) {
      console.error("Error fetching Twilio settings:", error);
      res.status(500).json({ error: "Failed to fetch Twilio settings" });
    }
  });

  // Save Twilio settings
  app.post('/api/organizations/:orgId/twilio-settings', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { accountSid, authToken, phoneNumber, dailyLimit, rateLimit, autoReplyMessage } = req.body;

      if (!accountSid || !authToken || !phoneNumber) {
        return res.status(400).json({ error: "Account SID, Auth Token, and Phone Number are required" });
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
  app.get('/api/organizations/:orgId/sms/rate-limit', requireOrgAdmin, async (req: any, res) => {
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
  app.post('/api/organizations/:orgId/sms/send', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const userId = req.user.claims.sub;
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
  app.post('/api/organizations/:orgId/sms/send-bulk', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const userId = req.user.claims.sub;
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
  app.get('/api/organizations/:orgId/sms/messages', requireOrgAdmin, async (req: any, res) => {
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
  app.post('/api/sms/webhook', async (req, res) => {
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
  app.get('/api/organizations/:orgId/sms/inbound', requireOrgAdmin, async (req: any, res) => {
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
  app.post('/api/organizations/:orgId/sms/inbound/:messageId/mark-read', requireOrgAdmin, async (req: any, res) => {
    try {
      const { messageId } = req.params;

      await smsService.markInboundMessageRead(messageId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ error: "Failed to mark message as read" });
    }
  });

  // =============================================
  // WEATHER INTEGRATION ROUTES
  // =============================================

  // Get weather settings for organization
  app.get('/api/organizations/:orgId/weather-settings', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const settings = await weatherService.getWeatherSettings(orgId);
      
      if (!settings) {
        // Return defaults for first-time setup
        const now = new Date();
        return res.json({
          id: `temp-${orgId}`,
          organizationId: orgId,
          apiKey: "",
          isEnabled: true,
          lightningRadiusMiles: 10,
          heatIndexThresholdF: 94,
          windSpeedThresholdMph: 25,
          precipitationThresholdPct: 70,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          apiKeyConfigured: false,
        });
      }

      // Don't send API key to frontend for security
      const { apiKey, ...safeSettings } = settings;
      res.json({ ...safeSettings, apiKeyConfigured: true });
    } catch (error) {
      console.error("Error fetching weather settings:", error);
      res.status(500).json({ error: "Failed to fetch weather settings" });
    }
  });

  // Save weather settings
  app.post('/api/organizations/:orgId/weather-settings', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      const { apiKey, isEnabled, lightningRadiusMiles, heatIndexThresholdF, windSpeedThresholdMph, precipitationThresholdPct } = req.body;

      // Get existing settings to check if key is configured
      const existingSettings = await weatherService.getWeatherSettings(orgId);
      
      // Only require API key if this is first-time setup
      if (!apiKey && !existingSettings) {
        return res.status(400).json({ error: "API key is required for first-time setup" });
      }

      // Build update object - only include apiKey if provided
      const updateData: any = {
        isEnabled,
        lightningRadiusMiles,
        heatIndexThresholdF,
        windSpeedThresholdMph,
        precipitationThresholdPct,
      };
      
      if (apiKey) {
        updateData.apiKey = apiKey;
      }

      const settings = await weatherService.saveWeatherSettings(orgId, updateData);

      const { apiKey: _, ...safeSettings } = settings;
      res.json({ ...safeSettings, apiKeyConfigured: true });
    } catch (error) {
      console.error("Error saving weather settings:", error);
      res.status(500).json({ error: "Failed to save weather settings" });
    }
  });

  // Get weather forecast for a specific game
  app.get('/api/games/:gameId/weather', async (req: any, res) => {
    try {
      const { gameId } = req.params;
      const forceRefresh = req.query.refresh === 'true';

      // Get game details
      const game = await gameService.getGame(gameId);
      if (!game) {
        return res.status(404).json({ error: "Game not found" });
      }

      // Get diamond for location coordinates
      if (!game.diamondId) {
        return res.status(400).json({ error: "Game has no diamond assigned" });
      }

      const diamond = await diamondService.getDiamond(game.diamondId);
      if (!diamond || !diamond.latitude || !diamond.longitude) {
        return res.status(400).json({ error: "Diamond has no location coordinates" });
      }

      // Combine date and time into a Date object
      const gameDateTime = new Date(`${game.date}T${game.time}`);

      // Fetch or get cached forecast
      const forecast = await weatherService.getGameWeatherForecast(
        gameId,
        game.tournamentId,
        parseFloat(diamond.latitude),
        parseFloat(diamond.longitude),
        gameDateTime,
        forceRefresh
      );

      if (!forecast) {
        return res.status(404).json({ error: "Weather forecast not available" });
      }

      res.json(forecast);
    } catch (error) {
      console.error("Error fetching game weather:", error);
      res.status(500).json({ error: "Failed to fetch weather forecast" });
    }
  });

  // Bulk fetch weather for multiple games in a tournament
  app.post('/api/tournaments/:tournamentId/weather/bulk-fetch', requireOrgAdmin, async (req: any, res) => {
    try {
      const { tournamentId } = req.params;

      // Get all games for tournament
      const games = await gameService.getGames(tournamentId);
      
      // Filter games that have diamonds with coordinates, track errors
      const gamesWithLocation = [];
      const skippedGames = [];
      
      for (const game of games) {
        if (!game.diamondId) {
          skippedGames.push({
            gameId: game.id,
            reason: "No diamond assigned",
          });
          continue;
        }
        
        const diamond = await diamondService.getDiamond(game.diamondId);
        if (!diamond) {
          skippedGames.push({
            gameId: game.id,
            reason: "Diamond not found",
          });
          continue;
        }
        
        if (!diamond.latitude || !diamond.longitude) {
          skippedGames.push({
            gameId: game.id,
            reason: "Diamond has no GPS coordinates",
          });
          continue;
        }
        
        const gameDateTime = new Date(`${game.date}T${game.time}`);
        gamesWithLocation.push({
          id: game.id,
          organizationId: tournamentId,
          latitude: parseFloat(diamond.latitude),
          longitude: parseFloat(diamond.longitude),
          dateTime: gameDateTime,
        });
      }

      // Bulk fetch forecasts (handles individual errors internally)
      const forecasts = await weatherService.bulkFetchGameForecasts(gamesWithLocation);

      res.json({
        success: true,
        totalGames: games.length,
        gamesWithWeather: forecasts.length,
        gamesSkipped: skippedGames.length,
        skippedGames,
        forecasts,
      });
    } catch (error) {
      console.error("Error bulk fetching weather:", error);
      res.status(500).json({ error: "Failed to bulk fetch weather" });
    }
  });

  // Get all games with weather alerts for a tournament
  app.get('/api/tournaments/:tournamentId/weather/alerts', async (req: any, res) => {
    try {
      const { tournamentId } = req.params;

      // Get all games for tournament
      const games = await gameService.getGames(tournamentId);

      // Get cached forecasts for all games
      const gamesWithAlerts = [];
      for (const game of games) {
        const forecast = await weatherService.getCachedForecast(game.id);
        if (forecast && (
          forecast.hasLightningAlert ||
          forecast.hasHeatAlert ||
          forecast.hasWindAlert ||
          forecast.hasPrecipitationAlert ||
          forecast.hasSevereWeatherAlert
        )) {
          gamesWithAlerts.push({
            game,
            forecast,
          });
        }
      }

      res.json(gamesWithAlerts);
    } catch (error) {
      console.error("Error fetching weather alerts:", error);
      res.status(500).json({ error: "Failed to fetch weather alerts" });
    }
  });

  // Public route: Get team information by management token
  app.get('/api/team/update/:token', async (req: any, res) => {
    try {
      const { token } = req.params;

      // Find team by management token
      const team = await teamService.getTeamByManagementToken(token);
      if (!team) {
        return res.status(404).json({ error: "Team not found or invalid token" });
      }

      // Get tournament info for context
      const tournament = await tournamentService.getTournament(team.tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      // Get organization for context
      const organization = await organizationService.getOrganization(tournament.organizationId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Return team info (excluding sensitive fields)
      res.json({
        id: team.id,
        name: team.name,
        division: team.division,
        coachFirstName: team.coachFirstName,
        coachLastName: team.coachLastName,
        coachPhone: team.coachPhone,
        managerName: team.managerName,
        managerPhone: team.managerPhone,
        assistantName: team.assistantName,
        assistantPhone: team.assistantPhone,
        tournament: {
          id: tournament.id,
          name: tournament.name,
        },
        organization: {
          id: organization.id,
          name: organization.name,
        },
      });
    } catch (error) {
      console.error("Error fetching team by token:", error);
      res.status(500).json({ error: "Failed to fetch team information" });
    }
  });

  // Public route: Update team staff contacts by management token
  app.post('/api/team/update/:token', async (req: any, res) => {
    try {
      const { token } = req.params;
      const { managerName, managerPhone, assistantName, assistantPhone } = req.body;

      // Find team by management token
      const team = await teamService.getTeamByManagementToken(token);
      if (!team) {
        return res.status(404).json({ error: "Team not found or invalid token" });
      }

      // Update team staff contacts
      const updatedTeam = await teamService.updateTeam(team.id, {
        managerName: managerName || null,
        managerPhone: managerPhone || null,
        assistantName: assistantName || null,
        assistantPhone: assistantPhone || null,
      });

      // Get tournament and organization info for SMS notifications
      const tournament = await tournamentService.getTournament(team.tournamentId);
      const organization = tournament ? await organizationService.getOrganization(tournament.organizationId) : null;

      // Send SMS confirmation to newly added staff members
      if (organization && tournament) {
        const newStaff = [];
        
        // Check if manager was newly added (has phone and wasn't previously set)
        if (managerPhone && managerPhone !== team.managerPhone) {
          newStaff.push({
            name: managerName,
            phone: managerPhone,
            role: 'Team Manager',
          });
        }
        
        // Check if assistant was newly added (has phone and wasn't previously set)
        if (assistantPhone && assistantPhone !== team.assistantPhone) {
          newStaff.push({
            name: assistantName,
            phone: assistantPhone,
            role: 'Assistant Coach',
          });
        }

        // Send welcome messages to new staff
        for (const staff of newStaff) {
          try {
            await smsService.sendSMS({
              organizationId: organization.id,
              to: staff.phone,
              message: `Welcome! You've been added as ${staff.role} for ${team.name} in the ${tournament.name}. You'll receive tournament updates at this number.`,
            });
          } catch (smsError) {
            console.error(`Failed to send welcome SMS to ${staff.phone}:`, smsError);
            // Continue even if SMS fails - don't block the update
          }
        }
      }

      res.json({ 
        success: true, 
        message: "Team staff contacts updated successfully",
        team: {
          id: updatedTeam.id,
          name: updatedTeam.name,
          managerName: updatedTeam.managerName,
          managerPhone: updatedTeam.managerPhone,
          assistantName: updatedTeam.assistantName,
          assistantPhone: updatedTeam.assistantPhone,
        },
      });
    } catch (error) {
      console.error("Error updating team staff contacts:", error);
      res.status(500).json({ error: "Failed to update team information" });
    }
  });

  // Template CRUD routes
  
  // Create communication template
  app.post('/api/organizations/:orgId/templates', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId } = req.params;
      
      // Validate and parse input
      const templateData = insertCommunicationTemplateSchema.parse({
        ...req.body,
        organizationId: orgId,
      });

      const [template] = await db.insert(communicationTemplates).values(templateData).returning();
      res.json(template);
    } catch (error: any) {
      // Handle Zod validation errors with 400
      if (error.name === 'ZodError') {
        console.error("Template validation error:", error);
        return res.status(400).json({ 
          error: "Invalid template data", 
          details: error.errors 
        });
      }
      
      // All other errors are 500
      console.error("Error creating template:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Get all templates for an organization
  app.get('/api/organizations/:orgId/templates', requireOrgAdmin, async (req: any, res) => {
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
  app.patch('/api/organizations/:orgId/templates/:templateId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, templateId } = req.params;
      const { name, content } = req.body;

      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: "Template name is required and cannot be empty" });
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "Template content is required and cannot be empty" });
      }

      // Update and verify template belongs to organization in one query
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
  app.delete('/api/organizations/:orgId/templates/:templateId', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, templateId } = req.params;

      // Delete and verify template belongs to organization in one query
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
  app.get('/api/organizations/:orgId/tournaments/:tournamentId/messages', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, tournamentId } = req.params;

      // Verify tournament belongs to organization
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      if (tournament.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied: Tournament does not belong to this organization" });
      }

      // Fetch messages ordered by most recent first
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
  app.post('/api/organizations/:orgId/tournaments/:tournamentId/send-message', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, tournamentId } = req.params;
      const { content, recipientType } = req.body;

      // Validate content is non-empty
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ error: "Message content is required and cannot be empty" });
      }

      // Validate recipient type
      if (!recipientType || !["coaches_only", "all_staff"].includes(recipientType)) {
        return res.status(400).json({ error: "Invalid recipient type. Must be 'coaches_only' or 'all_staff'" });
      }

      // Verify organization exists
      const organization = await organizationService.getOrganization(orgId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // CRITICAL: Verify tournament belongs to the organization
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      if (tournament.organizationId !== orgId) {
        return res.status(403).json({ error: "Access denied: Tournament does not belong to this organization" });
      }

      // Get all teams for the tournament
      const teams = await teamService.getTeams(tournamentId);
      
      // Collect recipient phone numbers
      const recipients = new Set<string>();
      for (const team of teams) {
        // Always include coach
        if (team.coachPhone) {
          recipients.add(team.coachPhone);
        }

        // Include staff if recipientType is all_staff
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

      // Send SMS to all recipients
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

      // Log the message to tournament_messages table
      const userId = req.user?.claims?.sub;
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
  app.post('/api/organizations/:orgId/tournaments/:tournamentId/request-staff-contacts', requireOrgAdmin, async (req: any, res) => {
    try {
      const { orgId, tournamentId } = req.params;

      // Verify organization access
      const organization = await organizationService.getOrganization(orgId);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Verify tournament belongs to organization
      const tournament = await tournamentService.getTournament(tournamentId);
      if (!tournament || tournament.organizationId !== orgId) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      // Get all teams for the tournament
      const teams = await teamService.getTeams(tournamentId);
      
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each team
      for (const team of teams) {
        try {
          // Skip teams without coach phone
          if (!team.coachPhone) {
            console.log(`Skipping team ${team.name} - no coach phone`);
            continue;
          }

          // Generate management token if team doesn't have one
          let token = team.managementToken;
          if (!token) {
            token = nanoid(32); // Generate secure token
            await teamService.updateTeam(team.id, { managementToken: token });
          }

          // Build update URL
          const updateUrl = `${req.protocol}://${req.get('host')}/team/update/${token}`;

          // Send SMS to coach
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

  // ==================== SMART CONCIERGE WEBHOOK ====================
  // Public webhook for Twilio inbound SMS (no auth required)
  app.post("/api/webhooks/twilio/inbound", async (req, res) => {
    try {
      const fromNumber = req.body.From;
      const toNumber = req.body.To;
      const messageBody = req.body.Body || "";

      if (!fromNumber || !toNumber) {
        return res.status(400).send("Missing required fields: From or To");
      }

      // Smart Concierge: Identify sender, generate reply, log message
      const twimlResponse = await smsService.handleInboundMessage(
        fromNumber,
        toNumber,
        messageBody
      );

      // Return TwiML to Twilio
      res.type("text/xml");
      res.send(twimlResponse);
    } catch (error) {
      console.error("Error handling inbound SMS:", error);
      
      // Return generic error TwiML
      const MessagingResponse = twilio.twiml.MessagingResponse;
      const twiml = new MessagingResponse();
      twiml.message("We're experiencing technical difficulties. Please try again later.");
      
      res.type("text/xml");
      res.send(twiml.toString());
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
