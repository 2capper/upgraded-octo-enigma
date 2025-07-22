import { 
  users, 
  tournaments, 
  ageDivisions, 
  pools, 
  teams, 
  games,
  type User, 
  type InsertUser,
  type Tournament,
  type InsertTournament,
  type AgeDivision,
  type InsertAgeDivision,
  type Pool,
  type InsertPool,
  type Team,
  type InsertTeam,
  type Game,
  type InsertGame
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Tournament methods
  getTournaments(): Promise<Tournament[]>;
  getTournament(id: string): Promise<Tournament | undefined>;
  createTournament(tournament: InsertTournament): Promise<Tournament>;
  updateTournament(id: string, tournament: Partial<InsertTournament>): Promise<Tournament>;
  deleteTournament(id: string): Promise<void>;
  
  // Age Division methods
  getAgeDivisions(tournamentId: string): Promise<AgeDivision[]>;
  createAgeDivision(ageDivision: InsertAgeDivision): Promise<AgeDivision>;
  
  // Pool methods
  getPools(tournamentId: string): Promise<Pool[]>;
  getPoolById(id: string): Promise<Pool | undefined>;
  createPool(pool: InsertPool): Promise<Pool>;
  
  // Team methods
  getTeams(tournamentId: string): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: string, team: Partial<InsertTeam>): Promise<Team>;
  deleteTeam(id: string): Promise<void>;
  
  // Game methods
  getGames(tournamentId: string): Promise<Game[]>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>): Promise<Game>;
  deleteGame(id: string): Promise<void>;
  
  // Bulk operations
  bulkCreateTeams(teams: InsertTeam[]): Promise<Team[]>;
  bulkCreateGames(games: InsertGame[]): Promise<Game[]>;
  clearTournamentData(tournamentId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getUserCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` }).from(users);
    return Number(result[0].count);
  }

  // Tournament methods
  async getTournaments(): Promise<Tournament[]> {
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
    const [result] = await db.update(teams).set(team).where(eq(teams.id, id)).returning();
    return result;
  }

  async deleteTeam(id: string): Promise<void> {
    await db.delete(teams).where(eq(teams.id, id));
  }

  // Game methods
  async getGames(tournamentId: string): Promise<Game[]> {
    return await db.select().from(games).where(eq(games.tournamentId, tournamentId));
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [result] = await db.insert(games).values(game).returning();
    return result;
  }

  async updateGame(id: string, game: Partial<InsertGame>): Promise<Game> {
    const [result] = await db.update(games).set(game).where(eq(games.id, id)).returning();
    return result;
  }

  async deleteGame(id: string): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  // Bulk operations
  async bulkCreateTeams(teamsList: InsertTeam[]): Promise<Team[]> {
    if (teamsList.length === 0) return [];
    return await db.insert(teams).values(teamsList).returning();
  }

  async bulkCreateGames(gamesList: InsertGame[]): Promise<Game[]> {
    if (gamesList.length === 0) return [];
    return await db.insert(games).values(gamesList).returning();
  }

  async clearTournamentData(tournamentId: string): Promise<void> {
    // Delete in correct order due to foreign key constraints
    await db.delete(games).where(eq(games.tournamentId, tournamentId));
    await db.delete(teams).where(eq(teams.tournamentId, tournamentId));
    await db.delete(pools).where(eq(pools.tournamentId, tournamentId));
    await db.delete(ageDivisions).where(eq(ageDivisions.tournamentId, tournamentId));
  }
}

export const storage = new DatabaseStorage();
