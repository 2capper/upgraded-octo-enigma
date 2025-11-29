import { Router } from "express";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { tournamentService } from "../services/tournamentService";
import { teamService } from "../services/teamService";
import { gameService } from "../services/gameService";
import { diamondService } from "../services/diamondService";
import { playoffService } from "../services/playoffService";
import { allocationService } from "../services/allocationService";
import { isAuthenticated, requireAdmin, requireOrgAdmin } from "../auth";
import { checkTournamentAccess } from "./helpers";
import { 
  insertGameSchema,
  gameUpdateSchema,
  matchups,
  games,
  tournaments,
} from "@shared/schema";
import { validateGameSlot } from "@shared/validation/gameSlotValidator";
import { generatePoolPlaySchedule, generateUnplacedMatchups, validateGameGuarantee } from "@shared/scheduleGeneration";
import { generateGuaranteedMatchups } from "../utils/matchup-generator";
import { nanoid } from "nanoid";
import { calculateStats, resolveTie } from "@shared/standings";
import { calculateStandingsWithTiebreaking } from "@shared/standingsCalculation";
import { getPlayoffTeamsFromStandings } from "@shared/bracketGeneration";
import { getBracketStructure } from "@shared/bracketStructure";
import { generateICSFile, type CalendarEvent } from "../utils/ics-generator";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

const router = Router();

// Matchup routes
router.get("/tournaments/:tournamentId/matchups", async (req: any, res) => {
  try {
    if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
      return;
    }
    const { tournamentId } = req.params;
    const { poolId } = req.query;
    
    const matchups = await tournamentService.getMatchups(tournamentId, poolId as string | undefined);
    res.json(matchups);
  } catch (error) {
    console.error("Error fetching matchups:", error);
    res.status(500).json({ error: "Failed to fetch matchups" });
  }
});

// Game routes - GET all games for a tournament
router.get("/tournaments/:tournamentId/games", async (req: any, res) => {
  try {
    if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
      return;
    }
    const games = await gameService.getGames(req.params.tournamentId);
    res.json(games);
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ error: "Failed to fetch games" });
  }
});

// CSV export endpoint
router.get("/tournaments/:tournamentId/schedule-export", async (req: any, res) => {
  try {
    if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
      return;
    }
    const tournamentId = req.params.tournamentId;
    const divisionId = req.query.divisionId as string | undefined;
    const dateFilter = req.query.date as string | undefined;
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    let allGames = await gameService.getGames(tournamentId);
    const teams = await teamService.getTeams(tournamentId);
    const pools = await tournamentService.getPools(tournamentId);
    const ageDivisions = await tournamentService.getAgeDivisions(tournamentId);
    
    // Fetch diamonds with error handling for permission issues
    let diamonds: any[] = [];
    try {
      diamonds = await diamondService.getDiamonds(tournament.organizationId);
    } catch (error) {
      console.warn("Could not fetch diamonds for CSV export:", error);
    }

    // Create lookup maps
    const teamMap = new Map(teams.map(t => [t.id, t]));
    const poolMap = new Map(pools.map(p => [p.id, p]));
    const diamondMap = new Map(diamonds.map(d => [d.id, d]));
    const ageDivisionMap = new Map(ageDivisions.map(d => [d.id, d]));

    // Filter games by division if specified
    let gamesFiltered = allGames;
    if (divisionId) {
      const divisionPools = pools.filter(p => p.ageDivisionId === divisionId);
      const divisionPoolIds = new Set(divisionPools.map(p => p.id));
      gamesFiltered = allGames.filter(g => g.poolId && divisionPoolIds.has(g.poolId));
    }
    
    // Filter games by date if specified
    if (dateFilter) {
      gamesFiltered = gamesFiltered.filter(g => g.date === dateFilter);
    }

    // Helper function to escape CSV fields
    const escapeCSV = (field: string | null | undefined): string => {
      if (!field) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    // Sort games chronologically using Date objects
    const sortedGames = gamesFiltered.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time}:00`);
      const dateB = new Date(`${b.date}T${b.time}:00`);
      const timeDiff = dateA.getTime() - dateB.getTime();
      
      if (timeDiff === 0) {
        return (a.diamondId || '').localeCompare(b.diamondId || '');
      }
      return timeDiff;
    });

    // Generate CSV headers
    const headers = ['Date', 'Time', 'Diamond', 'Home Team', 'Away Team', 'Pool', 'Division', 'Duration (min)'];
    const csvRows = [headers.join(',')];

    // Generate CSV rows
    for (const game of sortedGames) {
      const homeTeam = teamMap.get(game.homeTeamId);
      const awayTeam = teamMap.get(game.awayTeamId);
      const pool = game.poolId ? poolMap.get(game.poolId) : null;
      const diamond = game.diamondId ? diamondMap.get(game.diamondId) : null;
      
      const division = pool?.ageDivisionId ? ageDivisionMap.get(pool.ageDivisionId)?.name : '';

      const row = [
        escapeCSV(game.date),
        escapeCSV(game.time),
        escapeCSV(diamond?.name || ''),
        escapeCSV(homeTeam?.name || ''),
        escapeCSV(awayTeam?.name || ''),
        escapeCSV(pool?.name || ''),
        escapeCSV(division || ''),
        escapeCSV(String(game.durationMinutes || 90))
      ];
      csvRows.push(row.join(','));
    }

    const csvContent = csvRows.join('\n');

    // Set headers for file download
    const safeFileName = tournament.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}-schedule.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting schedule:", error);
    res.status(500).json({ error: "Failed to export schedule" });
  }
});

// Create game
router.post("/tournaments/:tournamentId/games", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertGameSchema.parse({
      ...req.body,
      tournamentId: req.params.tournamentId
    });
    const game = await gameService.createGame(validatedData);
    res.status(201).json(game);
  } catch (error) {
    console.error("Error creating game:", error);
    res.status(400).json({ error: "Invalid game data" });
  }
});

// Update game
router.put("/games/:id", isAuthenticated, async (req, res) => {
  try {
    // Validate the game update data
    const validatedData = gameUpdateSchema.parse(req.body);
    
    // If duration, time, date, or diamond is being updated, validate no overlaps
    if (validatedData.durationMinutes !== undefined || validatedData.time !== undefined || 
        validatedData.date !== undefined || validatedData.diamondId !== undefined) {
      const currentGame = await gameService.getGame(req.params.id);
      if (!currentGame) {
        return res.status(404).json({ error: "Game not found" });
      }
      
      // Compute effective game attributes (use updated values or fall back to current)
      const effectiveDate = validatedData.date ?? currentGame.date;
      const effectiveTime = validatedData.time ?? currentGame.time;
      const effectiveDiamond = validatedData.diamondId ?? currentGame.diamondId;
      const effectiveDuration = validatedData.durationMinutes ?? currentGame.durationMinutes;
      
      // Get all games on the same diamond and date
      const tournamentGames = await gameService.getGames(currentGame.tournamentId);
      const conflictingGames = tournamentGames.filter(g => 
        g.id !== currentGame.id && 
        g.diamondId === effectiveDiamond && 
        g.date === effectiveDate
      );
      
      // Calculate effective game time range
      const [hours, minutes] = effectiveTime.split(':').map(Number);
      const gameStartMinutes = hours * 60 + minutes;
      const gameEndMinutes = gameStartMinutes + effectiveDuration;
      
      // Check for overlaps
      for (const otherGame of conflictingGames) {
        const [otherHours, otherMinutes] = otherGame.time.split(':').map(Number);
        const otherStartMinutes = otherHours * 60 + otherMinutes;
        const otherEndMinutes = otherStartMinutes + (otherGame.durationMinutes || 90);
        
        if (gameEndMinutes > otherStartMinutes && gameStartMinutes < otherEndMinutes) {
          return res.status(409).json({ 
            error: "Game would overlap with another game on the same diamond" 
          });
        }
      }
    }
    
    // Get user ID from the authenticated session
    const user = req.user as any;
    const userId = user.id;
    
    // Prepare metadata for audit trail
    const metadata = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };
    
    // Update game with audit logging
    const game = await gameService.updateGameWithAudit(req.params.id, validatedData, userId, metadata);
    
    res.json(game);
  } catch (error) {
    console.error("Error updating game:", error);
    
    if ((error as any).name === 'ZodError') {
      return res.status(400).json({ 
        error: "Invalid score data", 
        details: (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`) 
      });
    }
    
    res.status(400).json({ error: "Failed to update game" });
  }
});

