import { type BracketTemplate, getBracketTemplate, type BracketMatchup } from './bracketTemplates';
import { 
  type SeedingPattern, 
  type SeededTeam,
  generateTop4Matchups,
  generateTop6Matchups,
  generateTop8Matchups,
} from './seedingPatterns';

export interface GeneratedPlayoffGame {
  tournamentId: string;
  divisionId: string;
  round: number;
  gameNumber: number;
  bracket: 'winners' | 'losers' | 'championship';
  team1Id: string | null;
  team2Id: string | null;
  team1Source?: { gameNumber: number; position: 'winner' | 'loser' };
  team2Source?: { gameNumber: number; position: 'winner' | 'loser' };
}

export interface BracketGenerationOptions {
  tournamentId: string;
  divisionId: string;
  playoffFormat: string;
  teamCount: number;
  seededTeams: Array<{ teamId: string; seed: number; teamName?: string; poolName?: string; poolRank?: number }>;
  seedingPattern?: SeedingPattern; // Optional seeding pattern for pool play tournaments
}

export function generateBracketGames(options: BracketGenerationOptions): GeneratedPlayoffGame[] {
  const { tournamentId, divisionId, playoffFormat, teamCount, seededTeams, seedingPattern } = options;
  
  // For pool play formats with seeding patterns, use dynamic bracket generation
  if (seedingPattern && (playoffFormat === 'top_4' || playoffFormat === 'top_6' || playoffFormat === 'top_8')) {
    return generatePoolPlayBracket(options);
  }
  
  // Convert 'all_seeded' format to appropriate single elimination template based on team count
  let bracketFormat = playoffFormat;
  if (playoffFormat === 'all_seeded') {
    bracketFormat = `single_elim_${teamCount}`;
  }
  
  // Special handling for legacy top_8_four_pools format (backward compatibility)
  if (playoffFormat === 'top_8_four_pools') {
    bracketFormat = 'top_8_four_pools';
  }
  
  // Get the bracket template
  const template = getBracketTemplate(bracketFormat, teamCount);
  if (!template) {
    console.warn(`No bracket template found for ${bracketFormat} with ${teamCount} teams`);
    return [];
  }
  
  // Create a lookup map for teams by seed
  const teamsBySeed = new Map<number, string>();
  seededTeams.forEach(({ teamId, seed }) => {
    teamsBySeed.set(seed, teamId);
  });
  
  // Generate playoff games from template
  return template.matchups.map((matchup) => {
    const team1Id = matchup.team1Seed ? teamsBySeed.get(matchup.team1Seed) || null : null;
    const team2Id = matchup.team2Seed ? teamsBySeed.get(matchup.team2Seed) || null : null;
    
    return {
      tournamentId,
      divisionId,
      round: matchup.round,
      gameNumber: matchup.gameNumber,
      bracket: matchup.bracket,
      team1Id,
      team2Id,
      team1Source: matchup.team1Source,
      team2Source: matchup.team2Source,
    };
  });
}

/**
 * Generate pool play bracket using dynamic seeding patterns
 */
