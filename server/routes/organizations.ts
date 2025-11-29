import { Router } from "express";
import { organizationService } from "../services/organizationService";
import { userService } from "../services/userService";
import { isAuthenticated, requireOrgAdmin, requireSuperAdmin } from "../auth";
import { insertOrganizationSchema } from "@shared/schema";
import { notificationService } from "../lib/notificationService";

const router = Router();

router.get("/organizations", async (req, res) => {
  try {
    const organizations = await organizationService.getOrganizations();
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

router.get("/organizations/by-id/:id", async (req, res) => {
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

router.get("/organizations/unclaimed/search", isAuthenticated, async (req: any, res) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return res.json([]);
    }
    
    const results = await organizationService.searchUnclaimedOrganizations(q);
    res.json(results);
  } catch (error) {
    console.error("Error searching unclaimed organizations:", error);
    res.status(500).json({ error: "Failed to search organizations" });
  }
});

router.get("/organizations/:slugOrId", async (req, res) => {
  try {
    const param = req.params.slugOrId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param);
    
    let organization;
    if (isUuid) {
      organization = await organizationService.getOrganization(param);
    } else {
      organization = await organizationService.getOrganizationBySlug(param);
    }
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found" });
    }
    res.json(organization);
  } catch (error) {
    console.error("Error fetching organization:", error);
    res.status(500).json({ error: "Failed to fetch organization" });
  }
});

router.post("/organizations/:organizationId/claim", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { organizationId } = req.params;
    
    const existingOrgs = await userService.getUserOrganizations(userId);
    if (existingOrgs.length > 0) {
      return res.status(403).json({ 
        error: "You already have an organization. Contact support if you need to claim additional organizations." 
      });
    }

    const organization = await organizationService.claimOrganization(organizationId, userId);
    
    if (!organization) {
      return res.status(404).json({ error: "Organization not found or already claimed" });
    }

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

    res.json(organization);
  } catch (error) {
    console.error("Error claiming organization:", error);
    res.status(500).json({ error: "Failed to claim organization" });
  }
});

router.post("/onboarding/create-organization", isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const existingOrgs = await userService.getUserOrganizations(userId);
    if (existingOrgs.length > 0) {
      return res.status(403).json({ 
        error: "You already have an organization. Use the admin portal to manage it." 
      });
    }

    const validatedData = insertOrganizationSchema.parse(req.body);
    const organization = await organizationService.createOrganization(validatedData);

    await organizationService.assignOrganizationAdmin(userId, organization.id, 'admin');

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

router.post("/organizations", requireSuperAdmin, async (req, res) => {
  try {
    const validatedData = insertOrganizationSchema.parse(req.body);
    const organization = await organizationService.createOrganization(validatedData);
    res.status(201).json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);
    res.status(400).json({ error: "Invalid organization data" });
  }
});

router.put("/organizations/:organizationId", requireOrgAdmin, async (req, res) => {
  try {
    const validatedData = insertOrganizationSchema.partial().parse(req.body);
    const organization = await organizationService.updateOrganization(req.params.organizationId, validatedData);
    res.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    res.status(400).json({ error: "Failed to update organization" });
  }
});

router.delete("/organizations/:id", requireSuperAdmin, async (req, res) => {
  try {
    await organizationService.deleteOrganization(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting organization:", error);
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

router.post("/organizations/:organizationId/admins", requireSuperAdmin, async (req, res) => {
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

router.delete("/organizations/:organizationId/admins/:userId", requireSuperAdmin, async (req, res) => {
  try {
    const { organizationId, userId } = req.params;
    await organizationService.removeOrganizationAdmin(userId, organizationId);
    res.status(204).send();
  } catch (error) {
    console.error("Error removing organization admin:", error);
    res.status(400).json({ error: "Failed to remove organization admin" });
  }
});

router.get("/organizations/:organizationId/admins", requireOrgAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const admins = await organizationService.getOrganizationAdmins(organizationId);
    res.json(admins);
  } catch (error) {
    console.error("Error fetching organization admins:", error);
    res.status(500).json({ error: "Failed to fetch organization admins" });
  }
});

router.get("/organizations/:organizationId/user-role", isAuthenticated, async (req: any, res) => {
  try {
    const { organizationId } = req.params;
    const userId = (req.user as any).id;
    
    const user = await userService.getUser(userId);
    if (user?.isSuperAdmin) {
      return res.json({
        isAdmin: true,
        role: 'super_admin'
      });
    }
    
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

router.get("/organizations/:organizationId/feature-flags", requireOrgAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    
    const globalFlags = await organizationService.getFeatureFlags();
    const orgFlags = await organizationService.getOrganizationFeatureFlags(organizationId);
    
    const flagsWithOrgSettings = globalFlags.map(flag => {
      const orgFlag = orgFlags.find(of => of.featureFlagId === flag.id);
      const effectivelyEnabled = orgFlag !== undefined 
        ? orgFlag.isEnabled 
        : flag.isEnabled;
      return {
        ...flag,
        key: flag.featureKey,
        orgEnabled: orgFlag ? orgFlag.isEnabled : null,
        effectivelyEnabled,
      };
    });
    
    res.json(flagsWithOrgSettings);
  } catch (error) {
    console.error("Error fetching organization feature flags:", error);
    res.status(500).json({ error: "Failed to fetch organization feature flags" });
  }
});

router.post("/organizations/:organizationId/feature-flags/:featureFlagId", requireOrgAdmin, async (req, res) => {
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

router.delete("/organizations/:organizationId/feature-flags/:featureFlagId", requireOrgAdmin, async (req, res) => {
  try {
    const { organizationId, featureFlagId } = req.params;
    await organizationService.removeOrganizationFeatureFlag(organizationId, featureFlagId);
    res.status(204).send();
  } catch (error) {
    console.error("Error removing organization feature flag:", error);
    res.status(500).json({ error: "Failed to remove organization feature flag" });
  }
});

router.get("/organizations/:organizationId/features/:featureKey/enabled", async (req, res) => {
  try {
    const { organizationId, featureKey } = req.params;
    const isEnabled = await organizationService.isFeatureEnabledForOrganization(organizationId, featureKey);
    res.json({ enabled: isEnabled });
  } catch (error) {
    console.error("Error checking feature enabled status:", error);
    res.status(500).json({ error: "Failed to check feature status" });
  }
});

export default router;