// Delete game
router.delete("/games/:id", requireAdmin, async (req, res) => {
  try {
    await gameService.deleteGame(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting game:", error);
    res.status(400).json({ error: "Failed to delete game" });
  }
});

// Helper function to generate playoff games based on format
function generatePlayoffGames(
  standings: any[],
  playoffFormat: string,
  seedingPattern: string,
  tournamentId: string,
  ageDivisionId: string
) {
  const bracketStructure = getBracketStructure(playoffFormat, seedingPattern);
  
  const games = bracketStructure.map(slot => {
    const game: any = {
      id: nanoid(),
      tournamentId,
      ageDivisionId,
      isPlayoff: true,
      playoffRound: slot.round,
      playoffGameNumber: slot.gameNumber,
      status: 'scheduled',
      date: '',
      time: '',
      location: '',
      subVenue: '',
      poolId: null,
    };
    
    if (slot.homeSource.type === 'seed') {
      game.homeTeamId = standings[slot.homeSource.rank - 1]?.id || null;
    } else {
      game.homeTeamId = null;
      game.team1Source = {
        type: 'winner',
        gameNumber: slot.homeSource.gameNumber,
        round: slot.homeSource.round
      };
    }
    
    if (slot.awaySource.type === 'seed') {
      game.awayTeamId = standings[slot.awaySource.rank - 1]?.id || null;
    } else {
      game.awayTeamId = null;
      game.team2Source = {
        type: 'winner',
        gameNumber: slot.awaySource.gameNumber,
        round: slot.awaySource.round
      };
    }
    
    return game;
  });
  
  return games;
}

// Generate playoff bracket from pool play standings
router.post("/tournaments/:tournamentId/generate-playoffs", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    const playoffFormat = tournament.playoffFormat || 'top_8';
    const seedingPattern = tournament.seedingPattern || 'standard';
    
    const pools = await tournamentService.getPools(tournamentId);
    const teams = await teamService.getTeams(tournamentId);
    const allGames = await gameService.getGames(tournamentId);
    const divisions = await tournamentService.getAgeDivisions(tournamentId);
    
    const poolPlayGames = allGames.filter(g => !g.isPlayoff);
    
    const playoffGames = allGames.filter(g => g.isPlayoff);
    for (const game of playoffGames) {
      await gameService.deleteGame(game.id);
    }
    
    const newPlayoffGames: any[] = [];
    
    for (const division of divisions) {
      const divisionPools = pools.filter(p => p.ageDivisionId === division.id);
      const divisionPoolIds = divisionPools.map(p => p.id);
      
      const divisionTeams = teams.filter(t => divisionPoolIds.includes(t.poolId));
      const divisionTeamIds = divisionTeams.map(t => t.id);
      
      const divisionGames = poolPlayGames.filter(g => 
        g.homeTeamId && g.awayTeamId &&
        divisionTeamIds.includes(g.homeTeamId) && divisionTeamIds.includes(g.awayTeamId)
      );
      
      const teamsWithStats = divisionTeams.map(team => {
        const stats = calculateStats(team.id, divisionGames);
        return {
          ...team,
          ...stats,
          points: (stats.wins * 2) + (stats.ties * 1),
          runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : 0,
          runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
        };
      });
      
      const sortedByPoints = teamsWithStats.sort((a, b) => b.points - a.points);
      const overallStandings = resolveTie(sortedByPoints, divisionGames);
      
      const divisionPlayoffGames = generatePlayoffGames(
        overallStandings,
        playoffFormat,
        seedingPattern,
        tournamentId,
        division.id
      );
      
      newPlayoffGames.push(...divisionPlayoffGames);
    }
    
    for (const gameData of newPlayoffGames) {
      await gameService.createGame(gameData);
    }
    
    res.json({ 
      message: "Playoffs generated successfully", 
      gamesCreated: newPlayoffGames.length 
    });
  } catch (error) {
    console.error("Error generating playoffs:", error);
    res.status(500).json({ 
      error: "Failed to generate playoffs",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Pre-schedule playoff games (slot manager)
router.post("/tournaments/:tournamentId/divisions/:divisionId/playoff-slots", requireAdmin, async (req, res) => {
  try {
    const { tournamentId, divisionId } = req.params;
    const { slots } = req.body;

    if (!slots || typeof slots !== 'object') {
      return res.status(400).json({ error: "Invalid request body. Expected { slots: {...} }" });
    }

    const updatedGames = await playoffService.savePlayoffSlots(tournamentId, divisionId, slots);

    res.json({ 
      message: "Playoff schedule saved successfully",
      gamesCreated: updatedGames.length,
      games: updatedGames
    });
  } catch (error: any) {
    console.error("Error saving playoff slots:", error);
    
    if (error.httpStatus) {
      return res.status(error.httpStatus).json({ 
        error: error.message,
        details: error.name
      });
    }
    
    res.status(500).json({ 
      error: "Failed to save playoff schedule",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Move game to new date/time/diamond via drag-and-drop
router.put("/games/:gameId/move", requireAdmin, async (req, res) => {
  try {
    const { gameId } = req.params;
    const { date, time, diamondId, forceOverride } = req.body;

    if (!date || !time || !diamondId) {
      return res.status(400).json({ error: "Missing required fields: date, time, diamondId" });
    }

    const game = await gameService.getGame(gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    const tournament = await tournamentService.getTournament(game.tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (date < tournament.startDate || date > tournament.endDate) {
      return res.status(400).json({ 
        error: `Game date must be between ${tournament.startDate} and ${tournament.endDate}`,
        conflictType: 'date_range'
      });
    }

    const diamonds = await diamondService.getDiamonds(tournament.organizationId);
    const targetDiamond = diamonds.find(d => d.id === diamondId);
    if (!targetDiamond) {
      return res.status(400).json({ error: "Invalid diamond for this tournament" });
    }

    const teams = await teamService.getTeams(game.tournamentId);
    const homeTeam = teams.find(t => t.id === game.homeTeamId);
    const awayTeam = teams.find(t => t.id === game.awayTeamId);

    const allocations = await allocationService.getAllocations(game.tournamentId);

    const tournamentGames = await gameService.getGames(game.tournamentId);
    
    const gamesOnDiamond = tournamentGames.filter(g => 
      g.diamondId === diamondId && g.id !== gameId
    );

    const teamDivisionId = homeTeam?.ageDivisionId || awayTeam?.ageDivisionId;

    const validation = validateGameSlot(
      homeTeam,
      awayTeam,
      targetDiamond,
      date,
      time,
      game.durationMinutes || 90,
      gamesOnDiamond,
      allocations,
      { 
        skipGameId: gameId,
        teamDivisionId: teamDivisionId || undefined
      }
    );

    const gamesOnSameDate = tournamentGames.filter(g => 
      g.id !== gameId && g.date === date
    );

    const [hours, minutes] = time.split(':').map(Number);
    const timeMinutes = hours * 60 + minutes;
    const gameDuration = game.durationMinutes || 90;
    const gameEndMinutes = timeMinutes + gameDuration;

    for (const otherGame of gamesOnSameDate) {
      const hasTeamConflict = 
        otherGame.homeTeamId === game.homeTeamId ||
        otherGame.awayTeamId === game.homeTeamId ||
        otherGame.homeTeamId === game.awayTeamId ||
        otherGame.awayTeamId === game.awayTeamId;

      if (hasTeamConflict && otherGame.time) {
        const [otherHours, otherMinutes] = otherGame.time.split(':').map(Number);
        const otherStartMinutes = otherHours * 60 + otherMinutes;
        const otherEndMinutes = otherStartMinutes + (otherGame.durationMinutes || 90);

        if (gameEndMinutes > otherStartMinutes && timeMinutes < otherEndMinutes) {
          validation.errors.push("One or more teams already has a game that overlaps with this time slot");
          validation.valid = false;
        }
      }
    }

    const conflicts = {
      errors: validation.errors,
      warnings: validation.warnings,
      hasErrors: validation.errors.length > 0,
      hasWarnings: validation.warnings.length > 0,
      conflictTypes: [] as string[]
    };

    if (validation.errors.some(e => e.includes('CLOSED'))) {
      conflicts.conflictTypes.push('diamond_closed');
    }
    if (validation.errors.some(e => e.includes('reserved time block') || e.includes('different division'))) {
      conflicts.conflictTypes.push('allocation_conflict');
    }
    if (validation.errors.some(e => e.includes('Another game is already scheduled') || e.includes('overlap'))) {
      conflicts.conflictTypes.push('game_overlap');
    }
    if (validation.errors.some(e => e.includes('teams already has a game'))) {
      conflicts.conflictTypes.push('team_conflict');
    }

    if (conflicts.hasErrors && !forceOverride) {
      return res.status(409).json({
        error: validation.errors[0],
        conflicts,
        canOverride: true
      });
    }

    const updatedGame = await gameService.updateGame(gameId, {
      date,
      time,
      diamondId
    });

    res.json({
      game: updatedGame,
      warnings: validation.warnings,
      wasOverridden: forceOverride === true && conflicts.hasErrors,
      conflicts: conflicts.hasErrors ? conflicts : null
    });
  } catch (error) {
    console.error("Error moving game:", error);
    res.status(500).json({ error: "Failed to move game" });
  }
});

// Generate unplaced matchups (team pairings only, no time/diamond assignments)
router.post("/tournaments/:tournamentId/generate-matchups", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { divisionId } = req.body;
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.type !== 'pool_play') {
      return res.status(400).json({ error: "Matchup generation is only available for pool play tournaments" });
    }
    
    const allPools = await tournamentService.getPools(tournamentId);
    const allTeams = await teamService.getTeams(tournamentId);
    
    const pools = divisionId 
      ? allPools.filter(p => p.ageDivisionId === divisionId)
      : allPools;
    
    const allGames = await gameService.getGames(tournamentId);
    const poolIds = new Set(pools.map(p => p.id));
    const gamesToDelete = divisionId 
      ? allGames.filter(g => poolIds.has(g.poolId) && !g.isPlayoff)
      : allGames.filter(g => !g.isPlayoff);
    
    for (const game of gamesToDelete) {
      await gameService.deleteGame(game.id);
    }
    
    console.log(`Deleted ${gamesToDelete.length} existing pool play games before generating new matchups`);
    
    const poolsWithTeams = pools.map(pool => ({
      id: pool.id,
      name: pool.name,
      teamIds: allTeams.filter(team => team.poolId === pool.id).map(team => team.id)
    }));
    
    const matchupResult = generateUnplacedMatchups(poolsWithTeams, {
      tournamentId,
      minGameGuarantee: tournament.minGameGuarantee || undefined,
    });
    
    console.log('Generated matchups:', matchupResult.metadata);
    
    const savedMatchups: any[] = [];
    for (const pool of pools) {
      const poolMatchups = matchupResult.matchups.filter(m => m.poolId === pool.id);
      const saved = await tournamentService.replaceMatchups(tournamentId, pool.id, poolMatchups);
      savedMatchups.push(...saved);
    }
    
    console.log(`Saved ${savedMatchups.length} matchups to database`);
    
    return res.status(200).json({
      message: `Generated ${matchupResult.metadata.totalMatchups} matchups. Drag and drop them onto the schedule.`,
      matchups: savedMatchups,
      pools: pools,
      metadata: matchupResult.metadata,
      games: [],
      placedCount: 0,
      failedCount: 0
    });
  } catch (error: any) {
    console.error("Error generating matchups:", error);
    res.status(500).json({ error: "Failed to generate matchups" });
  }
});

// Auto-distribute teams into pools using snake-draft pattern
router.post("/tournaments/:tournamentId/auto-distribute", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { divisionId } = req.body;

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const allTeams = await teamService.getTeams(tournamentId);
    const allPools = await tournamentService.getPools(tournamentId);

    const pools = divisionId 
      ? allPools.filter(p => p.ageDivisionId === divisionId && !p.name.includes("Playoff"))
      : allPools.filter(p => !p.name.includes("Playoff"));

    if (pools.length === 0) {
      return res.status(400).json({ error: "No pools found. Create pools first." });
    }

    const teamsToDistribute = divisionId
      ? allTeams.filter(t => t.ageDivisionId === divisionId && !t.isPlaceholder)
      : allTeams.filter(t => !t.isPlaceholder);

    if (teamsToDistribute.length === 0) {
      return res.status(400).json({ error: "No teams found to distribute" });
    }

    teamsToDistribute.sort((a, b) => {
      if (a.willingToPlayExtra !== b.willingToPlayExtra) {
        return a.willingToPlayExtra ? -1 : 1;
      }
      return 0;
    });

    const updates: Promise<any>[] = [];
    let direction = 1;
    let poolIndex = 0;

    for (let i = 0; i < teamsToDistribute.length; i++) {
      const team = teamsToDistribute[i];
      const pool = pools[poolIndex];

      updates.push(teamService.updateTeam(team.id, { poolId: pool.id }));

      poolIndex += direction;
      if (poolIndex >= pools.length) {
        direction = -1;
        poolIndex = pools.length - 1;
      } else if (poolIndex < 0) {
        direction = 1;
        poolIndex = 0;
      }
    }

    await Promise.all(updates);

    const updatedTeams = await teamService.getTeams(tournamentId);

    res.json({ 
      success: true, 
      message: `Distributed ${teamsToDistribute.length} teams across ${pools.length} pools`,
      teams: updatedTeams
    });

  } catch (error: any) {
    console.error("Auto-distribute failed:", error);
    res.status(500).json({ error: "Distribution failed" });
  }
});

// Generate guaranteed matchups with bridge game logic for uneven pools
router.post("/tournaments/:tournamentId/generate-guaranteed-matchups", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { divisionId } = req.body;

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    if (tournament.type !== 'pool_play') {
      return res.status(400).json({ error: "Matchup generation is only available for pool play tournaments" });
    }

    const minGames = tournament.minGameGuarantee || 3;

    const allTeams = await teamService.getTeams(tournamentId);
    const allPools = await tournamentService.getPools(tournamentId);

    const pools = divisionId 
      ? allPools.filter(p => p.ageDivisionId === divisionId && !p.name.includes("Playoff"))
      : allPools.filter(p => !p.name.includes("Playoff"));

    const teamsWithPools = allTeams.filter(t => 
      t.poolId && 
      pools.some(p => p.id === t.poolId) && 
      !t.isPlaceholder
    );

    if (teamsWithPools.length === 0) {
      return res.status(400).json({ error: "No teams with pool assignments found. Distribute teams first." });
    }

    const allGames = await gameService.getGames(tournamentId);
    const poolIds = new Set(pools.map(p => p.id));
    const gamesToDelete = allGames.filter(g => 
      g.poolId && poolIds.has(g.poolId) && !g.isPlayoff
    );

    for (const game of gamesToDelete) {
      await gameService.deleteGame(game.id);
    }

    console.log(`Deleted ${gamesToDelete.length} existing pool play games`);

    const matchupsGenerated = generateGuaranteedMatchups(teamsWithPools, minGames);

    console.log(`Generated ${matchupsGenerated.length} matchups with minGames=${minGames}`);

    const savedGames: any[] = [];
    for (const matchup of matchupsGenerated) {
      const game = await gameService.createGame({
        id: nanoid(),
        tournamentId,
        poolId: matchup.poolId,
        homeTeamId: matchup.homeTeamId,
        awayTeamId: matchup.awayTeamId,
        status: 'scheduled',
        date: null,
        time: null,
        diamondId: null,
        isPlayoff: false,
        isCrossPool: matchup.isCrossPool,
      });
      savedGames.push(game);
    }

    const crossPoolCount = matchupsGenerated.filter(m => m.isCrossPool).length;

    res.json({
      success: true,
      message: `Generated ${savedGames.length} matchups (${crossPoolCount} bridge games)`,
      games: savedGames,
      metadata: {
        totalMatchups: savedGames.length,
        crossPoolGames: crossPoolCount,
        minGamesPerTeam: minGames
      }
    });

  } catch (error: any) {
    console.error("Generate guaranteed matchups failed:", error);
    res.status(500).json({ error: "Matchup generation failed" });
  }
});

// Auto-place unscheduled games onto the schedule grid
router.post("/tournaments/:tournamentId/auto-place", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { selectedDate, diamondIds } = req.body;

    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    const allGames = await gameService.getGames(tournamentId);
    const allTeams = await teamService.getTeams(tournamentId);
    const allDiamonds = await diamondService.getDiamonds(tournament.organizationId);
    const allocations = await allocationService.getAllocations(tournamentId);
    const matchupsData = await tournamentService.getMatchups(tournamentId);

    const diamonds = diamondIds?.length > 0
      ? allDiamonds.filter(d => diamondIds.includes(d.id))
      : allDiamonds.filter(d => tournament.selectedDiamondIds?.includes(d.id));

    if (diamonds.length === 0) {
      return res.status(400).json({ error: "No diamonds available for scheduling" });
    }

    const matchupsToPlace: typeof matchupsData = [];
    for (const matchup of matchupsData) {
      const existingGame = allGames.find(g => 
        (g.homeTeamId === matchup.homeTeamId && g.awayTeamId === matchup.awayTeamId) ||
        (g.homeTeamId === matchup.awayTeamId && g.awayTeamId === matchup.homeTeamId)
      );
      
      if (!existingGame) {
        matchupsToPlace.push(matchup);
      }
    }

    const unplacedGames = allGames.filter(g => !g.date || !g.time || !g.diamondId);
    
    const totalToPlace = matchupsToPlace.length + unplacedGames.length;
    
    if (totalToPlace === 0) {
      return res.json({ 
        success: true, 
        message: "All games are already placed",
        placedCount: 0,
        failedCount: 0,
        createdFromMatchups: 0
      });
    }

    console.log(`[Auto-Place] ${matchupsToPlace.length} matchups to convert, ${unplacedGames.length} unplaced games`);

    const allDates: string[] = [];
    if (selectedDate) {
      allDates.push(selectedDate);
    } else {
      const start = new Date(tournament.startDate);
      const end = new Date(tournament.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().split('T')[0]);
      }
    }

    const poolPlayDates = allDates.length >= 3 
      ? allDates.slice(0, 2)
      : allDates;
    
    const playoffDates = allDates.length >= 3
      ? allDates.slice(2)
      : allDates;
    
    type DayGameLimit = { date: string; maxGames: number };
    const perDayLimits: DayGameLimit[] = poolPlayDates.map((date, index) => ({
      date,
      maxGames: index === 0 ? 1 : 2
    }));
    
    console.log(`[Auto-Place] Pool play dates: ${poolPlayDates.join(', ')}`);
    console.log(`[Auto-Place] Per-day limits:`, perDayLimits.map(l => `${l.date}=${l.maxGames}`).join(', '));

    const timeSlots: string[] = [];
    for (let hour = 8; hour < 20; hour++) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
      timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    const minRestMinutes = tournament.minRestMinutes || 30;
    const gameDuration = 90;
    
    const crossDayRestHours = 10;

    type GameSlot = { date: string; startMinutes: number; endMinutes: number };
    const teamSchedule: Record<string, GameSlot[]> = {};
    
    for (const game of allGames) {
      if (game.date && game.time) {
        const [h, m] = game.time.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + (game.durationMinutes || gameDuration);
        const slot = { date: game.date, startMinutes, endMinutes };
        
        [game.homeTeamId, game.awayTeamId].forEach(teamId => {
          if (!teamId) return;
          if (!teamSchedule[teamId]) teamSchedule[teamId] = [];
          teamSchedule[teamId].push(slot);
        });
      }
    }

    const diamondSchedule: Record<string, Record<string, GameSlot[]>> = {};
    for (const game of allGames) {
      if (game.date && game.time && game.diamondId) {
        const [h, m] = game.time.split(':').map(Number);
        const startMinutes = h * 60 + m;
        const endMinutes = startMinutes + (game.durationMinutes || gameDuration);
        
        if (!diamondSchedule[game.diamondId]) diamondSchedule[game.diamondId] = {};
        if (!diamondSchedule[game.diamondId][game.date]) diamondSchedule[game.diamondId][game.date] = [];
        diamondSchedule[game.diamondId][game.date].push({ date: game.date, startMinutes, endMinutes });
      }
    }

    const getPrevDay = (dateStr: string): string => {
      const d = new Date(dateStr);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    };

    const checkRestTime = (teamId: string | null, date: string, startMinutes: number, endMinutes: number): boolean => {
      if (!teamId) return true;
      const slots = teamSchedule[teamId] || [];
      
      const sameDay = slots.filter(s => s.date === date);
      for (const existing of sameDay) {
        if (startMinutes < existing.endMinutes + minRestMinutes && endMinutes > existing.startMinutes - minRestMinutes) {
          return false;
        }
      }
      
      const prevDay = getPrevDay(date);
      const prevDaySlots = slots.filter(s => s.date === prevDay);
      for (const existing of prevDaySlots) {
        if (existing.endMinutes >= 18 * 60) {
          const minutesAfterMidnightYesterday = (24 * 60) - existing.endMinutes;
          const totalRestMinutes = minutesAfterMidnightYesterday + startMinutes;
          const requiredRestMinutes = crossDayRestHours * 60;
          
          if (totalRestMinutes < requiredRestMinutes) {
            return false;
          }
        }
      }
      
      return true;
    };

    const checkMaxGamesPerDay = (teamId: string | null, date: string): boolean => {
      if (!teamId) return true;
      const slots = teamSchedule[teamId] || [];
      const gamesOnDay = slots.filter(s => s.date === date).length;
      
      const dayLimit = perDayLimits.find(l => l.date === date);
      const maxForThisDay = dayLimit ? dayLimit.maxGames : 3;
      
      return gamesOnDay < maxForThisDay;
    };

    const checkDiamondSlot = (diamondId: string, date: string, startMinutes: number, endMinutes: number): boolean => {
      const slots = diamondSchedule[diamondId]?.[date] || [];
      for (const existing of slots) {
        if (startMinutes < existing.endMinutes && endMinutes > existing.startMinutes) {
          return false;
        }
      }
      return true;
    };

    const placedGames: any[] = [];
    const failedGames: any[] = [];
    let createdFromMatchups = 0;

    const findValidSlot = (
      homeTeamId: string, 
      awayTeamId: string, 
      skipGameId?: string,
      isPlayoff: boolean = false
    ): { date: string; time: string; diamond: typeof diamonds[0] } | null => {
      const homeTeam = allTeams.find(t => t.id === homeTeamId);
      const awayTeam = allTeams.find(t => t.id === awayTeamId);
      
      const datesToUse = isPlayoff ? playoffDates : poolPlayDates;

      for (const date of datesToUse) {
        if (!checkMaxGamesPerDay(homeTeamId, date) || !checkMaxGamesPerDay(awayTeamId, date)) {
          continue;
        }

        for (const time of timeSlots) {
          const [hours, minutes] = time.split(':').map(Number);
          const startMinutes = hours * 60 + minutes;
          const endMinutes = startMinutes + gameDuration;

          if (!checkRestTime(homeTeamId, date, startMinutes, endMinutes) ||
              !checkRestTime(awayTeamId, date, startMinutes, endMinutes)) {
            continue;
          }

          for (const diamond of diamonds) {
            if (!checkDiamondSlot(diamond.id, date, startMinutes, endMinutes)) {
              continue;
            }

            const gamesOnDiamond = allGames.filter(g => 
              g.diamondId === diamond.id && 
              g.date === date &&
              g.id !== skipGameId
            );

            const validation = validateGameSlot(
              homeTeam,
              awayTeam,
              diamond,
              date,
              time,
              gameDuration,
              gamesOnDiamond,
              allocations,
              { 
                skipGameId,
                teamDivisionId: homeTeam?.ageDivisionId || awayTeam?.ageDivisionId || undefined
              }
            );

            if (validation.valid) {
              return { date, time, diamond };
            }
          }
        }
      }
      return null;
    };

    const updateTracking = (homeTeamId: string, awayTeamId: string, date: string, time: string, diamondId: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const startMinutes = hours * 60 + minutes;
      const endMinutes = startMinutes + gameDuration;
      const newSlot = { date, startMinutes, endMinutes };

      [homeTeamId, awayTeamId].forEach(teamId => {
        if (!teamId) return;
        if (!teamSchedule[teamId]) teamSchedule[teamId] = [];
        teamSchedule[teamId].push(newSlot);
      });

      if (!diamondSchedule[diamondId]) diamondSchedule[diamondId] = {};
      if (!diamondSchedule[diamondId][date]) diamondSchedule[diamondId][date] = [];
      diamondSchedule[diamondId][date].push(newSlot);
    };

    const organizeMatchupsSnakeOrder = (matchupsToOrganize: typeof matchupsToPlace): typeof matchupsToPlace => {
      const byPool: Record<string, typeof matchupsToPlace> = {};
      for (const matchup of matchupsToOrganize) {
        if (!byPool[matchup.poolId]) byPool[matchup.poolId] = [];
        byPool[matchup.poolId].push(matchup);
      }
      
      const poolIds = Object.keys(byPool);
      const snakeOrdered: typeof matchupsToPlace = [];
      
      const maxGamesPerPool = Math.max(...poolIds.map(p => byPool[p].length));
      
      for (let i = 0; i < maxGamesPerPool; i++) {
        for (const poolId of poolIds) {
          if (byPool[poolId][i]) {
            snakeOrdered.push(byPool[poolId][i]);
          }
        }
      }
      
      return snakeOrdered;
    };
    
    const snakeOrderedMatchups = organizeMatchupsSnakeOrder(matchupsToPlace);
    console.log(`[Auto-Place] Snake ordering: ${snakeOrderedMatchups.length} matchups interleaved across pools`);

    for (const matchup of snakeOrderedMatchups) {
      const slot = findValidSlot(matchup.homeTeamId, matchup.awayTeamId, undefined, false);
      const homeTeam = allTeams.find(t => t.id === matchup.homeTeamId);
      const awayTeam = allTeams.find(t => t.id === matchup.awayTeamId);
      
      if (slot) {
        try {
          const pool = await tournamentService.getPoolById(matchup.poolId);
          
          const newGame = await gameService.createGame({
            id: `${tournamentId}-pool-${matchup.poolId}-game-${nanoid(8)}`,
            tournamentId,
            poolId: matchup.poolId,
            homeTeamId: matchup.homeTeamId,
            awayTeamId: matchup.awayTeamId,
            date: slot.date,
            time: slot.time,
            diamondId: slot.diamond.id,
            location: slot.diamond.name,
            status: 'scheduled',
            homeScore: null,
            awayScore: null,
            isPlayoff: false,
            ageDivisionId: homeTeam?.ageDivisionId || pool?.ageDivisionId || null,
            durationMinutes: gameDuration,
          });

          updateTracking(matchup.homeTeamId, matchup.awayTeamId, slot.date, slot.time, slot.diamond.id);

          (allGames as any[]).push(newGame);

          await db.delete(matchups).where(eq(matchups.id, matchup.id));

          placedGames.push(newGame);
          createdFromMatchups++;
          console.log(`[Auto-Place] Placed ${homeTeam?.name} vs ${awayTeam?.name} at ${slot.date} ${slot.time} on ${slot.diamond.name}`);
        } catch (err: any) {
          console.error(`[Auto-Place] Failed to create game for matchup ${matchup.id}:`, err.message);
          failedGames.push({
            id: matchup.id,
            homeTeam: homeTeam?.name,
            awayTeam: awayTeam?.name,
            reason: `Database error: ${err.message}`
          });
        }
      } else {
        failedGames.push({
          id: matchup.id,
          homeTeam: homeTeam?.name,
          awayTeam: awayTeam?.name,
          reason: "No valid slot found (rest time, max games/day, cross-day rest, or diamond conflict)"
        });
      }
    }

    for (const game of unplacedGames) {
      const slot = findValidSlot(game.homeTeamId!, game.awayTeamId!, game.id, game.isPlayoff === true);
      const homeTeam = allTeams.find(t => t.id === game.homeTeamId);
      const awayTeam = allTeams.find(t => t.id === game.awayTeamId);
      
      if (slot) {
        try {
          const updatedGame = await gameService.updateGame(game.id, {
            date: slot.date,
            time: slot.time,
            diamondId: slot.diamond.id,
            location: slot.diamond.name
          });

          updateTracking(game.homeTeamId!, game.awayTeamId!, slot.date, slot.time, slot.diamond.id);

          (allGames as any[]).push({
            ...game,
            date: slot.date,
            time: slot.time,
            diamondId: slot.diamond.id,
            location: slot.diamond.name,
            durationMinutes: gameDuration
          });

          placedGames.push(updatedGame);
          console.log(`[Auto-Place] Placed ${homeTeam?.name} vs ${awayTeam?.name} at ${slot.date} ${slot.time} on ${slot.diamond.name}`);
        } catch (err: any) {
          console.error(`[Auto-Place] Failed to update game ${game.id}:`, err.message);
          failedGames.push({
            id: game.id,
            homeTeam: homeTeam?.name,
            awayTeam: awayTeam?.name,
            reason: `Database error: ${err.message}`
          });
        }
      } else {
        failedGames.push({
          id: game.id,
          homeTeam: homeTeam?.name,
          awayTeam: awayTeam?.name,
          reason: "No valid slot found (rest time, max games/day, cross-day rest, or diamond conflict)"
        });
      }
    }

    res.json({
      success: true,
      message: `Placed ${placedGames.length} of ${totalToPlace} games`,
      placedCount: placedGames.length,
      failedCount: failedGames.length,
      createdFromMatchups,
      games: placedGames,
      failed: failedGames
    });

  } catch (error: any) {
    console.error("Auto-place failed:", error);
    res.status(500).json({ error: "Auto-placement failed" });
  }
});

// Generate pool play schedule (draft - not saved to database)
router.post("/tournaments/:tournamentId/generate-schedule", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { divisionId } = req.body;
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (tournament.type !== 'pool_play') {
      return res.status(400).json({ error: "Schedule generation is only available for pool play tournaments" });
    }
    
    const allPools = await tournamentService.getPools(tournamentId);
    const allTeams = await teamService.getTeams(tournamentId);
    
    const pools = divisionId 
      ? allPools.filter(p => p.ageDivisionId === divisionId)
      : allPools;
    
    console.log('Schedule generation debug:', {
      divisionId,
      allPoolsCount: allPools.length,
      filteredPoolsCount: pools.length,
      allTeamsCount: allTeams.length
    });
    
    const poolsWithTeams = pools.map(pool => ({
      id: pool.id,
      name: pool.name,
      teamIds: allTeams.filter(team => team.poolId === pool.id).map(team => team.id)
    }));
    
    console.log('Pools with teams:', poolsWithTeams.map(p => ({ 
      name: p.name, 
      teamCount: p.teamIds.length 
    })));
    
    if (tournament.minGameGuarantee && tournament.numberOfDiamonds) {
      const startDate = new Date(tournament.startDate);
      const endDate = new Date(tournament.endDate);
      const tournamentDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      const largestPoolSize = Math.max(...poolsWithTeams.map(p => p.teamIds.length));
      const validation = validateGameGuarantee(
        largestPoolSize,
        tournament.minGameGuarantee,
        tournamentDays,
        tournament.numberOfDiamonds
      );
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message });
      }
    }
    
    console.log('Schedule generation config:', {
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      minGameGuarantee: tournament.minGameGuarantee,
      numberOfDiamonds: tournament.numberOfDiamonds,
      hasDiamondDetails: !!tournament.diamondDetails
    });
    
    let diamonds = undefined;
    if (tournament.selectedDiamondIds && tournament.selectedDiamondIds.length > 0) {
      diamonds = [];
      for (const diamondId of tournament.selectedDiamondIds) {
        const diamond = await diamondService.getDiamond(diamondId);
        if (diamond) {
          diamonds.push(diamond);
        }
      }
    }

    const scheduleResult = generatePoolPlaySchedule(poolsWithTeams, {
      tournamentId,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
      minGameGuarantee: tournament.minGameGuarantee || undefined,
      numberOfDiamonds: tournament.numberOfDiamonds || undefined,
      diamondDetails: tournament.diamondDetails ? tournament.diamondDetails as Array<{ venue: string; subVenue?: string }> : undefined,
      diamonds: diamonds,
      minRestMinutes: tournament.minRestMinutes,
      restBetween2nd3rdGame: tournament.restBetween2nd3rdGame,
      maxGamesPerDay: tournament.maxGamesPerDay,
    });
    
    console.log('Generated games count:', scheduleResult.games.length);
    console.log('Violations count:', scheduleResult.violations.length);
    
    res.status(200).json({
      message: `Generated draft schedule with ${scheduleResult.games.length} pool play games`,
      gamesCount: scheduleResult.games.length,
      violationsCount: scheduleResult.violations.length,
      draftGames: scheduleResult.games,
      violations: scheduleResult.violations
    });
  } catch (error: any) {
    console.error("Error generating schedule:", error);
    
    if (error.message && (
      error.message.includes('Cannot schedule all games') ||
      error.message.includes('Cannot guarantee')
    )) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: "Failed to generate schedule" });
  }
});