function generatePoolPlayBracket(options: BracketGenerationOptions): GeneratedPlayoffGame[] {
  const { tournamentId, divisionId, playoffFormat, seededTeams, seedingPattern } = options;
  
  if (!seedingPattern) {
    console.warn('No seeding pattern provided for pool play bracket');
    return [];
  }
  
  // Convert seededTeams to SeededTeam format
  const teams: SeededTeam[] = seededTeams.map(t => ({
    seed: t.seed,
    teamId: t.teamId,
    teamName: t.teamName || '',
    poolName: t.poolName,
    poolRank: t.poolRank,
  }));
  
  // Generate first round matchups based on format and seeding pattern
  let firstRoundMatchups;
  let gameNumberOffset = 1;
  
  if (playoffFormat === 'top_8') {
    firstRoundMatchups = generateTop8Matchups(seedingPattern, teams);
  } else if (playoffFormat === 'top_6') {
    firstRoundMatchups = generateTop6Matchups(seedingPattern, teams);
    gameNumberOffset = 1; // Top 6 starts at game 1
  } else if (playoffFormat === 'top_4') {
    firstRoundMatchups = generateTop4Matchups(seedingPattern, teams);
  } else {
    console.warn(`Unsupported playoff format for dynamic seeding: ${playoffFormat}`);
    return [];
  }
  
  // Create a lookup map for teams by seed
  const teamsBySeed = new Map<number, string>();
  seededTeams.forEach(({ teamId, seed }) => {
    teamsBySeed.set(seed, teamId);
  });
  
  // Generate first round games
  const games: GeneratedPlayoffGame[] = firstRoundMatchups.map((matchup, index) => ({
    tournamentId,
    divisionId,
    round: 1,
    gameNumber: gameNumberOffset + index,
    bracket: 'winners',
    team1Id: teamsBySeed.get(matchup.team1Seed) || null,
    team2Id: teamsBySeed.get(matchup.team2Seed) || null,
  }));
  
  // For Top 6: Add semifinals and finals
  // With standard seeding, top 2 seeds get byes
  // With cross-pool, all 6 teams play in first round (3 games), then winners advance
  if (playoffFormat === 'top_6') {
    if (seedingPattern === 'standard') {
      // Standard: Top 2 seeds get byes
      // Quarterfinals: Game 1 (3v6), Game 2 (4v5)
      // Semifinals: Seed 1 gets easier path (winner of 4v5), Seed 2 gets harder path (winner of 3v6)
      const semifinals: GeneratedPlayoffGame[] = [
        {
          tournamentId,
          divisionId,
          round: 2,
          gameNumber: 3,
          bracket: 'winners',
          team1Id: teamsBySeed.get(1) || null, // Seed 1 gets bye
          team2Id: null,
          team2Source: { gameNumber: 2, position: 'winner' }, // Winner of 4v5 (easier path)
        },
        {
          tournamentId,
          divisionId,
          round: 2,
          gameNumber: 4,
          bracket: 'winners',
          team1Id: teamsBySeed.get(2) || null, // Seed 2 gets bye
          team2Id: null,
          team2Source: { gameNumber: 1, position: 'winner' }, // Winner of 3v6 (harder path)
        },
      ];
      games.push(...semifinals);
    } else {
      // Cross-pool: First round has 2 games (e.g., A2 vs C1, B2 vs A1), top 2 seeds (e.g., C2, B1) get byes
      // This matches the generateTop6Matchups cross-pool pattern which returns 2 games
      const semifinals: GeneratedPlayoffGame[] = [
        {
          tournamentId,
          divisionId,
          round: 2,
          gameNumber: 3,
          bracket: 'winners',
          team1Id: teamsBySeed.get(1) || null, // Top seed gets bye
          team2Id: null,
          team2Source: { gameNumber: 1, position: 'winner' },
        },
        {
          tournamentId,
          divisionId,
          round: 2,
          gameNumber: 4,
          bracket: 'winners',
          team1Id: teamsBySeed.get(2) || null, // Second seed gets bye  
          team2Id: null,
          team2Source: { gameNumber: 2, position: 'winner' },
        },
      ];
      games.push(...semifinals);
    }
    
    // Finals (same for both patterns - game 5, semifinals are games 3 and 4)
    const finals: GeneratedPlayoffGame = {
      tournamentId,
      divisionId,
      round: 3,
      gameNumber: 5,
      bracket: 'championship',
      team1Id: null,
      team2Id: null,
      team1Source: { gameNumber: 3, position: 'winner' },
      team2Source: { gameNumber: 4, position: 'winner' },
    };
    
    games.push(finals);
  } else if (playoffFormat === 'top_4') {
    // Finals for Top 4
    const finals: GeneratedPlayoffGame = {
      tournamentId,
      divisionId,
      round: 2,
      gameNumber: 3,
      bracket: 'championship',
      team1Id: null,
      team2Id: null,
      team1Source: { gameNumber: 1, position: 'winner' },
      team2Source: { gameNumber: 2, position: 'winner' },
    };
    
    games.push(finals);
  } else if (playoffFormat === 'top_8') {
    // Semifinals for Top 8
    const semifinals: GeneratedPlayoffGame[] = [
      {
        tournamentId,
        divisionId,
        round: 2,
        gameNumber: 5,
        bracket: 'winners',
        team1Id: null,
        team2Id: null,
        team1Source: { gameNumber: 1, position: 'winner' },
        team2Source: { gameNumber: 2, position: 'winner' },
      },
      {
        tournamentId,
        divisionId,
        round: 2,
        gameNumber: 6,
        bracket: 'winners',
        team1Id: null,
        team2Id: null,
        team1Source: { gameNumber: 3, position: 'winner' },
        team2Source: { gameNumber: 4, position: 'winner' },
      },
    ];
    
    // Finals
    const finals: GeneratedPlayoffGame = {
      tournamentId,
      divisionId,
      round: 3,
      gameNumber: 7,
      bracket: 'championship',
      team1Id: null,
      team2Id: null,
      team1Source: { gameNumber: 5, position: 'winner' },
      team2Source: { gameNumber: 6, position: 'winner' },
    };
    
    games.push(...semifinals, finals);
  }
  
  return games;
}

