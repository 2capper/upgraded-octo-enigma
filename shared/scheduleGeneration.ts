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

export interface ScheduleGenerationOptions {
  tournamentId: string;
  startDate: string;
  endDate: string;
  minGameGuarantee?: number;
  numberOfDiamonds?: number;
  diamondDetails?: DiamondDetail[];
  gamesPerDay?: number; // Optional: default to 4
  gameDurationMinutes?: number; // Optional: default to 90
  startTime?: string; // Optional: default to "09:00"
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
  isPlayoff: false;
  forfeitStatus: 'none';
  homeScore: null;
  awayScore: null;
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
 * Generate pool play schedule with game guarantee and venue assignment
 */
export function generatePoolPlaySchedule(
  pools: Array<{ id: string; name: string; teamIds: string[] }>,
  options: ScheduleGenerationOptions
): GeneratedGame[] {
  const games: GeneratedGame[] = [];
  const {
    tournamentId,
    startDate,
    endDate,
    minGameGuarantee,
    numberOfDiamonds = 1,
    diamondDetails = [],
    gamesPerDay = 4,
    gameDurationMinutes = 90,
    startTime = '09:00',
  } = options;
  
  // Parse dates
  const start = new Date(startDate);
  const end = new Date(endDate);
  const tournamentDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  let gameCounter = 0;
  let currentDate = new Date(start);
  let currentDayGames = 0;
  let currentDiamondIndex = 0;
  
  // Generate games for each pool
  pools.forEach((pool) => {
    const teamIds = pool.teamIds;
    const teamCount = teamIds.length;
    
    console.log(`Pool ${pool.name}: ${teamCount} teams, ${teamIds.length} teamIds`);
    
    if (teamCount < 2) {
      console.log(`Skipping pool ${pool.name} - less than 2 teams`);
      return; // Skip pools with less than 2 teams
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
        if (currentDayGames >= gamesPerDay * numberOfDiamonds) {
          currentDate.setDate(currentDate.getDate() + 1);
          currentDayGames = 0;
          currentDiamondIndex = 0;
          
          // Check if we've exceeded tournament dates
          if (currentDate > end) {
            const totalCapacity = tournamentDays * gamesPerDay * numberOfDiamonds;
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
        const gameSlot = Math.floor(currentDayGames / numberOfDiamonds);
        const [startHour, startMinute] = startTime.split(':').map(Number);
        const totalMinutes = startHour * 60 + startMinute + (gameSlot * gameDurationMinutes);
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        
        // Get venue details for current diamond
        const diamond = diamondDetails[currentDiamondIndex] || { 
          venue: 'Tournament Venue', 
          subVenue: `Field ${currentDiamondIndex + 1}` 
        };
        
        // Create game
        games.push({
          id: `${tournamentId}-pool-${pool.id}-game-${nanoid(8)}`,
          homeTeamId: teamIds[homeIdx],
          awayTeamId: teamIds[awayIdx],
          tournamentId,
          poolId: pool.id,
          status: 'scheduled',
          date: currentDate.toISOString().split('T')[0],
          time,
          location: diamond.venue,
          subVenue: diamond.subVenue || '',
          isPlayoff: false,
          forfeitStatus: 'none',
          homeScore: null,
          awayScore: null,
        });
        
        currentDayGames++;
        currentDiamondIndex = (currentDiamondIndex + 1) % numberOfDiamonds;
        gameCounter++;
      }
    }
  });
  
  return games;
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