// Commit draft schedule to database
router.post("/tournaments/:tournamentId/commit-schedule", requireAdmin, async (req, res) => {
  try {
    const { tournamentId } = req.params;
    const { draftGames } = req.body;
    
    if (!draftGames || !Array.isArray(draftGames) || draftGames.length === 0) {
      return res.status(400).json({ error: "Draft games are required" });
    }
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    const validPools = await tournamentService.getPools(tournamentId);
    const validPoolIds = new Set(validPools.map(p => p.id));
    
    const validTeams = await teamService.getTeams(tournamentId);
    const validTeamIds = new Set(validTeams.map(t => t.id));
    
    let diamonds = undefined;
    if (tournament.selectedDiamondIds && tournament.selectedDiamondIds.length > 0) {
      diamonds = [];
      for (const diamondId of tournament.selectedDiamondIds) {
        const diamond = await diamondService.getDiamond(diamondId);
        if (diamond) {
          diamonds.push(diamond);
        }
      }
    }
    
    const constraintErrors: string[] = [];
    
    if (diamonds && diamonds.length > 0) {
      const teamGamesPerDay = new Map<string, Map<string, number>>();
      const teamGameTimes = new Map<string, Array<{ date: string; time: string; gameNumber: number }>>();
      
      for (let i = 0; i < draftGames.length; i++) {
        const game = draftGames[i];
        const gameDate = game.date;
        const gameTime = game.time;
        
        if (game.diamondId) {
          const diamond = diamonds.find(d => d.id === game.diamondId);
          if (!diamond) {
            constraintErrors.push(`Game ${i + 1}: Invalid diamond assignment`);
          } else {
            const parseTime = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
            
            const gameMinutes = parseTime(gameTime);
            const startMinutes = parseTime(diamond.availableStartTime);
            const endMinutes = parseTime(diamond.availableEndTime);
            
            if (gameMinutes < startMinutes || gameMinutes > endMinutes) {
              constraintErrors.push(
                `Game ${i + 1}: Time ${gameTime} is outside diamond "${diamond.name}" available hours (${diamond.availableStartTime}-${diamond.availableEndTime})`
              );
            }
          }
        }
        
        for (const teamId of [game.homeTeamId, game.awayTeamId]) {
          if (!teamId) continue;
          
          if (!teamGamesPerDay.has(teamId)) {
            teamGamesPerDay.set(teamId, new Map());
            teamGameTimes.set(teamId, []);
          }
          
          const dayMap = teamGamesPerDay.get(teamId)!;
          const currentCount = dayMap.get(gameDate) || 0;
          dayMap.set(gameDate, currentCount + 1);
          
          if (tournament.maxGamesPerDay && currentCount + 1 > tournament.maxGamesPerDay) {
            constraintErrors.push(
              `Game ${i + 1}: Team exceeds max ${tournament.maxGamesPerDay} games per day on ${gameDate}`
            );
          }
          
          teamGameTimes.get(teamId)!.push({ 
            date: gameDate, 
            time: gameTime, 
            gameNumber: currentCount + 1 
          });
        }
      }
      
      for (const [teamId, teamGames] of Array.from(teamGameTimes.entries())) {
        teamGames.sort((a: { date: string; time: string; gameNumber: number }, b: { date: string; time: string; gameNumber: number }) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          return a.time.localeCompare(b.time);
        });
        
        for (let i = 1; i < teamGames.length; i++) {
          const prevGame = teamGames[i - 1];
          const currentGame = teamGames[i];
          
          if (prevGame.date === currentGame.date) {
            const parseTime = (t: string) => {
              const [h, m] = t.split(':').map(Number);
              return h * 60 + m;
            };
            
            const prevMinutes = parseTime(prevGame.time);
            const currentMinutes = parseTime(currentGame.time);
            const restMinutes = currentMinutes - prevMinutes;
            
            if (currentGame.gameNumber === 3 && tournament.restBetween2nd3rdGame) {
              if (restMinutes < tournament.restBetween2nd3rdGame) {
                constraintErrors.push(
                  `Team ${teamId}: Only ${restMinutes} minutes rest between 2nd and 3rd game (requires ${tournament.restBetween2nd3rdGame} minutes)`
                );
              }
            }
            else if (tournament.minRestMinutes && restMinutes < tournament.minRestMinutes) {
              constraintErrors.push(
                `Team ${teamId}: Only ${restMinutes} minutes rest between games (requires ${tournament.minRestMinutes} minutes)`
              );
            }
          }
        }
      }
    }
    
    const allocations = await allocationService.getAllocations(tournamentId);
    if (allocations.length > 0) {
      const diamondGamesMap = new Map<string, typeof draftGames>();
      
      for (const game of draftGames) {
        if (game.diamondId) {
          if (!diamondGamesMap.has(game.diamondId)) {
            diamondGamesMap.set(game.diamondId, []);
          }
          diamondGamesMap.get(game.diamondId)!.push(game);
        }
      }
      
      for (let i = 0; i < draftGames.length; i++) {
        const game = draftGames[i];
        if (!game.diamondId || !game.date || !game.time) continue;
        
        const diamond = diamonds?.find(d => d.id === game.diamondId);
        const homeTeam = validTeams.find(t => t.id === game.homeTeamId);
        const awayTeam = validTeams.find(t => t.id === game.awayTeamId);
        const gamesOnDiamond = diamondGamesMap.get(game.diamondId) || [];
        
        const validation = validateGameSlot(
          homeTeam,
          awayTeam,
          diamond,
          game.date,
          game.time,
          game.durationMinutes || 90,
          gamesOnDiamond.filter(g => g !== game),
          allocations,
          { teamDivisionId: homeTeam?.ageDivisionId || undefined }
        );
        
        if (!validation.valid) {
          validation.errors.forEach(err => {
            constraintErrors.push(`Game ${i + 1}: ${err}`);
          });
        }
      }
    }
    
    if (constraintErrors.length > 0) {
      return res.status(400).json({ 
        error: "Schedule violates constraints",
        violations: constraintErrors
      });
    }
    
    const validatedGames = [];
    for (let i = 0; i < draftGames.length; i++) {
      const game = draftGames[i];
      
      if (game.tournamentId !== tournamentId) {
        return res.status(400).json({ 
          error: `Game ${i + 1} belongs to different tournament` 
        });
      }
      
      if (!validPoolIds.has(game.poolId)) {
        return res.status(400).json({ 
          error: `Game ${i + 1} references invalid pool for this tournament` 
        });
      }
      
      if (game.homeTeamId && !validTeamIds.has(game.homeTeamId)) {
        return res.status(400).json({ 
          error: `Game ${i + 1} references invalid home team` 
        });
      }
      if (game.awayTeamId && !validTeamIds.has(game.awayTeamId)) {
        return res.status(400).json({ 
          error: `Game ${i + 1} references invalid away team` 
        });
      }
      
      try {
        const validated = insertGameSchema.parse(game);
        const safeGame = {
          ...validated,
          id: `${tournamentId}-pool-${game.poolId}-game-${nanoid(8)}`
        };
        validatedGames.push(safeGame);
      } catch (validationError: any) {
        return res.status(400).json({ 
          error: `Game ${i + 1} validation failed: ${validationError.message}` 
        });
      }
    }
    
    const createdGames = [];
    for (const game of validatedGames) {
      const created = await gameService.createGame(game);
      createdGames.push(created);
    }
    
    res.status(201).json({
      message: `Successfully committed ${createdGames.length} pool play games`,
      gamesCreated: createdGames.length,
      games: createdGames
    });
  } catch (error: any) {
    console.error("Error committing schedule:", error);
    res.status(500).json({ error: "Failed to commit schedule" });
  }
});

