import { db } from "../db";
import {
  tournaments,
  ageDivisions,
  pools,
  matchups,
  games,
  type Tournament,
  type InsertTournament,
  type AgeDivision,
  type InsertAgeDivision,
  type Pool,
  type InsertPool,
  type Matchup,
  type InsertMatchup,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class TournamentService {
  // Tournament CRUD
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

  async clearTournamentData(tournamentId: string): Promise<void> {
    await db.delete(games).where(eq(games.tournamentId, tournamentId));
  }

  // Age Division Management
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

  // Pool Management
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

  // Matchup Management
  async getMatchups(tournamentId: string, poolId?: string): Promise<Matchup[]> {
    if (poolId) {
      return await db.select().from(matchups)
        .where(and(eq(matchups.tournamentId, tournamentId), eq(matchups.poolId, poolId)));
    }
    return await db.select().from(matchups).where(eq(matchups.tournamentId, tournamentId));
  }

  async replaceMatchups(tournamentId: string, poolId: string, newMatchups: InsertMatchup[]): Promise<Matchup[]> {
    return await db.transaction(async (tx) => {
      await tx.delete(matchups)
        .where(and(eq(matchups.tournamentId, tournamentId), eq(matchups.poolId, poolId)));
      
      if (newMatchups.length === 0) {
        return [];
      }
      return await tx.insert(matchups).values(newMatchups).returning();
    });
  }
}

export const tournamentService = new TournamentService();
