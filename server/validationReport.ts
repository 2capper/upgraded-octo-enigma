import type { Tournament, Team, Game, Pool } from '@shared/schema';
import { calculateStandings } from '@shared/standingsCalculation';
import { generateBracketGames } from '@shared/bracketGeneration';

export interface ValidationReport {
  tournament: Tournament;
  pools: Pool[];
  teams: Team[];
  games: Game[];
  poolStandings: PoolStandingsReport[];
  seeding: SeedingReport[];
  playoffBracket: PlayoffBracketReport[];
  isComplete: boolean;
  warnings: string[];
}

export interface PoolStandingsReport {
  pool: Pool;
  teams: TeamStandingDetail[];
}

export interface TeamStandingDetail {
  team: Team;
  rank: number;
  record: {
    wins: number;
    losses: number;
    ties: number;
    points: number;
  };
  runs: {
    runsFor: number;
    runsAgainst: number;
    runDifferential: number;
  };
  ratios: {
    runsAgainstPerInning: number;
    runsForPerInning: number;
    offensiveInnings: number;
    defensiveInnings: number;
  };
  games: GameDetail[];
  tieBreakers: TieBreakerExplanation[];
}

export interface GameDetail {
  game: Game;
  opponent: Team;
  result: 'W' | 'L' | 'T';
  runsFor: number;
  runsAgainst: number;
  inningsBatted: number;
  inningsPitched: number;
}

export interface TieBreakerExplanation {
  rule: string;
  description: string;
  value: string | number;
  comparedTo?: Array<{ teamName: string; value: string | number }>;
}

export interface SeedingReport {
  seed: number;
  team: Team;
  pool: Pool;
  poolRank: number;
  seedingPattern: string;
  explanation: string;
}

export interface PlayoffBracketReport {
  round: number;
  gameNumber: number;
  bracket: 'winners' | 'losers' | 'championship';
  team1?: Team;
  team2?: Team;
  matchupDescription: string;
}

export function generateValidationReport(
  tournament: Tournament,
  pools: Pool[],
  teams: Team[],
  games: Game[]
): ValidationReport {
  const warnings: string[] = [];
  
  // Check if pool play is complete (pool play games don't have bracket field set)
  const poolPlayGames = games.filter(g => !(g as any).bracket);
  const completedPoolGames = poolPlayGames.filter(g => g.status === 'completed');
  const isComplete = completedPoolGames.length === poolPlayGames.length && poolPlayGames.length > 0;
  
  if (!isComplete) {
    warnings.push('Pool play is not complete. These results are preliminary and may change as games are completed.');
  }
  
  // Generate pool standings reports with detailed explanations
  const poolStandingsReports = pools.map(pool => 
    generatePoolStandingsReport(pool, teams, games)
  );
  
  // Generate seeding report
  const seedingReport = generateSeedingReport(tournament, pools, poolStandingsReports);
  
  // Generate playoff bracket report
  const playoffBracketReport = generatePlayoffBracketReport(tournament, teams, seedingReport);
  
  return {
    tournament,
    pools,
    teams,
    games,
    poolStandings: poolStandingsReports,
    seeding: seedingReport,
    playoffBracket: playoffBracketReport,
    isComplete,
    warnings,
  };
}

function generatePoolStandingsReport(
  pool: Pool,
  allTeams: Team[],
  allGames: Game[]
): PoolStandingsReport {
  const poolTeams = allTeams.filter(t => t.poolId === pool.id);
  const poolGames = allGames.filter(g => 
    !(g as any).bracket && 
    poolTeams.some(t => t.id === g.homeTeamId || t.id === g.awayTeamId)
  );
  
  // Calculate standings
  const standings = calculateStandings(poolTeams, poolGames);
  
  // Build detailed team reports
  const teamDetails: TeamStandingDetail[] = standings.map(standing => {
    const team = poolTeams.find(t => t.id === standing.teamId)!;
    const teamGames = poolGames.filter(g => 
      g.status === 'completed' && 
      (g.homeTeamId === team.id || g.awayTeamId === team.id)
    );
    
    // Build game details
    const gameDetails: GameDetail[] = teamGames.map(game => {
      const isHome = game.homeTeamId === team.id;
      const opponentId = isHome ? game.awayTeamId : game.homeTeamId;
      const opponent = allTeams.find(t => t.id === opponentId)!;
      const runsFor = isHome ? (game.homeScore || 0) : (game.awayScore || 0);
      const runsAgainst = isHome ? (game.awayScore || 0) : (game.homeScore || 0);
      const inningsBatted = isHome ? Number(game.homeInningsBatted || 0) : Number(game.awayInningsBatted || 0);
      const inningsPitched = isHome ? Number(game.awayInningsBatted || 0) : Number(game.homeInningsBatted || 0);
      
      let result: 'W' | 'L' | 'T';
      if (game.forfeitStatus === 'home' && isHome || game.forfeitStatus === 'away' && !isHome) {
        result = 'L';
      } else if (runsFor > runsAgainst) {
        result = 'W';
      } else if (runsAgainst > runsFor) {
        result = 'L';
      } else {
        result = 'T';
      }
      
      return {
        game,
        opponent,
        result,
        runsFor,
        runsAgainst,
        inningsBatted,
        inningsPitched,
      };
    });
    
    // Generate tie-breaker explanations
    const tieBreakers = generateTieBreakerExplanations(
      team,
      standing,
      standings,
      gameDetails
    );
    
    return {
      team,
      rank: standing.rank,
      record: {
        wins: standing.wins,
        losses: standing.losses,
        ties: standing.ties,
        points: standing.points,
      },
      runs: {
        runsFor: standing.runsFor,
        runsAgainst: standing.runsAgainst,
        runDifferential: standing.runsFor - standing.runsAgainst,
      },
      ratios: {
        runsAgainstPerInning: standing.runsAgainstPerInning,
        runsForPerInning: standing.runsForPerInning,
        offensiveInnings: gameDetails.reduce((sum, g) => sum + g.inningsBatted, 0),
        defensiveInnings: gameDetails.reduce((sum, g) => sum + g.inningsPitched, 0),
      },
      games: gameDetails,
      tieBreakers,
    };
  });
  
  return {
    pool,
    teams: teamDetails,
  };
}