// Place a single game (for drag-and-drop schedule builder)
router.post("/games/place", requireAdmin, async (req, res) => {
  try {
    const { tournamentId, poolId, homeTeamId, awayTeamId, date, time, diamondId, matchupId, durationMinutes } = req.body;
    
    if (!tournamentId || !poolId || !homeTeamId || !awayTeamId || !date || !time) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    const teams = await teamService.getTeams(tournamentId);
    const validTeamIds = new Set(teams.map(t => t.id));
    
    if (!validTeamIds.has(homeTeamId) || !validTeamIds.has(awayTeamId)) {
      return res.status(400).json({ error: "Invalid team ID" });
    }
    
    let diamond = null;
    let location = '';
    let subVenue = '';
    
    if (diamondId) {
      diamond = await diamondService.getDiamond(diamondId);
      if (!diamond) {
        return res.status(400).json({ error: "Invalid diamond ID" });
      }
      location = diamond.location || diamond.name;
      subVenue = diamond.name;
      
      const parseTime = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      };
      
      const gameMinutes = parseTime(time);
      const startMinutes = parseTime(diamond.availableStartTime);
      const endMinutes = parseTime(diamond.availableEndTime);
      
      if (gameMinutes < startMinutes || gameMinutes > endMinutes) {
        return res.status(400).json({ 
          error: `Time ${time} is outside diamond "${diamond.name}" available hours (${diamond.availableStartTime}-${diamond.availableEndTime})`
        });
      }
    }
    
    const allGames = await gameService.getGames(tournamentId);
    const gamesAtTime = allGames.filter(g => g.date === date && g.time === time);
    
    for (const game of gamesAtTime) {
      if (game.homeTeamId === homeTeamId || game.awayTeamId === homeTeamId ||
          game.homeTeamId === awayTeamId || game.awayTeamId === awayTeamId) {
        return res.status(400).json({ 
          error: "One or both teams are already scheduled at this time" 
        });
      }
      
      if (diamondId && game.diamondId === diamondId) {
        return res.status(400).json({ 
          error: `Diamond "${diamond!.name}" is already in use at this time` 
        });
      }
    }
    
    if (tournament.minRestMinutes || tournament.maxGamesPerDay) {
      const gamesOnDate = allGames.filter(g => g.date === date);
      
      for (const teamId of [homeTeamId, awayTeamId]) {
        const teamGames = gamesOnDate.filter(g => 
          g.homeTeamId === teamId || g.awayTeamId === teamId
        );
        
        if (tournament.maxGamesPerDay && teamGames.length >= tournament.maxGamesPerDay) {
          const team = teams.find(t => t.id === teamId);
          return res.status(400).json({ 
            error: `Team "${team?.name}" already has ${tournament.maxGamesPerDay} games on ${date}` 
          });
        }
        
        if (tournament.minRestMinutes) {
          const parseTime = (t: string) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
          };
          
          const gameTimeMinutes = parseTime(time);
          
          for (const existingGame of teamGames) {
            const existingTimeMinutes = parseTime(existingGame.time);
            const timeDiff = Math.abs(gameTimeMinutes - existingTimeMinutes);
            
            if (timeDiff < tournament.minRestMinutes) {
              const team = teams.find(t => t.id === teamId);
              return res.status(400).json({ 
                error: `Team "${team?.name}" needs ${tournament.minRestMinutes} minutes rest between games (only ${timeDiff} minutes between ${existingGame.time} and ${time})` 
              });
            }
          }
        }
      }
    }
    
    const homeTeam = teams.find(t => t.id === homeTeamId);
    const awayTeam = teams.find(t => t.id === awayTeamId);
    const allocations = await allocationService.getAllocations(tournamentId);
    const gamesOnDiamond = diamondId 
      ? allGames.filter(g => g.diamondId === diamondId)
      : [];
    
    const validation = validateGameSlot(
      homeTeam,
      awayTeam,
      diamond || undefined,
      date,
      time,
      durationMinutes || 90,
      gamesOnDiamond,
      allocations,
      { teamDivisionId: homeTeam?.ageDivisionId || undefined }
    );
    
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.errors.join('; '),
        errors: validation.errors,
        warnings: validation.warnings
      });
    }
    
    const gameId = `${tournamentId}-pool-${poolId}-game-${nanoid(8)}`;
    const gameData = {
      id: gameId,
      homeTeamId,
      awayTeamId,
      tournamentId,
      poolId,
      status: 'scheduled' as const,
      date,
      time,
      durationMinutes: durationMinutes || 90,
      location,
      subVenue,
      diamondId: diamondId || null,
      matchupId: matchupId || null,
      isPlayoff: false,
      forfeitStatus: 'none' as const,
      homeScore: null,
      awayScore: null
    };
    
    const createdGame = await gameService.createGame(gameData);
    
    res.status(201).json({
      message: "Game placed successfully",
      game: createdGame
    });
  } catch (error: any) {
    console.error("Error placing game:", error);
    res.status(500).json({ error: "Failed to place game" });
  }
});

