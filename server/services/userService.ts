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
}

export const userService = new UserService();
