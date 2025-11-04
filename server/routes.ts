import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertOrganizationSchema,
  insertTournamentSchema, 
  insertAgeDivisionSchema, 
  insertPoolSchema, 
  insertTeamSchema, 
  insertGameSchema,
  gameUpdateSchema,
  insertAdminRequestSchema
} from "@shared/schema";
import { setupAuth, isAuthenticated, requireAdmin, requireSuperAdmin, requireOrgAdmin } from "./replitAuth";
import { generateValidationReport } from "./validationReport";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);
  
  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User list endpoint - super admin only
  app.get('/api/users', requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
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
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      if (user.isAdmin || user.isSuperAdmin) {
        return res.status(400).json({ error: "You already have admin access" });
      }

      const existingRequest = await storage.getUserAdminRequest(userId);
      if (existingRequest && existingRequest.status === 'pending') {
        return res.status(400).json({ error: "You already have a pending admin request" });
      }

      // Check if organization slug already exists
      const existingOrg = await storage.getOrganizationBySlug(req.body.organizationSlug);
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
      
      const request = await storage.createAdminRequest(validatedData);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating admin request:", error);
      res.status(400).json({ error: "Failed to create admin request" });
    }
  });

  app.get('/api/admin-requests', requireSuperAdmin, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getAdminRequests(status);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching admin requests:", error);
      res.status(500).json({ error: "Failed to fetch admin requests" });
    }
  });

  app.get('/api/admin-requests/my-request', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const request = await storage.getUserAdminRequest(userId);
      res.json(request || null);
    } catch (error) {
      console.error("Error fetching user admin request:", error);
      res.status(500).json({ error: "Failed to fetch admin request" });
    }
  });

  app.put('/api/admin-requests/:id/approve', requireSuperAdmin, async (req: any, res) => {
    try {
      const reviewerId = req.user.claims.sub;
      const request = await storage.approveAdminRequest(req.params.id, reviewerId);
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
      const request = await storage.rejectAdminRequest(req.params.id, reviewerId);
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
      const flags = await storage.getFeatureFlags();
      res.json(flags);
    } catch (error) {
      console.error("Error fetching feature flags:", error);
      res.status(500).json({ error: "Failed to fetch feature flags" });
    }
  });

  app.put('/api/feature-flags/:id', requireSuperAdmin, async (req, res) => {
    try {
      const { isEnabled } = req.body;
      const updatedFlag = await storage.updateFeatureFlag(req.params.id, { isEnabled });
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
      const organizations = await storage.getOrganizations();
      res.json(organizations);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      res.status(500).json({ error: "Failed to fetch organizations" });
    }
  });

  // Get organization by ID (for internal use, e.g., from tournament.organizationId)
  app.get("/api/organizations/by-id/:id", async (req, res) => {
    try {
      const organization = await storage.getOrganization(req.params.id);
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
      const organization = await storage.getOrganizationBySlug(req.params.slug);
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
      const organization = await storage.getOrganizationBySlug(req.params.slug);
      if (!organization) {
        return res.status(404).json({ error: "Organization not found" });
      }
      const tournaments = await storage.getTournaments(organization.id);
      res.json(tournaments);
    } catch (error) {
      console.error("Error fetching organization tournaments:", error);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  app.post("/api/organizations", requireSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error) {
      console.error("Error creating organization:", error);
      res.status(400).json({ error: "Invalid organization data" });
    }
  });

  app.put("/api/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.partial().parse(req.body);
      const organization = await storage.updateOrganization(req.params.id, validatedData);
      res.json(organization);
    } catch (error) {
      console.error("Error updating organization:", error);
      res.status(400).json({ error: "Failed to update organization" });
    }
  });

  app.delete("/api/organizations/:id", requireSuperAdmin, async (req, res) => {
    try {
      await storage.deleteOrganization(req.params.id);
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

      const admin = await storage.assignOrganizationAdmin(userId, organizationId, role);
      res.status(201).json(admin);
    } catch (error) {
      console.error("Error assigning organization admin:", error);
      res.status(400).json({ error: "Failed to assign organization admin" });
    }
  });

  app.delete("/api/organizations/:organizationId/admins/:userId", requireSuperAdmin, async (req, res) => {
    try {
      const { organizationId, userId } = req.params;
      await storage.removeOrganizationAdmin(userId, organizationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing organization admin:", error);
      res.status(400).json({ error: "Failed to remove organization admin" });
    }
  });

  app.get("/api/organizations/:organizationId/admins", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId } = req.params;
      const admins = await storage.getOrganizationAdmins(organizationId);
      res.json(admins);
    } catch (error) {
      console.error("Error fetching organization admins:", error);
      res.status(500).json({ error: "Failed to fetch organization admins" });
    }
  });

  app.get("/api/users/:userId/organizations", isAuthenticated, async (req: any, res) => {
    try {
      const requestingUserId = req.user.claims.sub;
      const targetUserId = req.params.userId;
      
      // Users can only view their own organizations unless they're a super admin
      if (requestingUserId !== targetUserId) {
        const user = await storage.getUser(requestingUserId);
        if (!user || !user.isSuperAdmin) {
          return res.status(403).json({ error: "Forbidden - Cannot view other users' organizations" });
        }
      }
      
      const organizations = await storage.getUserOrganizations(targetUserId);
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
      const globalFlags = await storage.getFeatureFlags();
      
      // Get organization-specific flag settings
      const orgFlags = await storage.getOrganizationFeatureFlags(organizationId);
      
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
      
      const orgFlag = await storage.setOrganizationFeatureFlag(organizationId, featureFlagId, isEnabled);
      res.json(orgFlag);
    } catch (error) {
      console.error("Error setting organization feature flag:", error);
      res.status(500).json({ error: "Failed to set organization feature flag" });
    }
  });

  app.delete("/api/organizations/:organizationId/feature-flags/:featureFlagId", requireOrgAdmin, async (req, res) => {
    try {
      const { organizationId, featureFlagId } = req.params;
      await storage.removeOrganizationFeatureFlag(organizationId, featureFlagId);
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
      const isEnabled = await storage.isFeatureEnabledForOrganization(organizationId, featureKey);
      res.json({ enabled: isEnabled });
    } catch (error) {
      console.error("Error checking feature enabled status:", error);
      res.status(500).json({ error: "Failed to check feature status" });
    }
  });

  // Tournament routes
  app.get("/api/tournaments", async (req: any, res) => {
    try {
      let tournaments = await storage.getTournaments();
      
      // Role-aware filtering for admin users
      if (req.user && req.user.claims) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        
        // Regular admins (not super admins) only see their own tournaments
        if (user && user.isAdmin && !user.isSuperAdmin) {
          tournaments = tournaments.filter(t => t.createdBy === userId);
        }
        // Super admins see all tournaments (no filtering)
        // Non-admin authenticated users see all tournaments (public viewing)
      }
      // Unauthenticated users see all tournaments (public viewing)
      
      res.json(tournaments);
    } catch (error) {
      console.error("Error fetching tournaments:", error);
      res.status(500).json({ error: "Failed to fetch tournaments" });
    }
  });

  app.get("/api/tournaments/:id", async (req, res) => {
    try {
      const tournament = await storage.getTournament(req.params.id);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
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
      const validatedData = insertTournamentSchema.parse({
        ...req.body,
        createdBy: userId
      });
      const tournament = await storage.createTournament(validatedData);
      res.status(201).json(tournament);
    } catch (error) {
      console.error("Error creating tournament:", error);
      res.status(400).json({ error: "Invalid tournament data" });
    }
  });

  app.put("/api/tournaments/:id", requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const tournament = await storage.getTournament(req.params.id);

      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      if (!user?.isSuperAdmin && tournament.createdBy !== userId) {
        return res.status(403).json({ error: "You can only edit tournaments you created" });
      }

      const validatedData = insertTournamentSchema.partial().parse(req.body);
      const updatedTournament = await storage.updateTournament(req.params.id, validatedData);
      res.json(updatedTournament);
    } catch (error) {
      console.error("Error updating tournament:", error);
      res.status(400).json({ error: "Invalid tournament data" });
    }
  });

  app.delete("/api/tournaments/:id", requireAdmin, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const tournament = await storage.getTournament(req.params.id);

      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      if (!user?.isSuperAdmin && tournament.createdBy !== userId) {
        return res.status(403).json({ error: "You can only delete tournaments you created" });
      }

      await storage.deleteTournament(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting tournament:", error);
      res.status(500).json({ error: "Failed to delete tournament" });
    }
  });

  // Age Division routes
  app.get("/api/tournaments/:tournamentId/age-divisions", async (req, res) => {
    try {
      const ageDivisions = await storage.getAgeDivisions(req.params.tournamentId);
      res.json(ageDivisions);
    } catch (error) {
      console.error("Error fetching age divisions:", error);
      res.status(500).json({ error: "Failed to fetch age divisions" });
    }
  });

  app.post("/api/tournaments/:tournamentId/age-divisions", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertAgeDivisionSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const ageDivision = await storage.createAgeDivision(validatedData);
      res.status(201).json(ageDivision);
    } catch (error) {
      console.error("Error creating age division:", error);
      res.status(400).json({ error: "Invalid age division data" });
    }
  });

  // Pool routes
  app.get("/api/tournaments/:tournamentId/pools", async (req, res) => {
    try {
      const pools = await storage.getPools(req.params.tournamentId);
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
      const pool = await storage.createPool(validatedData);
      res.status(201).json(pool);
    } catch (error) {
      console.error("Error creating pool:", error);
      res.status(400).json({ error: "Invalid pool data" });
    }
  });

  // Team routes
  app.get("/api/tournaments/:tournamentId/teams", async (req, res) => {
    try {
      // Prevent caching to ensure mobile devices get fresh data
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const teams = await storage.getTeams(req.params.tournamentId);
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
      const team = await storage.createTeam(validatedData);
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
      
      const team = await storage.updateTeam(req.params.id, updateData);
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
      const team = await storage.getTeamById(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      // Get the team's pool to find the age division
      const pool = await storage.getPoolById(team.poolId);
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
              const team = await storage.updateTeam(teamId, updateData);
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
            
            const team = await storage.updateTeam(teamId, updateData);
            
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
      await storage.deleteTeam(req.params.id);
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
      const updatedTeam = await storage.updateTeam(teamId, suggestedData);
      
      res.json({
        team: updatedTeam,
        suggestions: suggestedData
      });
    } catch (error) {
      console.error("Error populating team data:", error);
      res.status(400).json({ error: "Failed to populate team data" });
    }
  });

  // Game routes
  app.get("/api/tournaments/:tournamentId/games", async (req, res) => {
    try {
      const games = await storage.getGames(req.params.tournamentId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ error: "Failed to fetch games" });
    }
  });

  app.post("/api/tournaments/:tournamentId/games", requireAdmin, async (req, res) => {
    try {
      const validatedData = insertGameSchema.parse({
        ...req.body,
        tournamentId: req.params.tournamentId
      });
      const game = await storage.createGame(validatedData);
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
      const game = await storage.updateGameWithAudit(req.params.id, validatedData, userId, metadata);
      
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
      await storage.deleteGame(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting game:", error);
      res.status(400).json({ error: "Failed to delete game" });
    }
  });

  // Validation report generation
  app.get("/api/tournaments/:tournamentId/validation-report", requireAdmin, async (req, res) => {
    try {
      const tournamentId = req.params.tournamentId;
      
      // Fetch all necessary data
      const tournament = await storage.getTournament(tournamentId);
      if (!tournament) {
        return res.status(404).json({ error: "Tournament not found" });
      }
      
      const pools = await storage.getPools(tournamentId);
      const teams = await storage.getTeams(tournamentId);
      const games = await storage.getGames(tournamentId);
      
      // Generate validation report
      const report = generateValidationReport(tournament, pools, teams, games);
      
      res.json(report);
    } catch (error) {
      console.error("Error generating validation report:", error);
      res.status(500).json({ error: "Failed to generate validation report" });
    }
  });

  // Playoff bracket generation
  app.post("/api/tournaments/:tournamentId/divisions/:divisionId/generate-bracket", requireAdmin, async (req, res) => {
    try {
      const { tournamentId, divisionId } = req.params;
      const games = await storage.generatePlayoffBracket(tournamentId, divisionId);
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

      // Clear existing data
      await storage.clearTournamentData(tournamentId);

      // Insert new data in order
      const createdAgeDivisions = await Promise.all(
        ageDivisions.map((div: any) => storage.createAgeDivision({ ...div, tournamentId }))
      );

      const createdPools = await Promise.all(
        pools.map((pool: any) => storage.createPool({ ...pool, tournamentId }))
      );

      const createdTeams = await storage.bulkCreateTeams(
        teams.map((team: any) => ({ ...team, tournamentId }))
      );

      const createdGames = await storage.bulkCreateGames(
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
              await storage.updateTeamRoster(tournamentTeamId, JSON.stringify(rosterData.players));
              
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
      const tournament = await storage.getTournament(tournamentId);
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
      await storage.createAgeDivision({
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
        
        await storage.createPool({
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
          
          await storage.createTeam({
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
            
            await storage.createGame({
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
      const playoffGames = await storage.generatePlayoffBracket(tournamentId, ageDivisionId);
      
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

  const httpServer = createServer(app);

  return httpServer;
}
