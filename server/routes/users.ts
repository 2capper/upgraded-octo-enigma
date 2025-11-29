import { Router } from "express";
import { userService } from "../services/userService";
import { organizationService } from "../services/organizationService";
import { isAuthenticated, requireSuperAdmin } from "../auth";
import { insertAdminRequestSchema } from "@shared/schema";

const router = Router();

router.get("/users/me/organizations", isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
    const user = await userService.getUser(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let organizations;
    if (user.isSuperAdmin) {
      organizations = await organizationService.getOrganizations();
    } else {
      const orgIds = new Set<string>();
      
      if (user.isAdmin) {
        const adminOrgs = await userService.getUserOrganizations(userId);
        adminOrgs.forEach(org => orgIds.add(org.id));
      }
      
      const coachInvites = await organizationService.getAcceptedCoachInvitations(userId);
      coachInvites.forEach(invite => orgIds.add(invite.organizationId));
      
      const coordinatorAssignments = await userService.getUserCoordinatorAssignments(userId);
      coordinatorAssignments.forEach(assignment => orgIds.add(assignment.organizationId));
      
      const allOrgs = await organizationService.getOrganizations();
      organizations = allOrgs.filter(org => orgIds.has(org.id));
    }
    
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching user organizations:", error);
    res.status(500).json({ error: "Failed to fetch user organizations" });
  }
});

router.get('/users', requireSuperAdmin, async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch('/users/:userId/admin-status', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isAdmin } = req.body;

    if (typeof isAdmin !== 'boolean') {
      return res.status(400).json({ error: "isAdmin must be a boolean" });
    }

    const user = await userService.updateUserAdminStatus(userId, isAdmin);
    res.json(user);
  } catch (error) {
    console.error("Error updating admin status:", error);
    res.status(500).json({ error: "Failed to update admin status" });
  }
});

router.patch('/users/:userId/super-admin-status', requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { isSuperAdmin } = req.body;

    if (typeof isSuperAdmin !== 'boolean') {
      return res.status(400).json({ error: "isSuperAdmin must be a boolean" });
    }

    const user = await userService.updateUserSuperAdminStatus(userId, isSuperAdmin);
    res.json(user);
  } catch (error) {
    console.error("Error updating super admin status:", error);
    res.status(500).json({ error: "Failed to update super admin status" });
  }
});

router.get('/all-organization-admins', requireSuperAdmin, async (req, res) => {
  try {
    const admins = await organizationService.getAllOrganizationAdmins();
    res.json(admins);
  } catch (error) {
    console.error("Error fetching all organization admins:", error);
    res.status(500).json({ error: "Failed to fetch organization admins" });
  }
});

router.post('/admin-requests', isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
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

router.get('/admin-requests', requireSuperAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const requests = await organizationService.getAdminRequests(status);
    res.json(requests);
  } catch (error) {
    console.error("Error fetching admin requests:", error);
    res.status(500).json({ error: "Failed to fetch admin requests" });
  }
});

router.get('/admin-requests/my-request', isAuthenticated, async (req: any, res) => {
  try {
    const userId = (req.user as any).id;
    const request = await userService.getUserAdminRequest(userId);
    res.json(request || null);
  } catch (error) {
    console.error("Error fetching user admin request:", error);
    res.status(500).json({ error: "Failed to fetch admin request" });
  }
});

router.put('/admin-requests/:id/approve', requireSuperAdmin, async (req: any, res) => {
  try {
    const reviewerId = (req.user as any).id;
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

router.put('/admin-requests/:id/reject', requireSuperAdmin, async (req: any, res) => {
  try {
    const reviewerId = (req.user as any).id;
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

router.get('/feature-flags', async (req, res) => {
  try {
    const flags = await organizationService.getFeatureFlags();
    res.json(flags);
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    res.status(500).json({ error: "Failed to fetch feature flags" });
  }
});

router.put('/feature-flags/:id', requireSuperAdmin, async (req, res) => {
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

router.get("/users/:userId/organizations", isAuthenticated, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const currentUser = req.user as any;
    
    if (!currentUser.isSuperAdmin && currentUser.id !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    const organizations = await userService.getUserOrganizations(userId);
    res.json(organizations);
  } catch (error) {
    console.error("Error fetching user organizations:", error);
    res.status(500).json({ error: "Failed to fetch organizations" });
  }
});

export default router;
