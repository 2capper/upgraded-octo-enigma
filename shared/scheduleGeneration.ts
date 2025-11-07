import { nanoid } from 'nanoid';

export interface ScheduleGameInput {
  homeTeamId: string;
  awayTeamId: string;
  poolId: string;
  poolName?: string;
}

export interface DiamondDetail {
  venue: string;
  subVenue?: string;
}

export interface Diamond {
  id: string;
  organizationId: string;
  name: string;
  location: string | null;
  availableStartTime: string;
  availableEndTime: string;
  hasLights: boolean;
}

export interface ScheduleGenerationOptions {
  tournamentId: string;
  startDate: string;
  endDate: string;
  minGameGuarantee?: number;
  numberOfDiamonds?: number;
  diamondDetails?: DiamondDetail[];
  diamonds?: Diamond[];
  gamesPerDay?: number; // Optional: default to 4
  gameDurationMinutes?: number; // Optional: default to 90
  startTime?: string; // Optional: default to "09:00"
  minRestMinutes?: number; // Optional: default to 30
  restBetween2nd3rdGame?: number; // Optional: default to 60
  maxGamesPerDay?: number; // Optional: default to 3
}

export interface GeneratedGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  tournamentId: string;
  poolId: string;
  status: 'scheduled';
  date: string;
  time: string;
  location: string;
  subVenue: string;
  diamondId?: string | null;
  isPlayoff: false;
  forfeitStatus: 'none';
  homeScore: null;
  awayScore: null;
  violations?: string[];
}

