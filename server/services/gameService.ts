import { db } from "../db";
import {
  games,
  pools,
  auditLogs,
  type Game,
  type InsertGame,
  type GameUpdate,
  type AuditLog,
  type InsertAuditLog,
} from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { withRetry } from "../dbRetry";

export class GameService {
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

  async getAllGames(): Promise<Game[]> {
    return await db.select().from(games)
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
    return await withRetry(async () => {
      return await db.transaction(async (tx) => {
        const [currentGame] = await tx.select().from(games).where(eq(games.id, id));
        if (!currentGame) {
          throw new Error("Game not found");
        }

        const [updatedGame] = await tx.update(games).set(updates).where(eq(games.id, id)).returning();

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

        if (updatedGame.isPlayoff && updatedGame.playoffRound && updatedGame.playoffGameNumber && updatedGame.status === 'completed') {
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
          
          if (winnerId && loserId) {
            const [currentPool] = await tx.select().from(pools).where(eq(pools.id, updatedGame.poolId));
            if (!currentPool) {
              throw new Error("Pool not found for game");
            }
            const divisionId = currentPool.ageDivisionId;
            
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
            
            for (const { game: nextGame } of allPlayoffGames) {
              let shouldUpdate = false;
              let newHomeTeamId = nextGame.homeTeamId;
              let newAwayTeamId = nextGame.awayTeamId;
              
              if (nextGame.team1Source) {
                const source = nextGame.team1Source as any;
                if (source.type === 'winner' && 
                    source.gameNumber === updatedGame.playoffGameNumber && 
                    source.round === updatedGame.playoffRound) {
                  newHomeTeamId = winnerId;
                  shouldUpdate = true;
                }
              }
              
              if (nextGame.team2Source) {
                const source = nextGame.team2Source as any;
                if (source.type === 'winner' && 
                    source.gameNumber === updatedGame.playoffGameNumber && 
                    source.round === updatedGame.playoffRound) {
                  newAwayTeamId = winnerId;
                  shouldUpdate = true;
                }
              }
              
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

  async bulkCreateGames(gamesList: InsertGame[]): Promise<Game[]> {
    if (gamesList.length === 0) return [];
    return await withRetry(async () => {
      return await db.insert(games).values(gamesList).returning();
    });
  }

  // Audit Log Methods
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
}

export const gameService = new GameService();