/**
 * Handle cross-pool seeding for pool play tournaments
 * Seeds teams by pool ranking: A1, A2, B1, B2, C1, C2, D1, D2 (for 4 pools)
 */
function handleCrossPoolSeeding(
  standings: Array<{ teamId: string; rank: number; poolId?: string; poolName?: string }>,
  playoffFormat: string,
  numberOfPools: number
): Array<{ teamId: string; seed: number; teamName?: string; poolName?: string; poolRank?: number }> {
  // Determine how many teams advance per pool
  let teamsPerPool = 0;
  if (playoffFormat === 'top_8' || playoffFormat === 'top_8_four_pools') {
    teamsPerPool = numberOfPools === 4 ? 2 : numberOfPools === 2 ? 4 : 0;
  } else if (playoffFormat === 'top_6') {
    teamsPerPool = numberOfPools === 3 ? 2 : numberOfPools === 2 ? 3 : 0;
  } else if (playoffFormat === 'top_4') {
    teamsPerPool = numberOfPools === 2 ? 2 : 0;
  }
  
  if (teamsPerPool === 0) {
    console.warn(`Cross-pool seeding not supported for ${playoffFormat} with ${numberOfPools} pools`);
    return [];
  }
  
  // Group teams by pool
  const teamsByPool = new Map<string, Array<{ teamId: string; rank: number; poolId?: string; poolName?: string }>>();
  standings.forEach(team => {
    const poolKey = team.poolName || team.poolId || 'unknown';
    if (!teamsByPool.has(poolKey)) {
      teamsByPool.set(poolKey, []);
    }
    teamsByPool.get(poolKey)!.push(team);
  });
  
  // Sort pools alphabetically (A, B, C, D)
  const poolsArray = Array.from(teamsByPool.entries())
    .sort(([poolKeyA], [poolKeyB]) => poolKeyA.localeCompare(poolKeyB))
    .map(([poolKey, teams]) => {
      // Sort teams within each pool by their global rank (lower is better)
      const sortedTeams = teams.sort((a, b) => a.rank - b.rank).slice(0, teamsPerPool);
      return { poolKey, teams: sortedTeams };
    });
  
  // Assign seeds: Pool A (1st, 2nd, ...) = seeds 1,2,..., Pool B (1st, 2nd, ...) = seeds n+1, n+2, ...
  const playoffTeams: Array<{ teamId: string; seed: number; teamName?: string; poolName?: string; poolRank?: number }> = [];
  poolsArray.forEach(({ poolKey, teams: poolTeams }) => {
    poolTeams.forEach((team, index) => {
      playoffTeams.push({
        teamId: team.teamId,
        seed: playoffTeams.length + 1,
        poolName: poolKey,
        poolRank: index + 1, // 1st, 2nd, etc. in their pool
      });
    });
  });
  
  return playoffTeams;
}

