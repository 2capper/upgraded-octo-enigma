import { db } from "../db";
import {
  diamonds,
  houseLeagueTeams,
  bookingRequests,
  bookingApprovals,
  diamondRestrictions,
  organizationIcalFeeds,
  externalCalendarEvents,
  type Diamond,
  type InsertDiamond,
  type HouseLeagueTeam,
  type InsertHouseLeagueTeam,
  type BookingRequest,
  type InsertBookingRequest,
  type BookingApproval,
  type InsertBookingApproval,
  type DiamondRestriction,
  type InsertDiamondRestriction,
  type OrganizationIcalFeed,
  type InsertOrganizationIcalFeed,
  type ExternalCalendarEvent,
  type InsertExternalCalendarEvent,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export class DiamondService {
  // Diamond CRUD
  async getDiamonds(organizationId: string): Promise<Diamond[]> {
    return await db.select().from(diamonds).where(eq(diamonds.organizationId, organizationId));
  }

  async getDiamond(id: string): Promise<Diamond | undefined> {
    const result = await db.select().from(diamonds).where(eq(diamonds.id, id));
    return result[0];
  }

  async createDiamond(diamond: InsertDiamond): Promise<Diamond> {
    const result = await db.insert(diamonds).values(diamond).returning();
    return result[0];
  }

  async updateDiamond(id: string, diamond: Partial<InsertDiamond>): Promise<Diamond> {
    const result = await db.update(diamonds).set(diamond).where(eq(diamonds.id, id)).returning();
    return result[0];
  }

  async deleteDiamond(id: string): Promise<void> {
    await db.delete(diamonds).where(eq(diamonds.id, id));
  }

  // House League Team Management
  async getHouseLeagueTeams(organizationId: string): Promise<HouseLeagueTeam[]> {
    return await db.select().from(houseLeagueTeams).where(eq(houseLeagueTeams.organizationId, organizationId));
  }

  async getHouseLeagueTeam(id: string, organizationId?: string): Promise<HouseLeagueTeam | undefined> {
    const conditions = [eq(houseLeagueTeams.id, id)];
    if (organizationId) {
      conditions.push(eq(houseLeagueTeams.organizationId, organizationId));
    }
    const [team] = await db.select().from(houseLeagueTeams).where(and(...conditions));
    return team;
  }

  async getHouseLeagueTeamByToken(token: string): Promise<HouseLeagueTeam | undefined> {
    const [team] = await db.select().from(houseLeagueTeams).where(eq(houseLeagueTeams.calendarSubscriptionToken, token));
    return team;
  }

  async createHouseLeagueTeam(team: InsertHouseLeagueTeam): Promise<HouseLeagueTeam> {
    const [result] = await db.insert(houseLeagueTeams).values(team).returning();
    return result;
  }

  async updateHouseLeagueTeam(id: string, team: Partial<InsertHouseLeagueTeam>, organizationId: string): Promise<HouseLeagueTeam> {
    const [result] = await db.update(houseLeagueTeams).set({
      ...team,
      updatedAt: new Date(),
    }).where(and(
      eq(houseLeagueTeams.id, id),
      eq(houseLeagueTeams.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Team not found or access denied");
    }
    
    return result;
  }

  async deleteHouseLeagueTeam(id: string, organizationId: string): Promise<void> {
    const result = await db.delete(houseLeagueTeams).where(and(
      eq(houseLeagueTeams.id, id),
      eq(houseLeagueTeams.organizationId, organizationId)
    )).returning();
    
    if (result.length === 0) {
      throw new Error("Team not found or access denied");
    }
  }

  // Booking Request Management
  async getBookingRequests(
    organizationId: string, 
    filters: { status?: string, teamId?: string, startDate?: string, endDate?: string }
  ): Promise<BookingRequest[]> {
    const conditions = [eq(bookingRequests.organizationId, organizationId)];
    
    if (filters.status) {
      conditions.push(eq(bookingRequests.status, filters.status));
    }
    if (filters.teamId) {
      conditions.push(eq(bookingRequests.houseLeagueTeamId, filters.teamId));
    }
    if (filters.startDate) {
      conditions.push(sql`${bookingRequests.date} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${bookingRequests.date} <= ${filters.endDate}`);
    }

    return await db.select().from(bookingRequests).where(and(...conditions));
  }

  async getBookingRequest(id: string, organizationId?: string): Promise<BookingRequest | undefined> {
    const conditions = [eq(bookingRequests.id, id)];
    if (organizationId) {
      conditions.push(eq(bookingRequests.organizationId, organizationId));
    }
    const [request] = await db.select().from(bookingRequests).where(and(...conditions));
    return request;
  }

  async getBookingApprovals(requestId: string, organizationId?: string): Promise<BookingApproval[]> {
    const conditions = [eq(bookingApprovals.bookingRequestId, requestId)];
    
    if (organizationId) {
      const request = await this.getBookingRequest(requestId, organizationId);
      if (!request) {
        return [];
      }
    }
    
    return await db.select().from(bookingApprovals)
      .where(and(...conditions))
      .orderBy(bookingApprovals.createdAt);
  }

  async createBookingRequest(request: InsertBookingRequest): Promise<BookingRequest> {
    const [result] = await db.insert(bookingRequests).values(request).returning();
    return result;
  }

  async updateBookingRequest(id: string, request: Partial<InsertBookingRequest>, organizationId: string): Promise<BookingRequest> {
    const [result] = await db.update(bookingRequests).set({
      ...request,
      updatedAt: new Date(),
    }).where(and(
      eq(bookingRequests.id, id),
      eq(bookingRequests.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Booking request not found or access denied");
    }
    
    return result;
  }

  async submitBookingRequest(id: string, userId: string, organizationId: string): Promise<BookingRequest> {
    const [result] = await db.update(bookingRequests).set({
      status: 'submitted',
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(
      eq(bookingRequests.id, id),
      eq(bookingRequests.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Booking request not found or access denied");
    }
    
    return result;
  }

  async cancelBookingRequest(id: string, organizationId: string): Promise<BookingRequest> {
    const [result] = await db.update(bookingRequests).set({
      status: 'cancelled',
      updatedAt: new Date(),
    }).where(and(
      eq(bookingRequests.id, id),
      eq(bookingRequests.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("Booking request not found or access denied");
    }
    
    return result;
  }

  async processBookingApproval(
    requestId: string, 
    approval: InsertBookingApproval,
    organizationId: string
  ): Promise<{ request: BookingRequest, approval: BookingApproval }> {
    return await db.transaction(async (tx) => {
      const [currentRequest] = await tx.select().from(bookingRequests).where(and(
        eq(bookingRequests.id, requestId),
        eq(bookingRequests.organizationId, organizationId)
      ));
      
      if (!currentRequest) {
        throw new Error("Booking request not found or access denied");
      }

      let newStatus: string;
      let confirmedAt: Date | undefined = undefined;

      if (approval.decision === 'declined') {
        newStatus = 'declined';
      } else if (approval.approverRole === 'select_coordinator') {
        if (currentRequest.status !== 'submitted') {
          throw new Error("Can only approve submitted booking requests");
        }
        newStatus = 'select_coordinator_approved';
      } else if (approval.approverRole === 'diamond_coordinator') {
        if (currentRequest.status !== 'select_coordinator_approved') {
          throw new Error("Booking request must be approved by select coordinator first");
        }
        newStatus = 'diamond_coordinator_approved';
        confirmedAt = new Date();
      } else {
        throw new Error(`Invalid approver role: ${approval.approverRole}`);
      }

      const [updatedRequest] = await tx.update(bookingRequests).set({
        status: newStatus,
        confirmedAt,
        updatedAt: new Date(),
      }).where(eq(bookingRequests.id, requestId)).returning();

      const [createdApproval] = await tx.insert(bookingApprovals).values({
        ...approval,
        bookingRequestId: requestId,
      }).returning();

      return {
        request: updatedRequest,
        approval: createdApproval,
      };
    });
  }

  // Diamond Restriction Management
  async getDiamondRestrictions(organizationId: string): Promise<DiamondRestriction[]> {
    return await db.select().from(diamondRestrictions).where(eq(diamondRestrictions.organizationId, organizationId));
  }

  async createDiamondRestriction(restriction: InsertDiamondRestriction): Promise<DiamondRestriction> {
    const [result] = await db.insert(diamondRestrictions).values(restriction).returning();
    return result;
  }

  async updateDiamondRestriction(id: string, restriction: Partial<InsertDiamondRestriction>): Promise<DiamondRestriction> {
    const [result] = await db.update(diamondRestrictions).set({
      ...restriction,
      updatedAt: new Date(),
    }).where(eq(diamondRestrictions.id, id)).returning();
    return result;
  }

  async deleteDiamondRestriction(id: string): Promise<void> {
    await db.delete(diamondRestrictions).where(eq(diamondRestrictions.id, id));
  }

  async validateDiamondRestriction(organizationId: string, division: string, diamondId: string): Promise<boolean> {
    const [restriction] = await db.select().from(diamondRestrictions).where(
      and(
        eq(diamondRestrictions.organizationId, organizationId),
        eq(diamondRestrictions.division, division)
      )
    );

    if (!restriction) {
      return true;
    }

    const [diamond] = await db.select().from(diamonds).where(eq(diamonds.id, diamondId));
    if (!diamond) {
      return false;
    }

    return restriction.allowedDiamonds.includes(diamond.name);
  }

  // Organization iCal Feed Management
  async getOrganizationIcalFeeds(organizationId: string): Promise<OrganizationIcalFeed[]> {
    return await db.select().from(organizationIcalFeeds).where(eq(organizationIcalFeeds.organizationId, organizationId));
  }

  async getOrganizationIcalFeed(id: string, organizationId?: string): Promise<OrganizationIcalFeed | undefined> {
    const conditions = [eq(organizationIcalFeeds.id, id)];
    if (organizationId) {
      conditions.push(eq(organizationIcalFeeds.organizationId, organizationId));
    }
    const [feed] = await db.select().from(organizationIcalFeeds).where(and(...conditions));
    return feed;
  }

  async createOrganizationIcalFeed(feed: InsertOrganizationIcalFeed): Promise<OrganizationIcalFeed> {
    const [result] = await db.insert(organizationIcalFeeds).values(feed).returning();
    return result;
  }

  async updateOrganizationIcalFeed(id: string, feed: Partial<InsertOrganizationIcalFeed>, organizationId: string): Promise<OrganizationIcalFeed> {
    const [result] = await db.update(organizationIcalFeeds).set({
      ...feed,
      updatedAt: new Date(),
    }).where(and(
      eq(organizationIcalFeeds.id, id),
      eq(organizationIcalFeeds.organizationId, organizationId)
    )).returning();
    
    if (!result) {
      throw new Error("iCal feed not found or access denied");
    }
    
    return result;
  }

  async deleteOrganizationIcalFeed(id: string, organizationId: string): Promise<void> {
    await db.delete(organizationIcalFeeds).where(and(
      eq(organizationIcalFeeds.id, id),
      eq(organizationIcalFeeds.organizationId, organizationId)
    ));
  }

  // External Calendar Event Management
  async getExternalCalendarEvents(organizationId: string, filters?: { icalFeedId?: string, startDate?: string, endDate?: string, diamondId?: string }): Promise<ExternalCalendarEvent[]> {
    const conditions = [eq(externalCalendarEvents.organizationId, organizationId)];
    
    if (filters?.icalFeedId) {
      conditions.push(eq(externalCalendarEvents.icalFeedId, filters.icalFeedId));
    }
    if (filters?.diamondId) {
      conditions.push(eq(externalCalendarEvents.diamondId, filters.diamondId));
    }
    if (filters?.startDate) {
      conditions.push(sql`${externalCalendarEvents.startDate} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${externalCalendarEvents.endDate} <= ${filters.endDate}`);
    }
    
    return await db.select().from(externalCalendarEvents).where(and(...conditions));
  }

  async getExternalCalendarEvent(id: string): Promise<ExternalCalendarEvent | undefined> {
    const [event] = await db.select().from(externalCalendarEvents).where(eq(externalCalendarEvents.id, id));
    return event;
  }

  async createExternalCalendarEvent(event: InsertExternalCalendarEvent): Promise<ExternalCalendarEvent> {
    const [result] = await db.insert(externalCalendarEvents).values(event).returning();
    return result;
  }

  async updateExternalCalendarEvent(id: string, event: Partial<InsertExternalCalendarEvent>): Promise<ExternalCalendarEvent> {
    const [result] = await db.update(externalCalendarEvents).set({
      ...event,
      updatedAt: new Date(),
    }).where(eq(externalCalendarEvents.id, id)).returning();
    
    if (!result) {
      throw new Error("External calendar event not found");
    }
    
    return result;
  }

  async deleteExternalCalendarEvent(id: string): Promise<void> {
    await db.delete(externalCalendarEvents).where(eq(externalCalendarEvents.id, id));
  }

  async upsertExternalCalendarEvent(event: InsertExternalCalendarEvent): Promise<ExternalCalendarEvent> {
    const [result] = await db
      .insert(externalCalendarEvents)
      .values(event)
      .onConflictDoUpdate({
        target: [externalCalendarEvents.icalFeedId, externalCalendarEvents.externalEventId],
        set: {
          ...event,
          lastSyncedAt: new Date(),
          updatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  async deleteExternalCalendarEventsByFeed(icalFeedId: string): Promise<void> {
    await db.delete(externalCalendarEvents).where(eq(externalCalendarEvents.icalFeedId, icalFeedId));
  }
}

export const diamondService = new DiamondService();