function generateTieBreakerExplanations(
  team: Team,
  standing: any,
  allStandings: any[],
  gameDetails: GameDetail[]
): TieBreakerExplanation[] {
  const explanations: TieBreakerExplanation[] = [];
  
  // Rule 1: Points (Wins and Ties)
  explanations.push({
    rule: 'Rule #1: Points',
    description: 'Teams earn 2 points for a win and 1 point for a tie',
    value: `${standing.points} points (${standing.wins}W, ${standing.losses}L, ${standing.ties}T)`,
  });
  
  // Check if there are teams tied on points
  const tiedTeams = allStandings.filter(s => s.points === standing.points && s.teamId !== standing.teamId);
  
  if (tiedTeams.length > 0) {
    // Rule 2: Head-to-head (only for 2-team ties)
    if (tiedTeams.length === 1) {
      const tiedTeam = tiedTeams[0];
      const h2hGame = gameDetails.find(g => g.opponent.id === tiedTeam.teamId);
      if (h2hGame) {
        explanations.push({
          rule: 'Rule #2: Head-to-Head',
          description: 'When exactly 2 teams are tied, the winner of their direct matchup is ranked higher',
          value: `${h2hGame.result} vs ${h2hGame.opponent.name} (${h2hGame.runsFor}-${h2hGame.runsAgainst})`,
        });
      }
    } else {
      explanations.push({
        rule: 'Rule #2: Head-to-Head (Skipped)',
        description: 'Head-to-head is only used when exactly 2 teams are tied. With 3+ teams tied, we skip to Rule #3',
        value: `${tiedTeams.length + 1} teams tied - head-to-head skipped`,
      });
    }
    
    // Rule 3: RA/DIP among tied teams
    explanations.push({
      rule: 'Rule #3: Runs Against per Defensive Inning (Tied Teams Only)',
      description: 'Among tied teams, the team with the lowest RA/DIP is ranked higher',
      value: `${standing.runsAgainstPerInning.toFixed(3)} RA/DIP`,
      comparedTo: tiedTeams.map(t => ({
        teamName: allStandings.find(s => s.teamId === t.teamId)?.teamName || 'Unknown',
        value: t.runsAgainstPerInning.toFixed(3),
      })),
    });
  }
  
  // Rule 4: RA/DIP all games
  explanations.push({
    rule: 'Rule #4: Runs Against per Defensive Inning (All Games)',
    description: 'The team with the lowest RA/DIP across all pool games is ranked higher',
    value: `${standing.runsAgainstPerInning.toFixed(3)} RA/DIP`,
  });
  
  // Rule 5: RF/OI among tied teams
  if (tiedTeams.length > 0) {
    explanations.push({
      rule: 'Rule #5: Runs For per Offensive Inning (Tied Teams Only)',
      description: 'Among tied teams, the team with the highest RF/OI is ranked higher',
      value: `${standing.runsForPerInning.toFixed(3)} RF/OI`,
      comparedTo: tiedTeams.map(t => ({
        teamName: allStandings.find(s => s.teamId === t.teamId)?.teamName || 'Unknown',
        value: t.runsForPerInning.toFixed(3),
      })),
    });
  }
  
  // Rule 6: RF/OI all games
  explanations.push({
    rule: 'Rule #6: Runs For per Offensive Inning (All Games)',
    description: 'The team with the highest RF/OI across all pool games is ranked higher',
    value: `${standing.runsForPerInning.toFixed(3)} RF/OI`,
  });
  
  return explanations;
}

