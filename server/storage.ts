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
  games,
  auditLogs,
  adminRequests,
  featureFlags,
  houseLeagueTeams,
  bookingRequests,
  bookingApprovals,
  diamondRestrictions,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateBracketGames, getPlayoffTeamsFromStandings, updateBracketProgression } from "@shared/bracketGeneration";
import { calculateStandings } from "@shared/standingsCalculation";
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
  
  // House League Team methods
  getHouseLeagueTeams(organizationId: string): Promise<HouseLeagueTeam[]>;
  getHouseLeagueTeam(id: string, organizationId?: string): Promise<HouseLeagueTeam | undefined>;
  createHouseLeagueTeam(team: InsertHouseLeagueTeam): Promise<HouseLeagueTeam>;
  updateHouseLeagueTeam(id: string, team: Partial<InsertHouseLeagueTeam>, organizationId: string): Promise<HouseLeagueTeam>;
  deleteHouseLeagueTeam(id: string, organizationId: string): Promise<void>;
  
  // Booking Request methods
  getBookingRequests(organizationId: string, filters: { status?: string, teamId?: string, startDate?: string, endDate?: string }): Promise<BookingRequest[]>;
  getBookingRequest(id: string, organizationId?: string): Promise<BookingRequest | undefined>;
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
  getOrganizationCoordinators(organizationId: string, role: 'select_coordinator' | 'diamond_coordinator'): Promise<User[]>;
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
    return await db.select().from(games).where(eq(games.tournamentId, tournamentId));
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
    // Use database transaction to ensure atomic operation and prevent race conditions
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

        // Auto-resolve seed labels when pool play completes
        const [currentPool] = await tx.select().from(pools).where(eq(pools.id, updatedGame.poolId));
        if (currentPool && !currentPool.name.toLowerCase().includes('playoff')) {
          // This is a pool play game - check if all pool play is complete
          const tournamentGames = await tx.select().from(games).where(eq(games.tournamentId, updatedGame.tournamentId));
          const tournamentPools = await tx.select().from(pools).where(eq(pools.tournamentId, updatedGame.tournamentId));
          
          // Create a set of playoff pool IDs for efficient lookup
          const playoffPoolIds = new Set(
            tournamentPools
              .filter(p => p.name.toLowerCase().includes('playoff'))
              .map(p => p.id)
          );
          
          const poolGames = tournamentGames.filter(g => 
            g.poolId && !playoffPoolIds.has(g.poolId)
          );
          
          const allPoolGamesComplete = poolGames.every(g => g.status === 'completed');
          
          if (allPoolGamesComplete) {
            console.log('🎯 All pool play complete! Resolving playoff seed labels...');
            
            // Get tournament to access playoff format and seeding pattern
            const [tournament] = await tx.select().from(tournaments).where(eq(tournaments.id, updatedGame.tournamentId));
            if (!tournament) {
              throw new Error("Tournament not found");
            }
            
            // Get all teams and divisions for standings calculation (pools already fetched above)
            const tournamentTeams = await tx.select().from(teams).where(eq(teams.tournamentId, updatedGame.tournamentId));
            const tournamentDivisions = await tx.select().from(ageDivisions).where(eq(ageDivisions.tournamentId, updatedGame.tournamentId));
            
            // Calculate standings per division, mapping pools to letters within each division
            // Structure: Map<divisionId, Map<poolLetter, standings[]>>
            const standingsByDivision = new Map<string, Map<string, any[]>>();
            
            for (const division of tournamentDivisions) {
              const divisionPools = tournamentPools
                .filter(p => p.ageDivisionId === division.id && !p.name.toLowerCase().includes('playoff'))
                .sort((a, b) => a.name.localeCompare(b.name));
              
              const letterMap = new Map<string, any[]>();
              divisionPools.forEach((pool, index) => {
                const poolLetter = String.fromCharCode(65 + index); // A=65, B=66, etc.
                const poolTeams = tournamentTeams.filter(t => t.poolId === pool.id);
                const standings = calculateStandings(poolTeams, tournamentGames);
                letterMap.set(poolLetter, standings.sort((a, b) => a.rank - b.rank));
                console.log(`Division ${division.name}: Mapped ${pool.name} → ${poolLetter}, ${standings.length} teams`);
              });
              
              standingsByDivision.set(division.id, letterMap);
            }
            
            // Calculate overall standings for standard seeding (numeric seeds)
            // Structure: Map<divisionId, overallStandings[]>
            const overallStandingsByDivision = new Map<string, any[]>();
            
            for (const division of tournamentDivisions) {
              const divisionTeams = tournamentTeams.filter(t => {
                const teamPool = tournamentPools.find(p => p.id === t.poolId);
                return teamPool && teamPool.ageDivisionId === division.id && !teamPool.name.toLowerCase().includes('playoff');
              });
              
              const overallStandings = calculateStandings(divisionTeams, tournamentGames);
              overallStandingsByDivision.set(division.id, overallStandings.sort((a, b) => a.rank - b.rank));
              console.log(`Division ${division.name}: Overall standings calculated, ${overallStandings.length} teams`);
            }
            
            // Helper function to check if a team name is a seed label
            const isSeedLabel = (name: string): boolean => {
              // Matches pool-letter seeds (A1, B2) or numeric seeds (1, 2, 3)
              return /^[A-Z]\d+$/.test(name.trim()) || /^\d+$/.test(name.trim());
            };
            
            // Helper function to resolve a seed label to actual team ID for a specific division
            const resolveSeedLabel = (label: string, divisionId: string): string | null => {
              // Check if it's a numeric seed (e.g., "1", "2", "8")
              const numericMatch = label.match(/^(\d+)$/);
              if (numericMatch) {
                const overallRank = parseInt(numericMatch[1]);
                const overallStandings = overallStandingsByDivision.get(divisionId);
                
                if (!overallStandings || overallStandings.length < overallRank) {
                  console.warn(`Cannot resolve numeric seed ${label} for division ${divisionId}: insufficient teams (have ${overallStandings?.length || 0} teams, need ${overallRank})`);
                  return null;
                }
                
                return overallStandings[overallRank - 1].teamId;
              }
              
              // Check if it's a pool-letter seed (e.g., "A1", "B2")
              const poolMatch = label.match(/^([A-Z])(\d+)$/);
              if (poolMatch) {
                const poolLetter = poolMatch[1];
                const rank = parseInt(poolMatch[2]);
                
                const divisionStandings = standingsByDivision.get(divisionId);
                if (!divisionStandings) {
                  console.warn(`Cannot resolve seed label ${label}: division ${divisionId} not found`);
                  return null;
                }
                
                const poolStandings = divisionStandings.get(poolLetter);
                
                if (!poolStandings || poolStandings.length < rank) {
                  console.warn(`Cannot resolve seed label ${label} for division ${divisionId}: pool ${poolLetter} not found or insufficient teams (have ${poolStandings?.length || 0} teams, need ${rank})`);
                  return null;
                }
                
                return poolStandings[rank - 1].teamId;
              }
              
              return null;
            };
            
            // Find all playoff games with seed label teams (reuse playoffPoolIds from above)
            const playoffGames = tournamentGames.filter(g => 
              g.poolId && playoffPoolIds.has(g.poolId)
            );
            
            // Resolve and update playoff games
            for (const game of playoffGames) {
              // Get the division ID for this playoff game through its pool
              const playoffPool = tournamentPools.find(p => p.id === game.poolId);
              if (!playoffPool) {
                console.warn(`Skipping game ${game.id}: playoff pool not found`);
                continue;
              }
              
              const divisionId = playoffPool.ageDivisionId;
              const homeTeam = tournamentTeams.find(t => t.id === game.homeTeamId);
              const awayTeam = tournamentTeams.find(t => t.id === game.awayTeamId);
              
              let newHomeTeamId = game.homeTeamId;
              let newAwayTeamId = game.awayTeamId;
              
              if (homeTeam && isSeedLabel(homeTeam.name)) {
                const resolvedId = resolveSeedLabel(homeTeam.name, divisionId);
                if (resolvedId) {
                  newHomeTeamId = resolvedId;
                  console.log(`Resolved ${homeTeam.name} → ${resolvedId} for game ${game.id} (division ${playoffPool.ageDivisionId})`);
                }
              }
              
              if (awayTeam && isSeedLabel(awayTeam.name)) {
                const resolvedId = resolveSeedLabel(awayTeam.name, divisionId);
                if (resolvedId) {
                  newAwayTeamId = resolvedId;
                  console.log(`Resolved ${awayTeam.name} → ${resolvedId} for game ${game.id} (division ${playoffPool.ageDivisionId})`);
                }
              }
              
              // Update game if either team was resolved
              if (newHomeTeamId !== game.homeTeamId || newAwayTeamId !== game.awayTeamId) {
                await tx.update(games)
                  .set({
                    homeTeamId: newHomeTeamId,
                    awayTeamId: newAwayTeamId
                  })
                  .where(eq(games.id, game.id));
                  
                console.log(`✅ Updated playoff game ${game.id} with resolved teams`);
              }
            }
          }
        }

        // Auto-advance winners in playoff brackets
        if (updatedGame.playoffRound && updatedGame.playoffGameNumber && updatedGame.status === 'completed') {
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
          
          // Only advance if we have a clear winner
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
                sql`${games.playoffRound} IS NOT NULL`
              ));
            
            // Convert to the format expected by updateBracketProgression
            const bracketGames = allPlayoffGames.map(({ game: g }) => ({
              tournamentId: g.tournamentId,
              divisionId: divisionId,
              round: g.playoffRound || 1,
              gameNumber: g.playoffGameNumber || 1,
              bracket: (g.playoffBracket || 'winners') as 'winners' | 'losers' | 'championship',
              team1Id: g.homeTeamId,
              team2Id: g.awayTeamId,
              team1Source: g.team1Source as any,
              team2Source: g.team2Source as any,
            }));
            
            // Update bracket progression
            const updatedBracketGames = updateBracketProgression(
              bracketGames,
              updatedGame.playoffGameNumber,
              winnerId,
              loserId
            );
            
            // Update affected games in database
            for (const bracketGame of updatedBracketGames) {
              const gameToUpdate = allPlayoffGames.find(
                ({ game: g }) => g.playoffRound === bracketGame.round && 
                                 g.playoffGameNumber === bracketGame.gameNumber
              );
              
              if (gameToUpdate && (
                gameToUpdate.game.homeTeamId !== bracketGame.team1Id || 
                gameToUpdate.game.awayTeamId !== bracketGame.team2Id
              )) {
                await tx.update(games)
                  .set({
                    homeTeamId: bracketGame.team1Id,
                    awayTeamId: bracketGame.team2Id
                  })
                  .where(eq(games.id, gameToUpdate.game.id));
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

    // Get all pools in this division (exclude playoff pool for team gathering)
    const divisionPools = await db.select().from(pools).where(eq(pools.ageDivisionId, divisionId));
    const regularPoolIds = divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).map(p => p.id);

    // Delete any existing playoff games for this division to allow bracket regeneration
    const playoffPoolIds = divisionPools.filter(p => p.name.toLowerCase().includes('playoff')).map(p => p.id);
    if (playoffPoolIds.length > 0) {
      await db.delete(games).where(
        and(
          eq(games.isPlayoff, true),
          playoffPoolIds.length > 0 ? sql`${games.poolId} IN (${sql.join(playoffPoolIds.map(id => sql`${id}`), sql`, `)})` : sql`false`
        )
      );
    }

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

    // Calculate standings to determine seeding
    let standingsForSeeding: Array<{ teamId: string; rank: number; poolId: string }>;
    
    if (tournament.playoffFormat === 'top_8_four_pools') {
      // For four pools format, calculate standings within each pool separately
      standingsForSeeding = [];
      const poolMap = new Map<string, typeof divisionTeams>();
      
      // Group teams by pool
      divisionTeams.forEach(team => {
        if (!poolMap.has(team.poolId)) {
          poolMap.set(team.poolId, []);
        }
        poolMap.get(team.poolId)!.push(team);
      });
      
      // Calculate standings for each pool independently
      poolMap.forEach((poolTeams, poolId) => {
        const poolStandings = calculateStandings(poolTeams, poolGames);
        poolStandings.forEach(standing => {
          standingsForSeeding.push({
            teamId: standing.teamId,
            rank: standing.rank, // This is now pool-specific rank (1, 2, 3, 4)
            poolId: standing.poolId,
          });
        });
      });
    } else {
      // For other formats, use global standings
      const standings = calculateStandings(divisionTeams, poolGames);
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

    // Validate that we have enough teams for the bracket template
    const expectedTeamCount = seededTeams.length;
    if (divisionTeams.length < expectedTeamCount) {
      throw new Error(`Insufficient teams: format requires ${expectedTeamCount} teams but only ${divisionTeams.length} available`);
    }

    // Enrich seeded teams with team names only (preserve pool data from getPlayoffTeamsFromStandings)
    const enrichedSeededTeams = seededTeams.map(st => {
      const team = divisionTeams.find(t => t.id === st.teamId);
      
      return {
        ...st, // Preserve all existing fields including poolName and poolRank
        teamName: st.teamName || team?.name, // Only add teamName if not already set
      };
    });

    // Generate bracket games with seeding pattern support
    const bracketGames = generateBracketGames({
      tournamentId,
      divisionId,
      playoffFormat: tournament.playoffFormat,
      teamCount: seededTeams.length,
      seededTeams: enrichedSeededTeams,
      seedingPattern: tournament.seedingPattern as any || undefined,
    });

    if (bracketGames.length === 0) {
      throw new Error(`No bracket template found for format: ${tournament.playoffFormat}`);
    }

    // Find or create a playoff pool for this division
    let playoffPool = divisionPools.find(p => p.name.toLowerCase().includes('playoff'));
    if (!playoffPool) {
      [playoffPool] = await db.insert(pools).values({
        id: `${tournamentId}_pool_${divisionId}-Playoff`,
        name: 'Playoff',
        tournamentId,
        ageDivisionId: divisionId,
      }).returning();
    }

    // Convert to InsertGame format and create games
    const playoffGamesToInsert: InsertGame[] = bracketGames.map((bg) => ({
      id: `${tournamentId}_playoff_${divisionId}_g${bg.gameNumber}`,
      tournamentId,
      poolId: playoffPool!.id,
      homeTeamId: bg.team1Id || null,
      awayTeamId: bg.team2Id || null,
      isPlayoff: true,
      playoffRound: bg.round,
      playoffGameNumber: bg.gameNumber,
      playoffBracket: bg.bracket,
      team1Source: bg.team1Source as any,
      team2Source: bg.team2Source as any,
      status: 'scheduled',
      date: tournament.startDate,
      time: '12:00 PM',
      location: 'TBD',
      forfeitStatus: 'none',
    }));

    // Insert playoff games into database
    const createdGames = await db.insert(games).values(playoffGamesToInsert).returning();
    
    return createdGames;
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
        newStatus = 'select_coordinator_approved';
      } else if (approval.approverRole === 'diamond_coordinator') {
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

  // Coordinator methods
  async getOrganizationCoordinators(organizationId: string, role: 'select_coordinator' | 'diamond_coordinator'): Promise<User[]> {
    const adminRecords = await db.select().from(organizationAdmins).where(
      and(
        eq(organizationAdmins.organizationId, organizationId),
        eq(organizationAdmins.role, role)
      )
    );

    if (adminRecords.length === 0) {
      return [];
    }

    const userIds = adminRecords.map(record => record.userId);
    return await db.select().from(users).where(inArray(users.id, userIds));
  }
}

export const storage = new DatabaseStorage();