// Standings report (division-scoped)
router.get("/tournaments/:tournamentId/standings-report", requireAdmin, async (req, res) => {
  try {
    const tournamentId = req.params.tournamentId;
    const divisionId = req.query.divisionId as string;
    
    if (!divisionId) {
      return res.status(400).json({ 
        error: "Division ID is required. Please specify divisionId query parameter." 
      });
    }
    
    const tournament = await tournamentService.getTournament(tournamentId);
    if (!tournament) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    
    if (!tournament.playoffFormat || !tournament.seedingPattern) {
      return res.status(400).json({ 
        error: "Tournament playoff format or seeding pattern not configured. Please configure these settings first." 
      });
    }
    
    const divisions = await tournamentService.getAgeDivisions(tournamentId);
    const division = divisions.find(d => d.id === divisionId);
    if (!division || division.tournamentId !== tournamentId) {
      return res.status(404).json({ 
        error: "Division not found or does not belong to this tournament" 
      });
    }
    
    const allPools = await tournamentService.getPools(tournamentId);
    const divisionPools = allPools.filter(p => p.ageDivisionId === division.id);
    const regularPools = divisionPools.filter(p => !p.name.toLowerCase().includes('playoff'));
    
    if (regularPools.length === 0) {
      return res.status(400).json({ 
        error: "No regular pools found for standings calculation" 
      });
    }
    
    const allTeams = await teamService.getTeams(tournamentId);
    const regularPoolIds = regularPools.map(p => p.id);
    const divisionTeams = allTeams.filter(t => regularPoolIds.includes(t.poolId));
    
    if (divisionTeams.length === 0) {
      return res.status(400).json({ 
        error: "No teams found in division" 
      });
    }
    
    const allGames = await gameService.getGames(tournamentId);
    const teamIds = divisionTeams.map(t => t.id);
    const poolPlayGames = allGames.filter(g => 
      g.status === 'completed' &&
      g.isPlayoff === false && 
      teamIds.includes(g.homeTeamId) && teamIds.includes(g.awayTeamId)
    );
    
    const poolStandingsData = regularPools.map(pool => {
      const poolTeams = divisionTeams.filter(t => t.poolId === pool.id);
      const poolTeamIds = poolTeams.map(t => t.id);
      
      const poolGames = poolPlayGames.filter(g => 
        poolTeamIds.includes(g.homeTeamId) && poolTeamIds.includes(g.awayTeamId)
      );
      
      const standings = calculateStandingsWithTiebreaking(poolTeams, poolGames);
      return {
        pool,
        standings,
      };
    });
    
    const standingsForSeeding = poolStandingsData.flatMap(({ pool, standings }) =>
      standings.map(s => ({
        teamId: s.teamId,
        rank: s.rank,
        poolId: s.poolId,
        poolName: pool.name,
      }))
    );
    
    const seededTeams = getPlayoffTeamsFromStandings(
      standingsForSeeding,
      tournament.playoffFormat,
      tournament.seedingPattern as any,
      divisionPools.filter(p => !p.name.toLowerCase().includes('playoff')).length
    );
    
    if (seededTeams.length === 0) {
      return res.status(400).json({ 
        error: "No playoff teams could be determined from current standings" 
      });
    }
    
    const statsMap = new Map();
    poolStandingsData.forEach(({ standings }) => {
      standings.forEach(standing => {
        statsMap.set(standing.teamId, standing);
      });
    });
    
    const standingsReport = seededTeams.map((seededTeam) => {
      const stats = statsMap.get(seededTeam.teamId);
      if (!stats) {
        console.warn(`No stats found for team ${seededTeam.teamId}`);
        return null;
      }
      
      return {
        rank: seededTeam.seed,
        teamName: stats.teamName,
        poolName: seededTeam.poolName || stats.poolId,
        poolRank: seededTeam.poolRank || stats.rank,
        record: `${stats.wins}-${stats.losses}-${stats.ties}`,
        points: stats.points,
        runsFor: stats.runsFor,
        runsAgainst: stats.runsAgainst,
        runDifferential: stats.runsFor - stats.runsAgainst,
        tieBreaker_RunsAgainstPerInning: stats.defensiveInnings > 0 
          ? (stats.runsAgainst / stats.defensiveInnings).toFixed(2) 
          : 'N/A',
        offensiveInnings: stats.offensiveInnings,
        defensiveInnings: stats.defensiveInnings,
      };
    }).filter(Boolean);
    
    res.json(standingsReport);
  } catch (error) {
    console.error("Error generating standings report:", error);
    res.status(500).json({ error: "Failed to generate standings report" });
  }
});

