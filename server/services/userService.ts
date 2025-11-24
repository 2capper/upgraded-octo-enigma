import { db } from "../db";
import { 
  users, 
  organizationAdmins,
  organizations,
  adminRequests,
  organizationCoordinators,
  type User,
  type UpsertUser,
  type Organization,
  type AdminRequest,
  type OrganizationCoordinator,
} from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

export class UserService {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserOrganizations(userId: string): Promise<Organization[]> {
    const adminRecords = await db
      .select()
      .from(organizationAdmins)
      .where(eq(organizationAdmins.userId, userId));
    
    if (adminRecords.length === 0) {
      return [];
    }
    
    const orgIds = adminRecords.map(record => record.organizationId);
    return await db
      .select()
      .from(organizations)
      .where(inArray(organizations.id, orgIds));
  }

  async isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean> {
    const [record] = await db
      .select()
      .from(organizationAdmins)
      .where(
        sql`${organizationAdmins.userId} = ${userId} AND ${organizationAdmins.organizationId} = ${organizationId}`
      );
    return !!record;
  }

  async getUserAdminRequest(userId: string): Promise<AdminRequest | undefined> {
    const [request] = await db.select().from(adminRequests)
      .where(eq(adminRequests.userId, userId))
      .orderBy(sql`${adminRequests.createdAt} DESC`)
      .limit(1);
    return request;
  }

  async getUserCoordinatorAssignments(userId: string): Promise<OrganizationCoordinator[]> {
    return await db.select().from(organizationCoordinators).where(
      eq(organizationCoordinators.userId, userId)
    );
  }

  async updateUserAdminStatus(userId: string, isAdmin: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  async updateUserSuperAdminStatus(userId: string, isSuperAdmin: boolean): Promise<User> {
    // When promoting to super admin, set isAdmin=true
    // When demoting from super admin, check if user has any org admin roles
    let shouldBeAdmin = isSuperAdmin;
    
    if (!isSuperAdmin) {
      // Check if user is admin of any organization
      const orgAdminCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(organizationAdmins)
        .where(eq(organizationAdmins.userId, userId));
      
      // Keep isAdmin=true if they're still admin of at least one org
      shouldBeAdmin = orgAdminCount[0]?.count > 0;
    }
    
    const [user] = await db
      .update(users)
      .set({ 
        isSuperAdmin, 
        isAdmin: shouldBeAdmin, // Explicitly set true or false
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }
}

export const userService = new UserService();