export interface ScheduleViolation {
  gameId: string;
  teamId?: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ScheduleValidationResult {
  games: GeneratedGame[];
  violations: ScheduleViolation[];
}

interface GameInfo {
  gameId: string;
  date: string;
  time: string;
  teamId: string;
}

/**
 * Generate round-robin matchups for a list of teams
 * Returns an array of [homeTeamIndex, awayTeamIndex] pairs
 * Uses the circle method algorithm for round-robin scheduling
 */
export function generateRoundRobinMatchups(teamCount: number): [number, number][] {
  const matchups: [number, number][] = [];
  
  if (teamCount < 2) return matchups;
  
  // For odd number of teams, add a "bye" placeholder (will be filtered out)
  const isOdd = teamCount % 2 === 1;
  const totalSlots = isOdd ? teamCount + 1 : teamCount;
  
  // Create array of team indices (0 to teamCount-1, plus -1 for bye if odd)
  const teams = Array.from({ length: totalSlots }, (_, i) => i < teamCount ? i : -1);
  
  // Round-robin: fix position 0, rotate others
  for (let round = 0; round < totalSlots - 1; round++) {
    // Pair teams for this round
    for (let i = 0; i < totalSlots / 2; i++) {
      const home = teams[i];
      const away = teams[totalSlots - 1 - i];
      
      // Skip if either team is the bye (-1)
      if (home === -1 || away === -1) continue;
      
      matchups.push([home, away]);
    }
    
    // Rotate all positions except position 0
    const last = teams.pop()!;
    teams.splice(1, 0, last);
  }
  
  return matchups;
}

/**
 * Calculate minimum games per team based on pool size using round-robin
 */
export function calculateMinGamesPerTeam(teamCount: number): number {
  // In a round-robin, each team plays every other team once
  return teamCount - 1;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Calculate time difference in minutes between two times on the same day
 */
function getTimeDifferenceMinutes(time1: string, time2: string): number {
  return Math.abs(parseTimeToMinutes(time2) - parseTimeToMinutes(time1));
}

/**
 * Check if a time is within a time range (all in HH:MM format)
 */
function isTimeInRange(time: string, startTime: string, endTime: string): boolean {
  const timeMinutes = parseTimeToMinutes(time);
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

/**
 * Generate pool play schedule with game guarantee, venue assignment, and constraint validation
 */
export function generatePoolPlaySchedule(
  pools: Array<{ id: string; name: string; teamIds: string[] }>,
  options: ScheduleGenerationOptions
): ScheduleValidationResult {
  const games: GeneratedGame[] = [];
  const violations: ScheduleViolation[] = [];
  const teamSchedules = new Map<string, GameInfo[]>();
  
  const {
    tournamentId,
    startDate,
    endDate,
    minGameGuarantee,
    numberOfDiamonds = 1,
    diamondDetails = [],
    diamonds = [],
    gamesPerDay = 4,
    gameDurationMinutes = 90,
    startTime = '09:00',
    minRestMinutes = 30,
    restBetween2nd3rdGame = 60,
    maxGamesPerDay = 3,
  } = options;
  
  // Use diamonds if provided, otherwise fall back to legacy numberOfDiamonds
  const useDiamonds = diamonds.length > 0;
  const effectiveNumberOfDiamonds = useDiamonds ? diamonds.length : numberOfDiamonds;
  
  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  const tournamentDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  let gameCounter = 0;
  let currentDate = new Date(start);
  let currentDayGames = 0;
  let currentDiamondIndex = 0;
  
  /**
   * Check constraints for a team playing a game at a specific date/time
   */
  function checkTeamConstraints(
    teamId: string,
    gameId: string,
    gameDate: string,
    gameTime: string
  ): string[] {
    const teamViolations: string[] = [];
    const teamGames = teamSchedules.get(teamId) || [];
    const gamesOnDate = teamGames.filter(g => g.date === gameDate);
    
    if (gamesOnDate.length === 0) {
      return teamViolations;
    }
    
    // Check max games per day
    if (gamesOnDate.length >= maxGamesPerDay) {
      const violation = `Team exceeds maximum ${maxGamesPerDay} games per day (already has ${gamesOnDate.length} games on ${gameDate})`;
      teamViolations.push(violation);
      violations.push({
        gameId,
        teamId,
        message: violation,
        severity: 'error',
      });
    }
    
    // Sort games by time to check rest periods
    const sortedGames = [...gamesOnDate].sort((a, b) => 
      parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
    );
    
    // Find where this game would fit in the schedule
    const gameTimeMinutes = parseTimeToMinutes(gameTime);
    
    // Check rest time between consecutive games
    for (const existingGame of sortedGames) {
      const timeDiff = getTimeDifferenceMinutes(existingGame.time, gameTime);
      
      // Determine if this is the 2nd/3rd game scenario
      const gamePosition = sortedGames.length + 1;
      const requiredRest = (gamePosition === 2 || gamePosition === 3) 
        ? restBetween2nd3rdGame 
        : minRestMinutes;
      
      if (timeDiff < requiredRest) {
        const violation = `Team has insufficient rest time (${timeDiff} minutes) between games at ${existingGame.time} and ${gameTime} on ${gameDate}. Required: ${requiredRest} minutes`;
        teamViolations.push(violation);
        violations.push({
          gameId,
          teamId,
          message: violation,
          severity: 'warning',
        });
      }
    }
    
    return teamViolations;
  }
  
  /**
   * Add a game to team schedules for constraint tracking
   */
  function addToTeamSchedule(teamId: string, gameInfo: GameInfo): void {
    if (!teamSchedules.has(teamId)) {
      teamSchedules.set(teamId, []);
    }
    teamSchedules.get(teamId)!.push(gameInfo);
  }
  
  // Generate games for each pool
  pools.forEach((pool) => {
    const teamIds = pool.teamIds;
    const teamCount = teamIds.length;
    
    console.log(`Pool ${pool.name}: ${teamCount} teams, ${teamIds.length} teamIds`);
    
    if (teamCount < 2) {
      console.log(`Skipping pool ${pool.name} - less than 2 teams`);
      return;
    }
    
    // Generate round-robin matchups
    const matchups = generateRoundRobinMatchups(teamCount);
    const naturalMinGames = calculateMinGamesPerTeam(teamCount);
    
    console.log(`Pool ${pool.name}: ${matchups.length} matchups, naturalMinGames=${naturalMinGames}, minGameGuarantee=${minGameGuarantee}`);
    
    // Determine how many times to run round-robin to meet guarantee
    let roundsNeeded = 1;
    if (minGameGuarantee && minGameGuarantee > naturalMinGames) {
      roundsNeeded = Math.ceil(minGameGuarantee / naturalMinGames);
    }
    
    console.log(`Pool ${pool.name}: roundsNeeded=${roundsNeeded}`);
    
    // Generate games for required number of rounds
    for (let round = 0; round < roundsNeeded; round++) {
      for (const matchup of matchups) {
        const [homeIdx, awayIdx] = matchup;
        
        // Skip if game limit for the day is reached, move to next day
        if (currentDayGames >= gamesPerDay * effectiveNumberOfDiamonds) {
          currentDate.setDate(currentDate.getDate() + 1);
          currentDayGames = 0;
          currentDiamondIndex = 0;
          
          // Check if we've exceeded tournament dates
          if (currentDate > end) {
            const totalCapacity = tournamentDays * gamesPerDay * effectiveNumberOfDiamonds;
            const gamesScheduledSoFar = games.length;
            const gamesStillNeeded = roundsNeeded * matchups.length - (games.filter(g => g.poolId === pool.id).length);
            throw new Error(
              `Cannot schedule all games within tournament dates (${startDate} to ${endDate}). ` +
              `Pool "${pool.name}" needs ${gamesStillNeeded} more games but tournament capacity is exhausted (${gamesScheduledSoFar}/${totalCapacity} games scheduled). ` +
              `Consider: extending tournament dates, adding more diamonds, reducing minimum game guarantee, or increasing games per day.`
            );
          }
        }
        
        // Calculate game time
        const gameSlot = Math.floor(currentDayGames / effectiveNumberOfDiamonds);
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMinute + (gameSlot * gameDurationMinutes);
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        const gameDate = currentDate.toISOString().split('T')[0];
        const gameId = `${tournamentId}-pool-${pool.id}-game-${nanoid(8)}`;
        const gameViolations: string[] = [];
        
        // Get diamond assignment
        let diamondId: string | null = null;
        let location = 'Tournament Venue';
        let subVenue = `Field ${currentDiamondIndex + 1}`;
        
        if (useDiamonds) {
          const diamond = diamonds[currentDiamondIndex];
          diamondId = diamond.id;
          location = diamond.location || 'Tournament Venue';
          subVenue = diamond.name;
          
          // Check diamond availability
          if (!isTimeInRange(time, diamond.availableStartTime, diamond.availableEndTime)) {
            const violation = `Game time ${time} is outside diamond "${diamond.name}" available hours (${diamond.availableStartTime} - ${diamond.availableEndTime})`;
            gameViolations.push(violation);
            violations.push({
              gameId,
              message: violation,
              severity: 'error',
            });
          }
        } else if (diamondDetails.length > 0) {
          // Legacy diamondDetails support
          const diamond = diamondDetails[currentDiamondIndex] || { 
            venue: 'Tournament Venue', 
            subVenue: `Field ${currentDiamondIndex + 1}` 
          };
          location = diamond.venue;
          subVenue = diamond.subVenue || '';
        }
        
        const homeTeamId = teamIds[homeIdx];
        const awayTeamId = teamIds[awayIdx];
        
        // Check constraints for both teams
        const homeViolations = checkTeamConstraints(homeTeamId, gameId, gameDate, time);
        const awayViolations = checkTeamConstraints(awayTeamId, gameId, gameDate, time);
        
        gameViolations.push(...homeViolations, ...awayViolations);
        
        // Create game (even if it has violations)
        const game: GeneratedGame = {
          id: gameId,
          homeTeamId,
          awayTeamId,
          tournamentId,
          poolId: pool.id,
          status: 'scheduled',
          date: gameDate,
          time,
          location,
          subVenue,
          diamondId,
          isPlayoff: false,
          forfeitStatus: 'none',
          homeScore: null,
          awayScore: null,
          violations: gameViolations.length > 0 ? gameViolations : undefined,
        };
        
        games.push(game);
        
        // Add to team schedules for tracking
        addToTeamSchedule(homeTeamId, {
          gameId,
          date: gameDate,
          time,
          teamId: homeTeamId,
        });
        addToTeamSchedule(awayTeamId, {
          gameId,
          date: gameDate,
          time,
          teamId: awayTeamId,
        });
        
        currentDayGames++;
        currentDiamondIndex = (currentDiamondIndex + 1) % effectiveNumberOfDiamonds;
        gameCounter++;
      }
    }
  });
  
  return {
    games,
    violations,
  };
}

/**
 * Validate that minimum game guarantee is achievable
 */
export function validateGameGuarantee(
  teamCount: number,
  minGameGuarantee: number,
  tournamentDays: number,
  numberOfDiamonds: number,
  gamesPerDay: number = 4
): { valid: boolean; message?: string } {
  const naturalMinGames = calculateMinGamesPerTeam(teamCount);
  const maxGamesPerDay = numberOfDiamonds * gamesPerDay;
  const maxPossibleGames = tournamentDays * maxGamesPerDay;
  const totalGamesNeeded = teamCount * minGameGuarantee / 2; // Each game involves 2 teams
  
  if (totalGamesNeeded > maxPossibleGames) {
    return {
      valid: false,
      message: `Cannot guarantee ${minGameGuarantee} games per team with ${numberOfDiamonds} diamonds over ${tournamentDays} days. Maximum possible: ${Math.floor(maxPossibleGames * 2 / teamCount)} games per team.`,
    };
  }
  
  return { valid: true };
}