export function getPlayoffTeamsFromStandings(
  standings: Array<{ teamId: string; rank: number; poolId?: string; poolName?: string }>,
  playoffFormat: string,
  seedingPattern?: SeedingPattern,
  numberOfPools?: number
): Array<{ teamId: string; seed: number; teamName?: string; poolName?: string; poolRank?: number }> {
  // Extract playoff team count from format
  // Examples: 'top_4' -> 4, 'top_6' -> 6, 'top_8' -> 8
  // 'single_elim_8' -> 8, 'double_elim_12' -> 12
  // 'championship_consolation' -> 4
  // 'top_8_four_pools' -> 8 (legacy)
  
  // Special handling for cross-pool seeding patterns
  if (seedingPattern && seedingPattern.startsWith('cross_pool_') && numberOfPools) {
    return handleCrossPoolSeeding(standings, playoffFormat, numberOfPools);
  }
  
  // Legacy handling for top_8_four_pools format (backward compatibility)
  if (playoffFormat === 'top_8_four_pools') {
    return handleCrossPoolSeeding(standings, playoffFormat, 4);
  }
  
  let playoffTeamCount = 0;
  
  if (playoffFormat === 'all_seeded') {
    // All teams seeded into single elimination bracket
    playoffTeamCount = standings.length;
  } else if (playoffFormat === 'championship_consolation') {
    // Championship & Consolation: Top 4 teams (seeds 1-4)
    playoffTeamCount = 4;
  } else if (playoffFormat.startsWith('top_')) {
    // Pool play formats: top_4, top_6, top_8
    playoffTeamCount = parseInt(playoffFormat.replace('top_', ''), 10);
  } else if (playoffFormat.startsWith('single_elim_')) {
    // Single elimination with specific team count: single_elim_4, single_elim_8, etc.
    playoffTeamCount = parseInt(playoffFormat.replace('single_elim_', ''), 10);
  } else if (playoffFormat.startsWith('double_elim_')) {
    // Double elimination with specific team count: double_elim_4, double_elim_8, double_elim_12, etc.
    playoffTeamCount = parseInt(playoffFormat.replace('double_elim_', ''), 10);
  } else if (playoffFormat === 'single_elimination' || playoffFormat === 'double_elimination') {
    // Legacy formats: All teams participate
    playoffTeamCount = standings.length;
  }
  
  if (playoffTeamCount === 0) {
    console.warn(`Unknown playoff format: ${playoffFormat}, defaulting to all teams`);
    playoffTeamCount = standings.length;
  }
  
  // Sort standings by rank and take top N teams
  const sortedStandings = [...standings].sort((a, b) => a.rank - b.rank);
  const playoffTeams = sortedStandings.slice(0, playoffTeamCount);
  
  // For standard seeding, assign seeds based on overall ranking
  return playoffTeams.map((team, index) => ({
    teamId: team.teamId,
    seed: index + 1,
    poolName: team.poolName || team.poolId,
    poolRank: undefined, // Not applicable for standard seeding
  }));
}

export function updateBracketProgression(
  games: GeneratedPlayoffGame[],
  completedGameNumber: number,
  winnerId: string,
  loserId: string
): GeneratedPlayoffGame[] {
  return games.map((game) => {
    let updatedGame = { ...game };
    
    // Check if team1 comes from the completed game
    if (game.team1Source?.gameNumber === completedGameNumber) {
      if (game.team1Source.position === 'winner') {
        updatedGame.team1Id = winnerId;
      } else if (game.team1Source.position === 'loser') {
        updatedGame.team1Id = loserId;
      }
    }
    
    // Check if team2 comes from the completed game
    if (game.team2Source?.gameNumber === completedGameNumber) {
      if (game.team2Source.position === 'winner') {
        updatedGame.team2Id = winnerId;
      } else if (game.team2Source.position === 'loser') {
        updatedGame.team2Id = loserId;
      }
    }
    
    return updatedGame;
  });
}
