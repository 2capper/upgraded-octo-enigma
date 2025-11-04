import type { Team, Game } from './schema';

interface TeamStats {
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
  offensiveInnings: number;
  defensiveInnings: number;
  forfeitLosses: number;
}

interface TeamStanding {
  teamId: string;
  teamName: string;
  poolId: string;
  wins: number;
  losses: number;
  ties: number;
  points: number;
  runsFor: number;
  runsAgainst: number;
  runsAgainstPerInning: number;
  runsForPerInning: number;
  rank: number;
}

function calculateTeamStats(teamId: string, games: Game[]): TeamStats {
  const relevantGames = games.filter(g => 
    g.status === 'completed' && 
    (g.homeTeamId === teamId || g.awayTeamId === teamId)
  );

  let stats: TeamStats = { 
    wins: 0, 
    losses: 0, 
    ties: 0, 
    runsFor: 0, 
    runsAgainst: 0, 
    offensiveInnings: 0, 
    defensiveInnings: 0, 
    forfeitLosses: 0 
  };
  
  relevantGames.forEach(g => {
    const isHome = g.homeTeamId === teamId;
    stats.runsFor += isHome ? (g.homeScore || 0) : (g.awayScore || 0);
    stats.runsAgainst += isHome ? (g.awayScore || 0) : (g.homeScore || 0);
    stats.offensiveInnings += isHome ? Number(g.homeInningsBatted || 0) : Number(g.awayInningsBatted || 0);
    stats.defensiveInnings += isHome ? Number(g.awayInningsBatted || 0) : Number(g.homeInningsBatted || 0);

    const forfeited = (isHome && g.forfeitStatus === 'home') || (!isHome && g.forfeitStatus === 'away');
    if (forfeited) { 
      stats.losses++; 
      stats.forfeitLosses++; 
      return; 
    }

    const homeScore = g.homeScore || 0;
    const awayScore = g.awayScore || 0;
    
    if (homeScore > awayScore) {
      isHome ? stats.wins++ : stats.losses++;
    } else if (awayScore > homeScore) {
      isHome ? stats.losses++ : stats.wins++;
    } else {
      stats.ties++;
    }
  });
  
  return stats;
}

export function calculateStandings(teams: Team[], games: Game[]): TeamStanding[] {
  // Calculate stats for each team
  const teamsWithStats = teams.map(team => {
    const stats = calculateTeamStats(team.id, games);
    return {
      teamId: team.id,
      teamName: team.name,
      poolId: team.poolId,
      wins: stats.wins,
      losses: stats.losses,
      ties: stats.ties,
      points: (stats.wins * 2) + (stats.ties * 1),
      runsFor: stats.runsFor,
      runsAgainst: stats.runsAgainst,
      runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : 0,
      runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
      rank: 0, // Will be assigned after sorting
    };
  });

  // Sort by points descending (more points = better rank)
  teamsWithStats.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    // Tiebreaker: lower RA/Inn is better
    if (a.runsAgainstPerInning !== b.runsAgainstPerInning) {
      return a.runsAgainstPerInning - b.runsAgainstPerInning;
    }
    // Further tiebreaker: higher RF/Inn is better
    return b.runsForPerInning - a.runsForPerInning;
  });

  // Assign ranks
  teamsWithStats.forEach((team, index) => {
    team.rank = index + 1;
  });

  return teamsWithStats;
}