// Playoff bracket generation
router.post("/tournaments/:tournamentId/divisions/:divisionId/generate-bracket", requireAdmin, async (req, res) => {
  try {
    const { tournamentId, divisionId } = req.params;
    const gamesCreated = await playoffService.generatePlayoffBracket(tournamentId, divisionId);
    res.status(201).json({ 
      message: `Generated ${gamesCreated.length} playoff games`, 
      games: gamesCreated 
    });
  } catch (error) {
    console.error("Error generating playoff bracket:", error);
    res.status(400).json({ error: (error as any).message || "Failed to generate playoff bracket" });
  }
});

// Tournament games for organization's diamonds (for calendar view)
router.get("/tournaments/organization-settings/games", isAuthenticated, async (req: any, res) => {
  try {
    const { organizationId, startDate, endDate, diamondId } = req.query;
    
    if (!organizationId) {
      return res.status(400).json({ error: "organizationId is required" });
    }
    
    const organizationDiamonds = await diamondService.getDiamonds(organizationId as string);
    const organizationDiamondIds = organizationDiamonds.map(d => d.id);
    
    if (organizationDiamondIds.length === 0) {
      return res.json([]);
    }
    
    const allGames = await gameService.getAllGames();
    
    const filteredGames = allGames.filter(game => {
      if (!game.diamondId) return false;
      
      const isOrgDiamond = organizationDiamondIds.includes(game.diamondId);
      if (!isOrgDiamond) return false;
      
      if (diamondId && game.diamondId !== diamondId) return false;
      
      if (startDate && game.date < (startDate as string)) return false;
      if (endDate && game.date > (endDate as string)) return false;
      
      return true;
    });
    
    res.json(filteredGames);
  } catch (error) {
    console.error("Error fetching tournament games:", error);
    res.status(500).json({ error: "Failed to fetch tournament games" });
  }
});

// Get today's games for an organization (for SMS targeting by diamond)
router.get("/organizations/:orgId/games/today", requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const today = new Date().toISOString().split('T')[0];
    
    const orgTournaments = await db.select().from(tournaments)
      .where(eq(tournaments.organizationId, orgId));
    
    if (orgTournaments.length === 0) {
      return res.json([]);
    }
    
    const todaysGames = await db.select().from(games)
      .where(
        and(
          sql`${games.tournamentId} IN (${sql.join(orgTournaments.map(t => sql`${t.id}`), sql`, `)})`,
          eq(games.date, today)
        )
      );
    
    res.json(todaysGames);
  } catch (error) {
    console.error("Error fetching today's games:", error);
    res.status(500).json({ error: "Failed to fetch today's games" });
  }
});

export default router;
