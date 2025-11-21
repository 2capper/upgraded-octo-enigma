import { db } from "../db";
import {
  tournaments,
  ageDivisions,
  pools,
  teams,
  games,
  diamonds,
  type Game,
  type InsertGame,
  type Team,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { calculateStandingsWithTiebreaking } from "@shared/standingsCalculation";
import { getPlayoffTeamsFromStandings } from "@shared/bracketGeneration";

export class PlayoffService {
  async generatePlayoffBracket(tournamentId: string, divisionId: string): Promise<Game[]> {
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!tournament || !tournament.playoffFormat) {
      throw new Error('Tournament not found or playoff format not configured');
    }

    const [division] = await db.select().from(ageDivisions).where(eq(ageDivisions.id, divisionId));
    if (!division) {
      throw new Error('Division not found');
    }

    const divisionPools = await db.select().from(pools).where(eq(pools.ageDivisionId, divisionId));
    const regularPoolIds = divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).map(p => p.id);

    const divisionTeams = await db.select().from(teams)
      .where(regularPoolIds.length > 0 ? sql`${teams.poolId} IN (${sql.join(regularPoolIds.map(id => sql`${id}`), sql`, `)})` : sql`false`);
    
    if (divisionTeams.length === 0) {
      throw new Error('No teams found in division');
    }

    const teamIds = divisionTeams.map(t => t.id);
    const poolGames = await db.select().from(games)
      .where(and(
        eq(games.isPlayoff, false),
        teamIds.length > 0 ? sql`(${games.homeTeamId} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)}) OR ${games.awayTeamId} IN (${sql.join(teamIds.map(id => sql`${id}`), sql`, `)}))` : sql`false`
      ));

    let standingsForSeeding: Array<{ teamId: string; rank: number; poolId: string }>;
    
    if (tournament.playoffFormat === 'top_8_four_pools') {
      standingsForSeeding = [];
      const poolMap = new Map<string, Team[]>();
      
      divisionTeams.forEach(team => {
        if (!poolMap.has(team.poolId)) {
          poolMap.set(team.poolId, []);
        }
        poolMap.get(team.poolId)!.push(team);
      });
      
      poolMap.forEach((poolTeams, poolId) => {
        const poolTeamIds = poolTeams.map(t => t.id);
        const poolScopedGames = poolGames.filter(g => 
          poolTeamIds.includes(g.homeTeamId) && poolTeamIds.includes(g.awayTeamId)
        );
        
        const poolStandings = calculateStandingsWithTiebreaking(poolTeams, poolGames);
        poolStandings.forEach(standing => {
          standingsForSeeding.push({
            teamId: standing.teamId,
            rank: standing.rank,
            poolId: standing.poolId,
          });
        });
      });
    } else {
      const standings = calculateStandingsWithTiebreaking(divisionTeams, poolGames);
      standingsForSeeding = standings.map(s => ({ teamId: s.teamId, rank: s.rank, poolId: s.poolId }));
    }
    
    const seededTeams = getPlayoffTeamsFromStandings(
      standingsForSeeding,
      tournament.playoffFormat,
      tournament.seedingPattern as any,
      divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).length
    );

    if (seededTeams.length === 0) {
      throw new Error('No playoff teams determined from standings');
    }

    const seedToTeamMap = new Map<number, string>();
    seededTeams.forEach(st => {
      seedToTeamMap.set(st.seed, st.teamId);
    });

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

    const updatedGames: Game[] = [];
    
    for (const slot of playoffSlots) {
      let newHomeTeamId: string | null = null;
      let newAwayTeamId: string | null = null;

      if (slot.team1Source) {
        const source = slot.team1Source as any;
        if (source.type === 'seed' && source.rank) {
          newHomeTeamId = seedToTeamMap.get(source.rank) || null;
        }
      }

      if (slot.team2Source) {
        const source = slot.team2Source as any;
        if (source.type === 'seed' && source.rank) {
          newAwayTeamId = seedToTeamMap.get(source.rank) || null;
        }
      }

      const [updatedGame] = await db.update(games)
        .set({
          homeTeamId: newHomeTeamId,
          awayTeamId: newAwayTeamId,
          team1Source: slot.team1Source,
          team2Source: slot.team2Source,
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
    const { getBracketStructure } = await import('@shared/bracketStructure');
    const { NotFoundError, ValidationError } = await import('../errors');
    
    const [tournament] = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
    if (!tournament) {
      throw new NotFoundError('Tournament not found');
    }

    const [division] = await db.select().from(ageDivisions).where(eq(ageDivisions.id, divisionId));
    if (!division) {
      throw new NotFoundError('Division not found');
    }

    const orgDiamonds = await db.select().from(diamonds).where(eq(diamonds.organizationId, tournament.organizationId));
    const diamondMap = new Map(orgDiamonds.map(d => [d.id, d]));

    const bracketStructure = getBracketStructure(tournament.playoffFormat || 'top_8', tournament.seedingPattern || undefined);
    if (bracketStructure.length === 0) {
      throw new ValidationError(`Unsupported playoff format: ${tournament.playoffFormat}`);
    }
    const bracketSlotMap = new Map(bracketStructure.map(s => [`r${s.round}-g${s.gameNumber}`, s]));

    const validatedSlots: Array<{ slotKey: string; round: number; gameNumber: number; date: string; time: string; diamondId: string; }> = [];
    
    for (const [slotKey, slotData] of Object.entries(slots)) {
      const match = slotKey.match(/^r(\d+)-g(\d+)$/);
      if (!match) {
        throw new ValidationError(`Invalid slot key format: ${slotKey}`);
      }

      const round = parseInt(match[1]);
      const gameNumber = parseInt(match[2]);

      if (!bracketSlotMap.has(slotKey)) {
        throw new ValidationError(`No bracket slot found for ${slotKey}`);
      }

      const { date, time, diamondId } = slotData;
      if (!date || !time || !diamondId) {
        throw new ValidationError(`Missing required fields for slot ${slotKey}`);
      }

      if (date < tournament.startDate || date > tournament.endDate) {
        throw new ValidationError(`Date for ${slotKey} must be between ${tournament.startDate} and ${tournament.endDate}`);
      }

      if (!diamondMap.has(diamondId)) {
        throw new ValidationError(`Invalid diamond for slot ${slotKey}`);
      }

      validatedSlots.push({ slotKey, round, gameNumber, date, time, diamondId });
    }

    return await db.transaction(async (tx) => {
      const divisionPools = await tx.select().from(pools).where(eq(pools.ageDivisionId, divisionId));
      
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
      const processedSlotKeys = new Set<string>();
      
      for (const slot of validatedSlots) {
        const { slotKey, round, gameNumber, date, time, diamondId } = slot;
        const bracketSlot = bracketSlotMap.get(slotKey)!;
        const diamond = diamondMap.get(diamondId)!;

        processedSlotKeys.add(slotKey);
        const existingGame = existingGameMap.get(slotKey);

        if (existingGame) {
          const updatePayload: any = {
            date,
            time,
            diamondId,
            location: diamond.location,
            subVenue: diamond.name,
            playoffRound: round,
            playoffGameNumber: gameNumber,
          };
          
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
}

export const playoffService = new PlayoffService();
