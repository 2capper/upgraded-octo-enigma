import { db } from "../db";
import { 
  organizations,
  organizationAdmins,
  organizationFeatureFlags,
  featureFlags,
  adminRequests,
  organizationCoordinators,
  coachInvitations,
  adminInvitations,
  users,
  type Organization,
  type InsertOrganization,
  type OrganizationAdmin,
  type OrganizationFeatureFlag,
  type FeatureFlag,
  type InsertFeatureFlag,
  type AdminRequest,
  type InsertAdminRequest,
  type OrganizationCoordinator,
  type InsertOrganizationCoordinator,
  type CoachInvitation,
  type InsertCoachInvitation,
  type AdminInvitation,
  type InsertAdminInvitation,
} from "@shared/schema";
import { eq, and, sql, desc, ilike, or } from "drizzle-orm";

export class OrganizationService {
  // Organization CRUD
  async getOrganizations(): Promise<Organization[]> {
    return await db.select().from(organizations);
  }

  async getOrganization(id: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id));
    return org || undefined;
  }

  async getOrganizationBySlug(slug: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug));
    return org || undefined;
  }

  async getOrganizationByToken(token: string): Promise<Organization | undefined> {
    const [org] = await db.select().from(organizations).where(eq(organizations.calendarSubscriptionToken, token));
    return org || undefined;
  }

  async createOrganization(organization: InsertOrganization): Promise<Organization> {
    const [result] = await db.insert(organizations).values(organization).returning();
    return result;
  }

  async updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization> {
    const [result] = await db.update(organizations).set({
      ...organization,
      updatedAt: new Date(),
    }).where(eq(organizations.id, id)).returning();
    return result;
  }

  async deleteOrganization(id: string): Promise<void> {
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  // Search for unclaimed organizations (for the claim flow)
  async searchUnclaimedOrganizations(query: string): Promise<Organization[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(organizations)
      .where(
        and(
          eq(organizations.isClaimed, false),
          or(
            ilike(organizations.name, searchPattern),
            ilike(organizations.city, searchPattern)
          )
        )
      )
      .limit(20);
  }

  // Claim an unclaimed organization
  async claimOrganization(organizationId: string, userId: string): Promise<Organization | null> {
    return await db.transaction(async (tx) => {
      // Atomically update ONLY if still unclaimed - prevents race conditions
      const [updatedOrg] = await tx
        .update(organizations)
        .set({ 
          isClaimed: true,
          updatedAt: new Date()
        })
        .where(
          and(
            eq(organizations.id, organizationId),
            eq(organizations.isClaimed, false)
          )
        )
        .returning();

      // If no rows updated, org doesn't exist or was already claimed
      if (!updatedOrg) {
        return null;
      }

      // Make user admin of the organization
      await tx
        .update(users)
        .set({ isAdmin: true })
        .where(eq(users.id, userId));

      await tx
        .insert(organizationAdmins)
        .values({ userId, organizationId, role: 'admin' });

      return updatedOrg;
    });
  }

  // Organization Admin Management
  async assignOrganizationAdmin(userId: string, organizationId: string, role: string = "admin"): Promise<OrganizationAdmin> {
    // Use transaction to ensure both operations succeed or fail together
    const result = await db.transaction(async (tx) => {
      // First, ensure the user's isAdmin flag is set to true
      await tx
        .update(users)
        .set({ isAdmin: true })
        .where(eq(users.id, userId));
      
      // Then assign the organization admin role
      const [adminRole] = await tx
        .insert(organizationAdmins)
        .values({ userId, organizationId, role })
        .returning();
      
      return adminRole;
    });
    
    return result;
  }

  async removeOrganizationAdmin(userId: string, organizationId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // Remove the organization admin assignment
      await tx
        .delete(organizationAdmins)
        .where(
          and(
            eq(organizationAdmins.userId, userId),
            eq(organizationAdmins.organizationId, organizationId)
          )
        );
      
      // Check if user has any remaining org admin assignments
      const remainingAdminRoles = await tx
        .select()
        .from(organizationAdmins)
        .where(eq(organizationAdmins.userId, userId));
      
      // If no remaining admin roles, unset the isAdmin flag
      // NOTE: Per current requirements, "all tournament users are admins"
      // This logic ensures data consistency for future role-based access
      if (remainingAdminRoles.length === 0) {
        await tx
          .update(users)
          .set({ isAdmin: false })
          .where(eq(users.id, userId));
      }
    });
  }

  async getOrganizationAdmins(organizationId: string): Promise<{ id: string; userId: string; organizationId: string; role: string; createdAt: Date; email: string | null; firstName: string | null; lastName: string | null }[]> {
    const results = await db
      .select({
        id: organizationAdmins.id,
        userId: organizationAdmins.userId,
        organizationId: organizationAdmins.organizationId,
        role: organizationAdmins.role,
        createdAt: organizationAdmins.createdAt,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(organizationAdmins)
      .leftJoin(users, eq(organizationAdmins.userId, users.id))
      .where(eq(organizationAdmins.organizationId, organizationId));
    return results;
  }

  async isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(organizationAdmins)
      .where(
        and(
          eq(organizationAdmins.userId, userId),
          eq(organizationAdmins.organizationId, organizationId)
        )
      );
    return !!result;
  }

  async getAllOrganizationAdmins(): Promise<OrganizationAdmin[]> {
    return await db.select().from(organizationAdmins);
  }

  // Feature Flag Management
  async getFeatureFlags(): Promise<FeatureFlag[]> {
    return await db.select().from(featureFlags);
  }

  async getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined> {
    const [flag] = await db.select().from(featureFlags)
      .where(eq(featureFlags.featureKey, featureKey));
    return flag;
  }

  async updateFeatureFlag(id: string, updates: Partial<InsertFeatureFlag>): Promise<FeatureFlag> {
    const [updatedFlag] = await db.update(featureFlags)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, id))
      .returning();
    
    if (!updatedFlag) {
      throw new Error('Feature flag not found');
    }

    return updatedFlag;
  }

  async getOrganizationFeatureFlags(organizationId: string): Promise<OrganizationFeatureFlag[]> {
    return await db.select()
      .from(organizationFeatureFlags)
      .where(eq(organizationFeatureFlags.organizationId, organizationId));
  }

  async setOrganizationFeatureFlag(organizationId: string, featureFlagId: string, isEnabled: boolean): Promise<OrganizationFeatureFlag> {
    const [existing] = await db.select()
      .from(organizationFeatureFlags)
      .where(
        and(
          eq(organizationFeatureFlags.organizationId, organizationId),
          eq(organizationFeatureFlags.featureFlagId, featureFlagId)
        )
      );

    if (existing) {
      const [updated] = await db.update(organizationFeatureFlags)
        .set({
          isEnabled,
          updatedAt: new Date(),
        })
        .where(eq(organizationFeatureFlags.id, existing.id))
        .returning();
      
      if (!updated) {
        throw new Error('Failed to update organization feature flag');
      }

      return updated;
    } else {
      const [inserted] = await db.insert(organizationFeatureFlags)
        .values({
          organizationId,
          featureFlagId,
          isEnabled,
        })
        .returning();
      
      if (!inserted) {
        throw new Error('Failed to create organization feature flag');
      }

      return inserted;
    }
  }

  async removeOrganizationFeatureFlag(organizationId: string, featureFlagId: string): Promise<void> {
    await db.delete(organizationFeatureFlags)
      .where(
        and(
          eq(organizationFeatureFlags.organizationId, organizationId),
          eq(organizationFeatureFlags.featureFlagId, featureFlagId)
        )
      );
  }

  async isFeatureEnabledForOrganization(organizationId: string, featureKey: string): Promise<boolean> {
    const [globalFlag] = await db.select()
      .from(featureFlags)
      .where(eq(featureFlags.featureKey, featureKey));

    if (!globalFlag || !globalFlag.isEnabled) {
      return false;
    }

    const [orgFlag] = await db.select()
      .from(organizationFeatureFlags)
      .innerJoin(featureFlags, eq(organizationFeatureFlags.featureFlagId, featureFlags.id))
      .where(
        and(
          eq(organizationFeatureFlags.organizationId, organizationId),
          eq(featureFlags.featureKey, featureKey)
        )
      );

    if (orgFlag) {
      return orgFlag.organization_feature_flags.isEnabled;
    }

    return true;
  }

  // Admin Request Management
  async createAdminRequest(request: InsertAdminRequest): Promise<AdminRequest> {
    const [result] = await db.insert(adminRequests).values(request).returning();
    return result;
  }

  async getAdminRequests(status?: string): Promise<AdminRequest[]> {
    if (status) {
      return await db.select().from(adminRequests)
        .where(eq(adminRequests.status, status))
        .orderBy(sql`${adminRequests.createdAt} DESC`);
    }
    
    return await db.select().from(adminRequests).orderBy(sql`${adminRequests.createdAt} DESC`);
  }

  async approveAdminRequest(requestId: string, reviewerId: string): Promise<AdminRequest> {
    const [request] = await db.select().from(adminRequests)
      .where(eq(adminRequests.id, requestId));
    
    if (!request) {
      throw new Error('Admin request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Admin request has already been processed');
    }

    return await db.transaction(async (tx) => {
      const [newOrganization] = await tx.insert(organizations).values({
        name: request.organizationName,
        slug: request.organizationSlug,
        description: request.organizationDescription,
        logoUrl: request.logoUrl,
        primaryColor: request.primaryColor || '#22c55e',
        secondaryColor: request.secondaryColor || '#ffffff',
        websiteUrl: request.websiteUrl,
        contactEmail: request.contactEmail,
        timezone: request.timezone || 'America/Toronto',
        defaultPrimaryColor: request.primaryColor || '#22c55e',
        defaultSecondaryColor: request.secondaryColor || '#ffffff',
        defaultPlayoffFormat: request.defaultPlayoffFormat || 'top_6',
        defaultSeedingPattern: request.defaultSeedingPattern || 'standard',
      }).returning();

      if (!newOrganization) {
        throw new Error('Failed to create organization');
      }

      await tx.update(users)
        .set({ isAdmin: true })
        .where(eq(users.id, request.userId));

      await tx.insert(organizationAdmins).values({
        userId: request.userId,
        organizationId: newOrganization.id,
        role: 'admin',
      });

      const [updatedRequest] = await tx.update(adminRequests)
        .set({
          status: 'approved',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          organizationId: newOrganization.id,
        })
        .where(eq(adminRequests.id, requestId))
        .returning();

      if (!updatedRequest) {
        throw new Error('Failed to update admin request');
      }

      return updatedRequest;
    });
  }

  async rejectAdminRequest(requestId: string, reviewerId: string): Promise<AdminRequest> {
    const [request] = await db.select().from(adminRequests)
      .where(eq(adminRequests.id, requestId));
    
    if (!request) {
      throw new Error('Admin request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Admin request has already been processed');
    }

    const [updatedRequest] = await db.update(adminRequests)
      .set({
        status: 'rejected',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(eq(adminRequests.id, requestId))
      .returning();

    if (!updatedRequest) {
      throw new Error('Failed to update admin request');
    }

    return updatedRequest;
  }

  // Organization Coordinator Management
  async getOrganizationCoordinators(organizationId: string, role?: string): Promise<OrganizationCoordinator[]> {
    const conditions = [eq(organizationCoordinators.organizationId, organizationId)];
    if (role) {
      conditions.push(eq(organizationCoordinators.role, role));
    }
    return await db.select().from(organizationCoordinators).where(and(...conditions));
  }

  async getCoordinatorByRole(organizationId: string, role: string): Promise<OrganizationCoordinator | undefined> {
    const [coordinator] = await db.select().from(organizationCoordinators).where(
      and(
        eq(organizationCoordinators.organizationId, organizationId),
        eq(organizationCoordinators.role, role)
      )
    );
    return coordinator;
  }

  async createOrganizationCoordinator(coordinator: InsertOrganizationCoordinator): Promise<OrganizationCoordinator> {
    const [result] = await db.insert(organizationCoordinators).values(coordinator).returning();
    return result;
  }

  async updateOrganizationCoordinator(id: string, coordinator: Partial<InsertOrganizationCoordinator>, organizationId: string): Promise<OrganizationCoordinator> {
    const [result] = await db.update(organizationCoordinators).set({
      ...coordinator,
      updatedAt: new Date(),
    }).where(and(
      eq(organizationCoordinators.id, id),
      eq(organizationCoordinators.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Coordinator not found or access denied");
    }
    
    return result;
  }

  async deleteOrganizationCoordinator(id: string, organizationId: string): Promise<void> {
    await db.delete(organizationCoordinators).where(and(
      eq(organizationCoordinators.id, id),
      eq(organizationCoordinators.organizationId, organizationId)
    ));
  }

  async upsertOrganizationCoordinator(organizationId: string, role: string, coordinator: Partial<InsertOrganizationCoordinator>): Promise<OrganizationCoordinator> {
    const existing = await this.getCoordinatorByRole(organizationId, role);
    
    if (existing) {
      return await this.updateOrganizationCoordinator(existing.id, coordinator, organizationId);
    } else {
      return await this.createOrganizationCoordinator({
        ...coordinator as InsertOrganizationCoordinator,
        organizationId,
        role,
      });
    }
  }

  // Coach Invitation Management
  async getCoachInvitations(organizationId: string, status?: string): Promise<CoachInvitation[]> {
    const conditions = [eq(coachInvitations.organizationId, organizationId)];
    if (status) {
      conditions.push(eq(coachInvitations.status, status));
    }
    return await db.select().from(coachInvitations).where(and(...conditions)).orderBy(desc(coachInvitations.createdAt));
  }

  async getCoachInvitationByToken(token: string): Promise<CoachInvitation | undefined> {
    const [invitation] = await db.select().from(coachInvitations).where(eq(coachInvitations.token, token));
    return invitation;
  }

  async getAcceptedCoachInvitations(userId: string): Promise<CoachInvitation[]> {
    return await db.select().from(coachInvitations).where(and(
      eq(coachInvitations.acceptedByUserId, userId),
      eq(coachInvitations.status, 'accepted')
    ));
  }

  async createCoachInvitation(invitation: InsertCoachInvitation): Promise<CoachInvitation> {
    const [result] = await db.insert(coachInvitations).values(invitation).returning();
    return result;
  }

  async updateCoachInvitation(id: string, invitation: Partial<InsertCoachInvitation>, organizationId: string): Promise<CoachInvitation> {
    const [result] = await db.update(coachInvitations).set({
      ...invitation,
      updatedAt: new Date(),
    }).where(and(
      eq(coachInvitations.id, id),
      eq(coachInvitations.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Invitation not found or access denied");
    }
    
    return result;
  }

  async acceptCoachInvitation(token: string, userId: string): Promise<CoachInvitation> {
    const [result] = await db.update(coachInvitations).set({
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedByUserId: userId,
      updatedAt: new Date(),
    }).where(eq(coachInvitations.token, token)).returning();
    
    if (!result) {
      throw new Error("Invitation not found");
    }
    
    return result;
  }

  async revokeCoachInvitation(id: string, organizationId: string): Promise<CoachInvitation> {
    const [result] = await db.update(coachInvitations).set({
      status: 'revoked',
      updatedAt: new Date(),
    }).where(and(
      eq(coachInvitations.id, id),
      eq(coachInvitations.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Invitation not found or access denied");
    }
    
    return result;
  }

  // Admin Invitation Management
  async getAdminInvitations(organizationId: string, status?: string): Promise<AdminInvitation[]> {
    const conditions = [eq(adminInvitations.organizationId, organizationId)];
    if (status) {
      conditions.push(eq(adminInvitations.status, status));
    }
    return await db.select().from(adminInvitations).where(and(...conditions)).orderBy(desc(adminInvitations.createdAt));
  }

  async getAdminInvitationByToken(token: string): Promise<AdminInvitation | undefined> {
    const [invitation] = await db.select().from(adminInvitations).where(eq(adminInvitations.token, token));
    return invitation;
  }

  async createAdminInvitation(invitation: InsertAdminInvitation): Promise<AdminInvitation> {
    const [result] = await db.insert(adminInvitations).values(invitation).returning();
    return result;
  }

  async acceptAdminInvitation(token: string, userId: string): Promise<AdminInvitation> {
    const [result] = await db.update(adminInvitations).set({
      status: 'accepted',
      acceptedAt: new Date(),
      acceptedByUserId: userId,
      updatedAt: new Date(),
    }).where(eq(adminInvitations.token, token)).returning();
    
    if (!result) {
      throw new Error("Invitation not found");
    }
    
    return result;
  }

  async revokeAdminInvitation(id: string, organizationId: string): Promise<AdminInvitation> {
    const [result] = await db.update(adminInvitations).set({
      status: 'revoked',
      updatedAt: new Date(),
    }).where(and(
      eq(adminInvitations.id, id),
      eq(adminInvitations.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Invitation not found or access denied");
    }
    
    return result;
  }
}

export const organizationService = new OrganizationService();