function generateSeedingReport(
  tournament: Tournament,
  pools: Pool[],
  poolStandings: PoolStandingsReport[]
): SeedingReport[] {
  const seedingReport: SeedingReport[] = [];
  const seedingPattern = tournament.seedingPattern || 'standard';
  
  // For each pool, assign seeds based on rank
  poolStandings.forEach(poolReport => {
    poolReport.teams.forEach(teamDetail => {
      const seed = calculateSeedNumber(teamDetail.rank, poolReport.pool, pools.length, seedingPattern);
      const explanation = generateSeedingExplanation(
        teamDetail.rank,
        poolReport.pool,
        pools.length,
        seedingPattern
      );
      
      seedingReport.push({
        seed,
        team: teamDetail.team,
        pool: poolReport.pool,
        poolRank: teamDetail.rank,
        seedingPattern,
        explanation,
      });
    });
  });
  
  return seedingReport.sort((a, b) => a.seed - b.seed);
}

function calculateSeedNumber(
  poolRank: number,
  pool: Pool,
  poolCount: number,
  seedingPattern: string
): number {
  // Standard seeding: Pool A #1 = Seed 1, Pool B #1 = Seed 2, etc.
  // Then Pool A #2 = Seed (poolCount + 1), Pool B #2 = Seed (poolCount + 2), etc.
  const poolIndex = parseInt(pool.name.charAt(pool.name.length - 1)) - 1; // Assuming pools are named "Pool A", "Pool B", etc.
  return ((poolRank - 1) * poolCount) + poolIndex + 1;
}

function generateSeedingExplanation(
  poolRank: number,
  pool: Pool,
  poolCount: number,
  seedingPattern: string
): string {
  if (seedingPattern === 'standard') {
    return `${pool.name} #${poolRank} receives seed ${calculateSeedNumber(poolRank, pool, poolCount, seedingPattern)} (standard seeding)`;
  } else if (seedingPattern.startsWith('cross_pool')) {
    return `${pool.name} #${poolRank} receives seed ${calculateSeedNumber(poolRank, pool, poolCount, seedingPattern)} (cross-pool seeding)`;
  } else {
    return `${pool.name} #${poolRank} receives seed ${calculateSeedNumber(poolRank, pool, poolCount, seedingPattern)} (${seedingPattern} seeding)`;
  }
}

function generatePlayoffBracketReport(
  tournament: Tournament,
  teams: Team[],
  seeding: SeedingReport[]
): PlayoffBracketReport[] {
  if (!tournament.playoffFormat) {
    return [];
  }
  
  const seededTeams = seeding.map(s => ({
    teamId: s.team.id,
    seed: s.seed,
    teamName: s.team.name,
    poolName: s.pool.name,
    poolRank: s.poolRank,
  }));
  
  try {
    const bracketGames = generateBracketGames({
      tournamentId: tournament.id,
      divisionId: 'main', // Assuming single division for now
      playoffFormat: tournament.playoffFormat,
      teamCount: seededTeams.length,
      seededTeams,
      seedingPattern: (tournament.seedingPattern || 'standard') as any,
    });
    
    return bracketGames.map(game => {
      const team1 = game.team1Id ? teams.find(t => t.id === game.team1Id) : undefined;
      const team2 = game.team2Id ? teams.find(t => t.id === game.team2Id) : undefined;
      
      let matchupDescription = '';
      if (team1 && team2) {
        const team1Seed = seeding.find(s => s.team.id === team1.id)?.seed;
        const team2Seed = seeding.find(s => s.team.id === team2.id)?.seed;
        matchupDescription = `Seed #${team1Seed} ${team1.name} vs Seed #${team2Seed} ${team2.name}`;
      } else if (team1 && game.team2Source) {
        matchupDescription = `${team1.name} vs Winner of Game ${game.team2Source.gameNumber}`;
      } else if (team2 && game.team1Source) {
        matchupDescription = `Winner of Game ${game.team1Source.gameNumber} vs ${team2.name}`;
      } else if (game.team1Source && game.team2Source) {
        matchupDescription = `Winner of Game ${game.team1Source.gameNumber} vs Winner of Game ${game.team2Source.gameNumber}`;
      } else {
        matchupDescription = 'TBD';
      }
      
      return {
        round: game.round,
        gameNumber: game.gameNumber,
        bracket: game.bracket,
        team1,
        team2,
        matchupDescription,
      };
    });
  } catch (error) {
    console.error('Error generating playoff bracket:', error);
    return [];
  }
}
