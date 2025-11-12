import { 
  users, 
  organizations,
  organizationAdmins,
  organizationFeatureFlags,
  diamonds,
  tournaments, 
  ageDivisions, 
  pools, 
  teams, 
  matchups,
  games,
  auditLogs,
  adminRequests,
  featureFlags,
  houseLeagueTeams,
  bookingRequests,
  bookingApprovals,
  diamondRestrictions,
  organizationIcalFeeds,
  externalCalendarEvents,
  organizationCoordinators,
  coachInvitations,
  type User, 
  type InsertUser,
  type UpsertUser,
  type Organization,
  type InsertOrganization,
  type OrganizationAdmin,
  type InsertOrganizationAdmin,
  type OrganizationFeatureFlag,
  type InsertOrganizationFeatureFlag,
  type Diamond,
  type InsertDiamond,
  type Tournament,
  type InsertTournament,
  type AgeDivision,
  type InsertAgeDivision,
  type Pool,
  type InsertPool,
  type Team,
  type InsertTeam,
  type Matchup,
  type InsertMatchup,
  type Game,
  type InsertGame,
  type AuditLog,
  type InsertAuditLog,
  type GameUpdate,
  type AdminRequest,
  type InsertAdminRequest,
  type FeatureFlag,
  type InsertFeatureFlag,
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
  type OrganizationCoordinator,
  type InsertOrganizationCoordinator,
  type CoachInvitation,
  type InsertCoachInvitation,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, inArray, desc, asc } from "drizzle-orm";
import { generateBracketGames, getPlayoffTeamsFromStandings, updateBracketProgression } from "@shared/bracketGeneration";
import { calculateStats, resolveTie } from "@shared/standings";
import { withRetry } from "./dbRetry";

export interface IStorage {
  // User methods - required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Organization methods
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  getOrganizationByToken(token: string): Promise<Organization | undefined>;
  createOrganization(organization: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, organization: Partial<InsertOrganization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;
  
  // Organization admin methods
  assignOrganizationAdmin(userId: string, organizationId: string, role?: string): Promise<OrganizationAdmin>;
  removeOrganizationAdmin(userId: string, organizationId: string): Promise<void>;
  getOrganizationAdmins(organizationId: string): Promise<OrganizationAdmin[]>;
  getUserOrganizations(userId: string): Promise<Organization[]>;
  isOrganizationAdmin(userId: string, organizationId: string): Promise<boolean>;
  
  // Diamond methods
  getDiamonds(organizationId: string): Promise<Diamond[]>;
  getDiamond(id: string): Promise<Diamond | undefined>;
  createDiamond(diamond: InsertDiamond): Promise<Diamond>;
  updateDiamond(id: string, diamond: Partial<InsertDiamond>): Promise<Diamond>;
  deleteDiamond(id: string): Promise<void>;
  
  // Tournament methods
  getTournaments(organizationId?: string): Promise<Tournament[]>;
  getTournament(id: string): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: string, tournament: Partial<InsertTournament>): Promise<Tournament>;
  deleteTournament(id: string): Promise<void>;
  
  // Age Division methods
  getAgeDivisions(tournamentId: string): Promise<AgeDivision[]>;
  createAgeDivision(ageDivision: InsertAgeDivision): Promise<AgeDivision>;
  updateAgeDivision(id: string, ageDivision: Partial<InsertAgeDivision>): Promise<AgeDivision | undefined>;
  
  // Pool methods
  getPools(tournamentId: string): Promise<Pool[]>;
  getPoolById(id: string): Promise<Pool | undefined>;
  createPool(pool: InsertPool): Promise<Pool>;
  deletePool(id: string): Promise<void>;
  
  // Matchup methods
  getMatchups(tournamentId: string, poolId?: string): Promise<Matchup[]>;
  replaceMatchups(tournamentId: string, poolId: string, matchups: InsertMatchup[]): Promise<Matchup[]>;
  
  // Team methods
  getTeams(tournamentId: string): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  updateTeamRoster(id: string, rosterData: string): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  
  // Game methods
  getGame(id: string): Promise<Game | undefined>;
  getGames(tournamentId: string): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>): Promise<Game>;
  updateGameWithAudit(id: string, updates: GameUpdate, userId: string, metadata?: any): Promise<Game>;
  deleteGame(id: string): Promise<void>;
  
  // Audit log methods
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]>;
  
  // Admin request methods
  createAdminRequest(request: InsertAdminRequest): Promise<AdminRequest>;
  getAdminRequests(status?: string): Promise<AdminRequest[]>;
  getUserAdminRequest(userId: string): Promise<AdminRequest | undefined>;
  approveAdminRequest(requestId: string, reviewerId: string): Promise<AdminRequest>;
  rejectAdminRequest(requestId: string, reviewerId: string): Promise<AdminRequest>;
  
  // Feature flag methods
  getFeatureFlags(): Promise<FeatureFlag[]>;
  getFeatureFlag(featureKey: string): Promise<FeatureFlag | undefined>;
  updateFeatureFlag(id: string, updates: Partial<InsertFeatureFlag>): Promise<FeatureFlag>;
  
  // Organization feature flag methods
  getOrganizationFeatureFlags(organizationId: string): Promise<OrganizationFeatureFlag[]>;
  setOrganizationFeatureFlag(organizationId: string, featureFlagId: string, isEnabled: boolean): Promise<OrganizationFeatureFlag>;
  removeOrganizationFeatureFlag(organizationId: string, featureFlagId: string): Promise<void>;
  isFeatureEnabledForOrganization(organizationId: string, featureKey: string): Promise<boolean>;
  
  // Bulk operations
  bulkCreateTeams(teams: InsertTeam[]): Promise<Team[]>;
  bulkCreateGames(games: InsertGame[]): Promise<Game[]>;
  bulkCreateOrUpdateTeamsFromRegistrations(teams: any[]): Promise<Team[]>;
  clearTournamentData(tournamentId: string): Promise<void>;
  
  // Playoff bracket generation
  generatePlayoffBracket(tournamentId: string, divisionId: string): Promise<Game[]>;
  savePlayoffSlots(tournamentId: string, divisionId: string, slots: Record<string, { date: string; time: string; diamondId: string; }>): Promise<Game[]>;
  
  // House League Team methods
  getHouseLeagueTeams(organizationId: string): Promise<HouseLeagueTeam[]>;
  getHouseLeagueTeam(id: string, organizationId?: string): Promise<HouseLeagueTeam | undefined>;
  getHouseLeagueTeamByToken(token: string): Promise<HouseLeagueTeam | undefined>;
  createHouseLeagueTeam(team: InsertHouseLeagueTeam): Promise<HouseLeagueTeam>;
  updateHouseLeagueTeam(id: string, team: Partial<InsertHouseLeagueTeam>, organizationId: string): Promise<HouseLeagueTeam>;
  deleteHouseLeagueTeam(id: string, organizationId: string): Promise<void>;
  
  // Booking Request methods
  getBookingRequests(organizationId: string, filters: { status?: string, teamId?: string, startDate?: string, endDate?: string }): Promise<BookingRequest[]>;
  getBookingRequest(id: string, organizationId?: string): Promise<BookingRequest | undefined>;
  getBookingApprovals(requestId: string, organizationId?: string): Promise<BookingApproval[]>;
  createBookingRequest(request: InsertBookingRequest): Promise<BookingRequest>;
  updateBookingRequest(id: string, request: Partial<InsertBookingRequest>, organizationId: string): Promise<BookingRequest>;
  submitBookingRequest(id: string, userId: string, organizationId: string): Promise<BookingRequest>;
  cancelBookingRequest(id: string, organizationId: string): Promise<BookingRequest>;
  processBookingApproval(requestId: string, approval: InsertBookingApproval, organizationId: string): Promise<{ request: BookingRequest, approval: BookingApproval }>;
  
  // Diamond Restriction methods
  getDiamondRestrictions(organizationId: string): Promise<DiamondRestriction[]>;
  createDiamondRestriction(restriction: InsertDiamondRestriction): Promise<DiamondRestriction>;
  updateDiamondRestriction(id: string, restriction: Partial<InsertDiamondRestriction>): Promise<DiamondRestriction>;
  deleteDiamondRestriction(id: string): Promise<void>;
  validateDiamondRestriction(organizationId: string, division: string, diamondId: string): Promise<boolean>;
  
  // Coordinator methods
  getOrganizationCoordinators(organizationId: string, role?: string): Promise<OrganizationCoordinator[]>;
  getCoordinatorByRole(organizationId: string, role: string): Promise<OrganizationCoordinator | undefined>;
  createOrganizationCoordinator(coordinator: InsertOrganizationCoordinator): Promise<OrganizationCoordinator>;
  updateOrganizationCoordinator(id: string, coordinator: Partial<InsertOrganizationCoordinator>, organizationId: string): Promise<OrganizationCoordinator>;
  deleteOrganizationCoordinator(id: string, organizationId: string): Promise<void>;
  upsertOrganizationCoordinator(organizationId: string, role: string, coordinator: Partial<InsertOrganizationCoordinator>): Promise<OrganizationCoordinator>;
  
  // Coach Invitation methods
  getCoachInvitations(organizationId: string, status?: string): Promise<CoachInvitation[]>;
  getCoachInvitationByToken(token: string): Promise<CoachInvitation | undefined>;
  createCoachInvitation(invitation: InsertCoachInvitation): Promise<CoachInvitation>;
  updateCoachInvitation(id: string, invitation: Partial<InsertCoachInvitation>, organizationId: string): Promise<CoachInvitation>;
  acceptCoachInvitation(token: string, userId: string): Promise<CoachInvitation>;
  revokeCoachInvitation(id: string, organizationId: string): Promise<CoachInvitation>;
  
  // Organization iCal Feed methods
  getOrganizationIcalFeeds(organizationId: string): Promise<OrganizationIcalFeed[]>;
  getOrganizationIcalFeed(id: string, organizationId?: string): Promise<OrganizationIcalFeed | undefined>;
  createOrganizationIcalFeed(feed: InsertOrganizationIcalFeed): Promise<OrganizationIcalFeed>;
  updateOrganizationIcalFeed(id: string, feed: Partial<InsertOrganizationIcalFeed>, organizationId: string): Promise<OrganizationIcalFeed>;
  deleteOrganizationIcalFeed(id: string, organizationId: string): Promise<void>;
  
  // External Calendar Event methods
  getExternalCalendarEvents(organizationId: string, filters?: { icalFeedId?: string, startDate?: string, endDate?: string, diamondId?: string }): Promise<ExternalCalendarEvent[]>;
  getExternalCalendarEvent(id: string): Promise<ExternalCalendarEvent | undefined>;
  createExternalCalendarEvent(event: InsertExternalCalendarEvent): Promise<ExternalCalendarEvent>;
  updateExternalCalendarEvent(id: string, event: Partial<InsertExternalCalendarEvent>): Promise<ExternalCalendarEvent>;
  deleteExternalCalendarEvent(id: string): Promise<void>;
  upsertExternalCalendarEvent(event: InsertExternalCalendarEvent): Promise<ExternalCalendarEvent>;
  deleteExternalCalendarEventsByFeed(icalFeedId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods - required for Replit Auth
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

  // Organization methods
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

  // Diamond methods
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

  // Organization admin methods
  async assignOrganizationAdmin(userId: string, organizationId: string, role: string = "admin"): Promise<OrganizationAdmin> {
    const [result] = await db
      .insert(organizationAdmins)
      .values({ userId, organizationId, role })
      .returning();
    return result;
  }

  async removeOrganizationAdmin(userId: string, organizationId: string): Promise<void> {
    await db
      .delete(organizationAdmins)
      .where(
        and(
          eq(organizationAdmins.userId, userId),
          eq(organizationAdmins.organizationId, organizationId)
        )
      );
  }

  async getOrganizationAdmins(organizationId: string): Promise<OrganizationAdmin[]> {
    return await db
      .select()
      .from(organizationAdmins)
      .where(eq(organizationAdmins.organizationId, organizationId));
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

  // Tournament methods
  async getTournaments(organizationId?: string): Promise<Tournament[]> {
    if (organizationId) {
      return await db.select().from(tournaments).where(eq(tournaments.organizationId, organizationId));
    }
    return await db.select().from(tournaments);
  }

  async getTournament(id: string): Promise<Tournament | undefined> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    return tournament || undefined;
  }

  async createTournament(tournament: InsertTournament): Promise<Tournament> {
    const [result] = await db.insert(tournaments).values(tournament).returning();
    return result;
  }

  async updateTournament(id: string, tournament: Partial<InsertTournament>): Promise<Tournament> {
    const [result] = await db.update(tournaments).set(tournament).where(eq(tournaments.id, id)).returning();
    return result;
  }

  async deleteTournament(id: string): Promise<void> {
    await db.delete(tournaments).where(eq(tournaments.id, id));
  }

  // Age Division methods
  async getAgeDivisions(tournamentId: string): Promise<AgeDivision[]> {
    return await db.select().from(ageDivisions).where(eq(ageDivisions.tournamentId, tournamentId));
  }

  async createAgeDivision(ageDivision: InsertAgeDivision): Promise<AgeDivision> {
    const [result] = await db.insert(ageDivisions).values(ageDivision).returning();
    return result;
  }

  async updateAgeDivision(id: string, ageDivision: Partial<InsertAgeDivision>): Promise<AgeDivision | undefined> {
    const [result] = await db.update(ageDivisions).set(ageDivision).where(eq(ageDivisions.id, id)).returning();
    return result || undefined;
  }

  // Pool methods
  async getPools(tournamentId: string): Promise<Pool[]> {
    return await db.select().from(pools).where(eq(pools.tournamentId, tournamentId));
  }

  async getPoolById(id: string): Promise<Pool | undefined> {
    const [pool] = await db.select().from(pools).where(eq(pools.id, id));
    return pool || undefined;
  }

  async createPool(pool: InsertPool): Promise<Pool> {
    const [result] = await db.insert(pools).values(pool).returning();
    return result;
  }

  async deletePool(id: string): Promise<void> {
    await db.delete(pools).where(eq(pools.id, id));
  }

  // Matchup methods
  async getMatchups(tournamentId: string, poolId?: string): Promise<Matchup[]> {
    if (poolId) {
      return await db.select().from(matchups)
        .where(and(eq(matchups.tournamentId, tournamentId), eq(matchups.poolId, poolId)));
    }
    return await db.select().from(matchups).where(eq(matchups.tournamentId, tournamentId));
  }

  async replaceMatchups(tournamentId: string, poolId: string, newMatchups: InsertMatchup[]): Promise<Matchup[]> {
    return await db.transaction(async (tx) => {
      // Delete existing matchups for this tournament/pool
      await tx.delete(matchups)
        .where(and(eq(matchups.tournamentId, tournamentId), eq(matchups.poolId, poolId)));
      
      // Insert new matchups
      if (newMatchups.length === 0) {
        return [];
      }
      return await tx.insert(matchups).values(newMatchups).returning();
    });
  }

  // Team methods
  async getTeams(tournamentId: string): Promise<Team[]> {
    const allTeams = await db.select().from(teams).where(eq(teams.tournamentId, tournamentId));
    
    // Filter out placeholder teams for playoff games
    const placeholderPatterns = [
      /^Winner\s+Pool/i,
      /^Loser\s+Pool/i,
      /^Runner-up\s+Pool/i,
      /^Winner\s+of/i,
      /^Loser\s+of/i,
      /^Runner-up\s+of/i,
      /^TBD/i,
      /^To\s+be\s+determined/i,
      /^seed$/i,
      /\bseed\b/i
    ];
    
    return allTeams.filter(team => {
      return !placeholderPatterns.some(pattern => pattern.test(team.name));
    });
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const [team] = await db.select().from(teams).where(eq(teams.id, id));
    return team || undefined;
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const [result] = await db.insert(teams).values(team).returning();
    return result;
  }

  async updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team> {
    return await withRetry(async () => {
      const [result] = await db.update(teams).set(team).where(eq(teams.id, id)).returning();
      return result;
    });
  }

  async updateTeamRoster(id: string, rosterData: string): Promise<Team> {
    const [result] = await db.update(teams)
      .set({ rosterData })
      .where(eq(teams.id, id))
      .returning();
    return result;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  // Game methods
  async getGame(id: string): Promise<Game | undefined> {
    const [result] = await db.select().from(games).where(eq(games.id, id));
    return result;
  }

  async getGames(tournamentId: string): Promise<Game[]> {
    return await db.select().from(games)
      .where(eq(games.tournamentId, tournamentId))
      .orderBy(
        desc(games.isPlayoff),
        asc(games.playoffRound),
        asc(games.playoffGameNumber),
        asc(games.date),
        asc(games.time)
      );
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [result] = await db.insert(games).values(game).returning();
    return result;
  }

  async updateGame(id: string, game: Partial<InsertGame>): Promise<Game> {
    return await withRetry(async () => {
      const [result] = await db.update(games).set(game).where(eq(games.id, id)).returning();
      return result;
    });
  }

  async updateGameWithAudit(id: string, updates: GameUpdate, userId: string, metadata?: any): Promise<Game> {
    // DECOUPLED: This method saves scores and handles playoff winner advancement.
    // Pool play completion no longer triggers automatic bracket generation (use the 
    // explicit "Generate Playoff Bracket" button instead to avoid brittle coupling).
    return await withRetry(async () => {
      return await db.transaction(async (tx) => {
        // Get current game state for audit trail
        const [currentGame] = await tx.select().from(games).where(eq(games.id, id));
        if (!currentGame) {
          throw new Error("Game not found");
        }

        // Perform the update within transaction
        const [updatedGame] = await tx.update(games).set(updates).where(eq(games.id, id)).returning();

        // Create audit log entry within same transaction
        await tx.insert(auditLogs).values({
          userId,
          action: "score_update",
          entityType: "game",
          entityId: id,
          oldValues: {
            homeScore: currentGame.homeScore,
            awayScore: currentGame.awayScore,
            homeInningsBatted: currentGame.homeInningsBatted,
            awayInningsBatted: currentGame.awayInningsBatted,
            status: currentGame.status,
            forfeitStatus: currentGame.forfeitStatus
          },
          newValues: updates,
          metadata
        });

        // Auto-advance winners in playoff brackets (this is expected UX)
        // Ties are allowed - they simply won't trigger advancement
        if (updatedGame.isPlayoff && updatedGame.playoffRound && updatedGame.playoffGameNumber && updatedGame.status === 'completed') {
          // Determine winner and loser
          const homeScore = Number(updatedGame.homeScore) || 0;
          const awayScore = Number(updatedGame.awayScore) || 0;
          
          let winnerId: string | null = null;
          let loserId: string | null = null;
          
          if (updatedGame.forfeitStatus === 'home') {
            winnerId = updatedGame.awayTeamId;
            loserId = updatedGame.homeTeamId;
          } else if (updatedGame.forfeitStatus === 'away') {
            winnerId = updatedGame.homeTeamId;
            loserId = updatedGame.awayTeamId;
          } else if (homeScore > awayScore) {
            winnerId = updatedGame.homeTeamId;
            loserId = updatedGame.awayTeamId;
          } else if (awayScore > homeScore) {
            winnerId = updatedGame.awayTeamId;
            loserId = updatedGame.homeTeamId;
          }
          // If homeScore === awayScore and no forfeit, winnerId/loserId remain null (tie)
          
          // Only advance if we have a clear winner (ties are allowed but don't trigger progression)
          if (winnerId && loserId) {
            // Get the division ID for this game through its pool
            const [currentPool] = await tx.select().from(pools).where(eq(pools.id, updatedGame.poolId));
            if (!currentPool) {
              throw new Error("Pool not found for game");
            }
            const divisionId = currentPool.ageDivisionId;
            
            // Get all playoff games for this tournament and division
            const allPlayoffGames = await tx.select({
              game: games,
              pool: pools
            })
              .from(games)
              .innerJoin(pools, eq(games.poolId, pools.id))
              .where(and(
                eq(games.tournamentId, updatedGame.tournamentId),
                eq(pools.ageDivisionId, divisionId),
                sql`${games.isPlayoff} = true`
              ));
            
            // Find and update next bracket games that depend on this game's winner
            for (const { game: nextGame } of allPlayoffGames) {
              let shouldUpdate = false;
              let newHomeTeamId = nextGame.homeTeamId;
              let newAwayTeamId = nextGame.awayTeamId;
              
              // Check if home team comes from the completed game
              if (nextGame.team1Source) {
                const source = nextGame.team1Source as any;
                if (source.type === 'winner' && 
                    source.gameNumber === updatedGame.playoffGameNumber && 
                    source.round === updatedGame.playoffRound) {
                  newHomeTeamId = winnerId;
                  shouldUpdate = true;
                }
              }
              
              // Check if away team comes from the completed game
              if (nextGame.team2Source) {
                const source = nextGame.team2Source as any;
                if (source.type === 'winner' && 
                    source.gameNumber === updatedGame.playoffGameNumber && 
                    source.round === updatedGame.playoffRound) {
                  newAwayTeamId = winnerId;
                  shouldUpdate = true;
                }
              }
              
              // Update the next game if needed
              if (shouldUpdate) {
                await tx.update(games)
                  .set({
                    homeTeamId: newHomeTeamId,
                    awayTeamId: newAwayTeamId
                  })
                  .where(eq(games.id, nextGame.id));
              }
            }
          }
        }

        return updatedGame;
      });
    });
  }

  async deleteGame(id: string): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  // Audit log methods
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const [result] = await db.insert(auditLogs).values(auditLog).returning();
    return result;
  }

  async getAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    if (entityType && entityId) {
      return await db.select().from(auditLogs)
        .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
        .orderBy(sql`${auditLogs.timestamp} DESC`);
    } else if (entityType) {
      return await db.select().from(auditLogs)
        .where(eq(auditLogs.entityType, entityType))
        .orderBy(sql`${auditLogs.timestamp} DESC`);
    }
    
    return await db.select().from(auditLogs).orderBy(sql`${auditLogs.timestamp} DESC`);
  }

  // Admin request methods
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

  async getUserAdminRequest(userId: string): Promise<AdminRequest | undefined> {
    const [request] = await db.select().from(adminRequests)
      .where(eq(adminRequests.userId, userId))
      .orderBy(sql`${adminRequests.createdAt} DESC`)
      .limit(1);
    return request;
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
      // Create the organization with details from the request
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

      // Grant admin access to the user
      await tx.update(users)
        .set({ isAdmin: true })
        .where(eq(users.id, request.userId));

      // Link user as organization admin
      await tx.insert(organizationAdmins).values({
        userId: request.userId,
        organizationId: newOrganization.id,
        role: 'admin',
      });

      // Update the admin request with approval details
      const [updatedRequest] = await tx.update(adminRequests)
        .set({
          status: 'approved',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          createdOrganizationId: newOrganization.id,
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

  // Feature flag methods
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

  // Organization feature flag methods
  async getOrganizationFeatureFlags(organizationId: string): Promise<OrganizationFeatureFlag[]> {
    return await db.select()
      .from(organizationFeatureFlags)
      .where(eq(organizationFeatureFlags.organizationId, organizationId));
  }

  async setOrganizationFeatureFlag(organizationId: string, featureFlagId: string, isEnabled: boolean): Promise<OrganizationFeatureFlag> {
    // Check if the flag already exists
    const [existing] = await db.select()
      .from(organizationFeatureFlags)
      .where(
        and(
          eq(organizationFeatureFlags.organizationId, organizationId),
          eq(organizationFeatureFlags.featureFlagId, featureFlagId)
        )
      );

    if (existing) {
      // Update existing flag
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
      // Insert new flag
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
    // First check if the global feature flag is enabled
    const [globalFlag] = await db.select()
      .from(featureFlags)
      .where(eq(featureFlags.featureKey, featureKey));

    if (!globalFlag || !globalFlag.isEnabled) {
      // Global flag is disabled, so org-level doesn't matter
      return false;
    }

    // Check if organization has explicitly enabled/disabled this feature
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
      // Organization has explicitly set this flag
      return orgFlag.organization_feature_flags.isEnabled;
    }

    // Organization hasn't set this flag, default to enabled (since global is enabled)
    return true;
  }

  // Bulk operations
  async bulkCreateTeams(teamsList: InsertTeam[]): Promise<Team[]> {
    if (teamsList.length === 0) return [];
    
    const createdTeams: Team[] = [];
    
    // Check each team - if it exists (by name and tournament), update it; otherwise create it
    for (const teamData of teamsList) {
      const existingTeams = await db.select().from(teams)
        .where(and(
          eq(teams.name, teamData.name),
          eq(teams.tournamentId, teamData.tournamentId)
        ));
      
      if (existingTeams.length > 0) {
        // Update existing team with new pool assignment (preserve coach details from registration)
        const [updatedTeam] = await db.update(teams)
          .set({
            poolId: teamData.poolId,
            division: teamData.division,
          })
          .where(eq(teams.id, existingTeams[0].id))
          .returning();
        
        createdTeams.push(updatedTeam);
      } else {
        // Create new team
        const [newTeam] = await db.insert(teams).values(teamData).returning();
        createdTeams.push(newTeam);
      }
    }
    
    return createdTeams;
  }

  async bulkCreateOrUpdateTeamsFromRegistrations(teamsList: any[]): Promise<Team[]> {
    if (teamsList.length === 0) return [];
    
    const createdTeams: Team[] = [];
    
    for (const teamData of teamsList) {
      // For now, create a temporary pool for each division until the Matches CSV is imported
      // This allows teams to exist before we know their pool assignments
      const tempPoolId = `${teamData.tournamentId}_pool_temp_${teamData.division.replace(/\s+/g, '-')}`;
      
      // Check if temp pool exists, if not create it
      let pool = await this.getPoolById(tempPoolId);
      if (!pool) {
        // Create temporary division if needed
        const tempDivisionId = `${teamData.tournamentId}_div_${teamData.division.replace(/\s+/g, '-')}`;
        let division = await db.select().from(ageDivisions).where(eq(ageDivisions.id, tempDivisionId));
        
        if (division.length === 0) {
          await db.insert(ageDivisions).values({
            id: tempDivisionId,
            name: teamData.division,
            tournamentId: teamData.tournamentId
          });
        }
        
        // Create temporary pool
        await db.insert(pools).values({
          id: tempPoolId,
          name: 'Unassigned',
          tournamentId: teamData.tournamentId,
          ageDivisionId: tempDivisionId
        });
      }
      
      // Check if team already exists (by name and tournament)
      const existingTeams = await db.select().from(teams)
        .where(and(
          eq(teams.name, teamData.name),
          eq(teams.tournamentId, teamData.tournamentId)
        ));
      
      if (existingTeams.length > 0) {
        // Update existing team
        const [updatedTeam] = await db.update(teams)
          .set({
            coachFirstName: teamData.coachFirstName,
            coachLastName: teamData.coachLastName,
            coachEmail: teamData.coachEmail,
            phone: teamData.phone,
            teamNumber: teamData.teamNumber,
            rosterLink: teamData.rosterLink,
            registrationStatus: teamData.registrationStatus,
            paymentStatus: teamData.paymentStatus,
            division: teamData.division,
          })
          .where(eq(teams.id, existingTeams[0].id))
          .returning();
        
        createdTeams.push(updatedTeam);
      } else {
        // Create new team
        const teamId = `${teamData.tournamentId}_team_${teamData.division}-${teamData.name.replace(/\s+/g, '-')}`;
        const [newTeam] = await db.insert(teams).values({
          id: teamId,
          name: teamData.name,
          division: teamData.division,
          coach: `${teamData.coachFirstName} ${teamData.coachLastName}`,
          coachFirstName: teamData.coachFirstName,
          coachLastName: teamData.coachLastName,
          coachEmail: teamData.coachEmail,
          phone: teamData.phone,
          teamNumber: teamData.teamNumber,
          rosterLink: teamData.rosterLink,
          tournamentId: teamData.tournamentId,
          poolId: tempPoolId,
          registrationStatus: teamData.registrationStatus,
          paymentStatus: teamData.paymentStatus,
        }).returning();
        
        createdTeams.push(newTeam);
      }
    }
    
    return createdTeams;
  }

  async bulkCreateGames(gamesList: InsertGame[]): Promise<Game[]> {
    if (gamesList.length === 0) return [];
    return await withRetry(async () => {
      return await db.insert(games).values(gamesList).returning();
    });
  }

  async clearTournamentData(tournamentId: string): Promise<void> {
    // Delete games only - preserve teams, pools, and divisions
    // NOTE: This preserves teams from Registrations CSV import
    // Teams will be updated with correct pool assignments when Matches CSV is imported
    // Old/temporary pools and divisions will remain but will be harmless orphans
    await db.delete(games).where(eq(games.tournamentId, tournamentId));
  }

  // Helper function to calculate standings using SP11.2 tie-breaking rules
  private calculateStandingsWithTiebreaking(teams: Team[], games: Game[]): Array<{ teamId: string; teamName: string; poolId: string; rank: number }> {
    // Calculate stats for each team
    const teamStats = teams.map(team => {
      const stats = calculateStats(team.id, games);
      return {
        id: team.id,
        name: team.name,
        poolId: team.poolId,
        ...stats,
        points: (stats.wins * 2) + (stats.ties * 1),
        // Use Infinity for runsAgainstPerInning when no defensive innings (worst rank)
        runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : Infinity,
        // Use 0 for runsForPerInning when no offensive innings (worst rank)
        runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
      };
    });

    // Group teams by points for tie-breaking
    const groups: Record<number, any[]> = {};
    teamStats.forEach(team => {
      const points = team.points;
      if (!groups[points]) groups[points] = [];
      groups[points].push(team);
    });

    // Sort groups by points descending, then resolve ties within each group
    const sortedStandings = Object.keys(groups)
      .sort((a, b) => Number(b) - Number(a))
      .flatMap(points => resolveTie(groups[Number(points)], games));

    // Assign ranks
    return sortedStandings.map((team, index) => ({
      teamId: team.id,
      teamName: team.name,
      poolId: team.poolId,
      rank: index + 1,
    }));
  }

  async generatePlayoffBracket(tournamentId: string, divisionId: string): Promise<Game[]> {
    // Get tournament info
    const tournament = await this.getTournament(tournamentId);
    if (!tournament || !tournament.playoffFormat) {
      throw new Error('Tournament not found or playoff format not configured');
    }

    // Get division info
    const [division] = await db.select().from(ageDivisions).where(eq(ageDivisions.id, divisionId));
    if (!division) {
      throw new Error('Division not found');
    }

    // Get all pools in this division
    const divisionPools = await db.select().from(pools).where(eq(pools.ageDivisionId, divisionId));
    const regularPoolIds = divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).map(p => p.id);

    // Get all teams in the division (across all regular pools, excluding playoff pool)
    const divisionTeams = await db.select().from(teams)
      .where(regularPoolIds.length > 0 ? sql`${teams.poolId} IN (${sql.join(regularPoolIds.map(id => sql`${id}`), sql`, `)})` : sql`false`);
    
    if (divisionTeams.length === 0) {
      throw new Error('No teams found in division');
    }

    // Get all completed pool play games for this division (exclude playoff games)
    const teamIds = divisionTeams.map(t => t.id);
    const poolGames = await db.select().from(games)
      .where(and(
        eq(games.isPlayoff, false),
        teamIds.length > 0 ? sql`(${games.homeTeamId} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)}) OR ${games.awayTeamId} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)}))` : sql`false`
      ));

    // Calculate standings using shared SP11.2 tie-breaking logic
    let standingsForSeeding: Array<{ teamId: string; rank: number; poolId: string }>;
    
    if (tournament.playoffFormat === 'top_8_four_pools') {
      // For four pools format, calculate standings within each pool separately
      standingsForSeeding = [];
      const poolMap = new Map<string, Team[]>();
      
      // Group teams by pool
      divisionTeams.forEach(team => {
        if (!poolMap.has(team.poolId)) {
          poolMap.set(team.poolId, []);
        }
        poolMap.get(team.poolId)!.push(team);
      });
      
      // Calculate standings for each pool independently using new helper
      poolMap.forEach((poolTeams, poolId) => {
        const poolStandings = this.calculateStandingsWithTiebreaking(poolTeams, poolGames);
        poolStandings.forEach(standing => {
          standingsForSeeding.push({
            teamId: standing.teamId,
            rank: standing.rank, // This is now pool-specific rank (1, 2, 3, 4)
            poolId: standing.poolId,
          });
        });
      });
    } else {
      // For other formats, use global standings with SP11.2 tie-breaking
      const standings = this.calculateStandingsWithTiebreaking(divisionTeams, poolGames);
      standingsForSeeding = standings.map(s => ({ teamId: s.teamId, rank: s.rank, poolId: s.poolId }));
    }
    
    // Get playoff teams based on format and standings with seeding pattern support
    const seededTeams = getPlayoffTeamsFromStandings(
      standingsForSeeding,
      tournament.playoffFormat,
      tournament.seedingPattern as any,
      divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).length
    );

    if (seededTeams.length === 0) {
      throw new Error('No playoff teams determined from standings');
    }

    // Create a lookup map: seed number → team ID
    const seedToTeamMap = new Map<number, string>();
    seededTeams.forEach(st => {
      seedToTeamMap.set(st.seed, st.teamId);
    });

    // Fetch existing playoff slot games (created by savePlayoffSlots)
    const playoffPool = divisionPools.find(p => p.name.toLowerCase().includes('playoff'));
    if (!playoffPool) {
      throw new Error('No playoff slots have been scheduled yet. Please schedule the slots in the "Schedule Slots" tab first.');
    }

    const playoffSlots = await db.select().from(games)
      .where(and(
        eq(games.poolId, playoffPool.id),
        eq(games.isPlayoff, true)
      ));

    if (playoffSlots.length === 0) {
      throw new Error('No playoff slots have been scheduled yet. Please schedule the slots in the "Schedule Slots" tab first.');
    }

    // Update each slot with team assignments based on seeded teams
    const updatedGames: Game[] = [];
    
    for (const slot of playoffSlots) {
      let newHomeTeamId: string | null = null;
      let newAwayTeamId: string | null = null;

      // Resolve home team from team1Source
      if (slot.team1Source) {
        const source = slot.team1Source as any;
        if (source.type === 'seed' && source.rank) {
          // Assign team based on seed number from seeding engine
          newHomeTeamId = seedToTeamMap.get(source.rank) || null;
        }
        // Note: type === 'winner' will be resolved as games complete (not handled here)
      }

      // Resolve away team from team2Source
      if (slot.team2Source) {
        const source = slot.team2Source as any;
        if (source.type === 'seed' && source.rank) {
          // Assign team based on seed number from seeding engine
          newAwayTeamId = seedToTeamMap.get(source.rank) || null;
        }
        // Note: type === 'winner' will be resolved as games complete (not handled here)
      }

      // Update the game with team assignments (preserve all other metadata including source fields and scheduling)
      const [updatedGame] = await db.update(games)
        .set({
          homeTeamId: newHomeTeamId,
          awayTeamId: newAwayTeamId,
          team1Source: slot.team1Source,
          team2Source: slot.team2Source,
          // Explicitly preserve scheduling fields to ensure they're not lost
          date: slot.date,
          time: slot.time,
          diamondId: slot.diamondId,
          location: slot.location,
          subVenue: slot.subVenue,
          playoffRound: slot.playoffRound,
          playoffGameNumber: slot.playoffGameNumber,
        })
        .where(eq(games.id, slot.id))
        .returning();
      
      updatedGames.push(updatedGame);
    }
    
    return updatedGames;
  }

  async savePlayoffSlots(
    tournamentId: string,
    divisionId: string,
    slots: Record<string, { date: string; time: string; diamondId: string; }>
  ): Promise<Game[]> {
    // Import dependencies
    const { getBracketStructure } = await import('@shared/bracketStructure');
    const { NotFoundError, ValidationError } = await import('./errors');
    
    // Pre-validation: Get tournament and validate
    const tournament = await this.getTournament(tournamentId);
    if (!tournament) {
      throw new NotFoundError('Tournament not found');
    }

    // Pre-validation: Get division and validate
    const [division] = await db.select().from(ageDivisions).where(eq(ageDivisions.id, divisionId));
    if (!division) {
      throw new NotFoundError('Division not found');
    }

    // Pre-validation: Get organization diamonds
    const orgDiamonds = await db.select().from(diamonds).where(eq(diamonds.organizationId, tournament.organizationId));
    const diamondMap = new Map(orgDiamonds.map(d => [d.id, d]));

    // Pre-validation: Get bracket structure
    const bracketStructure = getBracketStructure(tournament.playoffFormat || 'top_8', tournament.seedingPattern || undefined);
    if (bracketStructure.length === 0) {
      throw new ValidationError(`Unsupported playoff format: ${tournament.playoffFormat}`);
    }
    const bracketSlotMap = new Map(bracketStructure.map(s => [`r${s.round}-g${s.gameNumber}`, s]));

    // Pre-validation: Validate all slots before transaction
    const validatedSlots: Array<{ slotKey: string; round: number; gameNumber: number; date: string; time: string; diamondId: string; }> = [];
    
    for (const [slotKey, slotData] of Object.entries(slots)) {
      // Parse slot key
      const match = slotKey.match(/^r(\d+)-g(\d+)$/);
      if (!match) {
        throw new ValidationError(`Invalid slot key format: ${slotKey}`);
      }

      const round = parseInt(match[1]);
      const gameNumber = parseInt(match[2]);

      // Validate bracket slot exists
      if (!bracketSlotMap.has(slotKey)) {
        throw new ValidationError(`No bracket slot found for ${slotKey}`);
      }

      // Validate required fields
      const { date, time, diamondId } = slotData;
      if (!date || !time || !diamondId) {
        throw new ValidationError(`Missing required fields for slot ${slotKey}`);
      }

      // Validate date within tournament range
      if (date < tournament.startDate || date > tournament.endDate) {
        throw new ValidationError(`Date for ${slotKey} must be between ${tournament.startDate} and ${tournament.endDate}`);
      }

      // Validate diamond belongs to organization
      if (!diamondMap.has(diamondId)) {
        throw new ValidationError(`Invalid diamond for slot ${slotKey}`);
      }

      validatedSlots.push({ slotKey, round, gameNumber, date, time, diamondId });
    }

    // Execute in transaction
    return await db.transaction(async (tx) => {
      // Get all division pools
      const divisionPools = await tx.select().from(pools).where(eq(pools.ageDivisionId, divisionId));
      
      // Find or create playoff pool
      let playoffPool = divisionPools.find(p => p.name.toLowerCase().includes('playoff'));
      if (!playoffPool) {
        [playoffPool] = await tx.insert(pools).values({
          id: `${tournamentId}_pool_${divisionId}-Playoff`,
          name: 'Playoff',
          tournamentId,
          ageDivisionId: divisionId,
          displayOrder: 999,
        }).returning();
      }

      // Lock existing playoff games for this pool
      const existingGames = await tx.select().from(games)
        .where(and(
          eq(games.poolId, playoffPool.id),
          eq(games.isPlayoff, true)
        ))
        .for('update');

      const existingGameMap = new Map(
        existingGames.map(g => [`r${g.playoffRound}-g${g.playoffGameNumber}`, g])
      );

      const updatedGames: Game[] = [];

      // Upsert each slot
      const processedSlotKeys = new Set<string>();
      
      for (const slot of validatedSlots) {
        const { slotKey, round, gameNumber, date, time, diamondId } = slot;
        const bracketSlot = bracketSlotMap.get(slotKey)!;
        const diamond = diamondMap.get(diamondId)!;

        processedSlotKeys.add(slotKey);
        const existingGame = existingGameMap.get(slotKey);

        if (existingGame) {
          // Update existing game (preserve team source metadata AND playoff bracket position)
          const updatePayload: any = {
            date,
            time,
            diamondId,
            location: diamond.location,
            subVenue: diamond.name,
            playoffRound: round,
            playoffGameNumber: gameNumber,
          };
          
          // Add team source metadata from bracket structure
          if (bracketSlot.homeSource.type === 'winner') {
            updatePayload.team1Source = {
              type: 'winner',
              gameNumber: bracketSlot.homeSource.gameNumber,
              round: bracketSlot.homeSource.round
            };
          } else if (bracketSlot.homeSource.type === 'seed') {
            updatePayload.team1Source = {
              type: 'seed',
              rank: bracketSlot.homeSource.rank,
              label: bracketSlot.homeSource.label
            };
          }
          
          if (bracketSlot.awaySource.type === 'winner') {
            updatePayload.team2Source = {
              type: 'winner',
              gameNumber: bracketSlot.awaySource.gameNumber,
              round: bracketSlot.awaySource.round
            };
          } else if (bracketSlot.awaySource.type === 'seed') {
            updatePayload.team2Source = {
              type: 'seed',
              rank: bracketSlot.awaySource.rank,
              label: bracketSlot.awaySource.label
            };
          }
          
          const [updated] = await tx.update(games)
            .set(updatePayload)
            .where(eq(games.id, existingGame.id))
            .returning();
          updatedGames.push(updated);
        } else {
          // Create new game
          const gameId = `${playoffPool.id}-r${round}-g${gameNumber}`;
          
          const newGame: InsertGame = {
            id: gameId,
            tournamentId,
            ageDivisionId: divisionId,
            poolId: playoffPool.id,
            isPlayoff: true,
            playoffRound: round,
            playoffGameNumber: gameNumber,
            date,
            time,
            diamondId,
            location: diamond.location,
            subVenue: diamond.name,
            status: 'scheduled',
            forfeitStatus: 'none',
            homeTeamId: null,
            awayTeamId: null,
          };

          // Add team source metadata from bracket structure
          if (bracketSlot.homeSource.type === 'winner') {
            newGame.team1Source = {
              type: 'winner',
              gameNumber: bracketSlot.homeSource.gameNumber,
              round: bracketSlot.homeSource.round
            } as any;
          } else if (bracketSlot.homeSource.type === 'seed') {
            newGame.team1Source = {
              type: 'seed',
              rank: bracketSlot.homeSource.rank,
              label: bracketSlot.homeSource.label
            } as any;
          }
          
          if (bracketSlot.awaySource.type === 'winner') {
            newGame.team2Source = {
              type: 'winner',
              gameNumber: bracketSlot.awaySource.gameNumber,
              round: bracketSlot.awaySource.round
            } as any;
          } else if (bracketSlot.awaySource.type === 'seed') {
            newGame.team2Source = {
              type: 'seed',
              rank: bracketSlot.awaySource.rank,
              label: bracketSlot.awaySource.label
            } as any;
          }

          const [created] = await tx.insert(games).values(newGame).returning();
          updatedGames.push(created);
        }
      }

      // Delete slots that were previously saved but are no longer in the payload
      // This allows admins to "un-schedule" slots by clearing all fields
      const gamesToDelete = existingGames.filter(game => {
        const slotKey = `r${game.playoffRound}-g${game.playoffGameNumber}`;
        return !processedSlotKeys.has(slotKey);
      });

      for (const gameToDelete of gamesToDelete) {
        await tx.delete(games).where(eq(games.id, gameToDelete.id));
      }

      return updatedGames;
    });
  }

  // House League Team methods
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

  // Booking Request methods
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
    
    // Optionally verify the request belongs to the organization
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

  // Diamond Restriction methods
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

  // Organization Coordinator methods
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

  // Coach Invitation methods
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

  // Organization iCal Feed methods
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

  // External Calendar Event methods
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

export const storage = new DatabaseStorage();
