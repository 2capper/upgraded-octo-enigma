import type { Game } from '@shared/schema';

export interface TeamStats {
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
  offensiveInnings: number;
  defensiveInnings: number;
  forfeitLosses: number;
}

export const calculateStats = (teamId: string, games: Game[], teamIdFilter?: string[]): TeamStats => {
  const relevantGames = games.filter(g => {
    const isInGame = g.homeTeamId === teamId || g.awayTeamId === teamId;
    if (!isInGame || g.status !== 'completed') return false;
    if (teamIdFilter) {
      const otherTeamId = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      return teamIdFilter.includes(otherTeamId);
    }
    return true;
  });

  let stats: TeamStats = { wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0, offensiveInnings: 0, defensiveInnings: 0, forfeitLosses: 0 };
  
  relevantGames.forEach(g => {
    const isHome = g.homeTeamId === teamId;
    stats.runsFor += isHome ? (g.homeScore || 0) : (g.awayScore || 0);
    stats.runsAgainst += isHome ? (g.awayScore || 0) : (g.homeScore || 0);
    // Convert to numbers to ensure proper calculation
    stats.offensiveInnings += isHome ? Number(g.homeInningsBatted || 0) : Number(g.awayInningsBatted || 0);
    // DIP = Defensive Innings Played = innings played by the opposition (when this team was defending)
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
};

// Helper function for floating-point comparison with precision tolerance
const isEqual = (a: number, b: number, tolerance = 0.001): boolean => {
  // Handle Infinity and -Infinity specially
  if (!isFinite(a) || !isFinite(b)) {
    return a === b;
  }
  return Math.abs(a - b) < tolerance;
};

export const resolveTie = (tiedTeams: any[], allGames: Game[]): any[] => {
  if (tiedTeams.length <= 1) return tiedTeams;
  
  let sortedTeams = [...tiedTeams];
  const teamIds = sortedTeams.map(t => t.id);

  const regroupAndResolve = (getMetric: (team: any) => number, descending = false) => {
    sortedTeams.sort((a, b) => descending ? getMetric(b) - getMetric(a) : getMetric(a) - getMetric(b));
    
    // Check if all teams have the same metric value
    if (!isEqual(getMetric(sortedTeams[0]), getMetric(sortedTeams[sortedTeams.length - 1]))) {
      // Iterative resolution: break out best team(s), then re-run on remaining teams
      const result: any[] = [];
      let remaining = [...sortedTeams];
      
      while (remaining.length > 0) {
        // Find best metric value in remaining teams
        const bestMetricValue = getMetric(remaining[0]);
        
        // Find all teams with the best metric value
        const bestTeams: any[] = [];
        const nextRemaining: any[] = [];
        
        remaining.forEach(team => {
          if (isEqual(getMetric(team), bestMetricValue)) {
            bestTeams.push(team);
          } else {
            nextRemaining.push(team);
          }
        });
        
        // If only one team has the best metric, they're ranked
        // If multiple teams have the same best metric, recursively resolve them
        if (bestTeams.length === 1) {
          result.push(bestTeams[0]);
        } else {
          // Recursively resolve the tied best teams
          const resolvedBest = resolveTie(bestTeams, allGames);
          result.push(...resolvedBest);
        }
        
        // Continue with remaining teams
        remaining = nextRemaining;
      }
      
      return result;
    }
    return null;
  };

  // SP11.2 Official Tie Breaking Rules:
  
  // (a) Teams with a forfeit loss are ineligible for tiebreakers
  const eligibleTeams = sortedTeams.filter(team => team.forfeitLosses === 0);
  const ineligibleTeams = sortedTeams.filter(team => team.forfeitLosses > 0);
  
  if (eligibleTeams.length <= 1) {
    // Sort ineligible teams by points, then alphabetically
    const sortedIneligible = ineligibleTeams.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points;
      return a.name.localeCompare(b.name);
    });
    return [...eligibleTeams, ...sortedIneligible];
  }
  
  sortedTeams = eligibleTeams;

  // For 3+ teams tied: Skip head-to-head, start with runs against ratio among tied teams
  // For 2 teams tied: Start with head-to-head
  
  // (b)(1) Head to head record among tied teams (only for 2 teams)
  if (sortedTeams.length === 2) {
    const team1Id = sortedTeams[0].id;
    const team2Id = sortedTeams[1].id;
    
    // Find the direct head-to-head game between these two teams
    let team1HeadToHeadWins = 0;
    let team2HeadToHeadWins = 0;
    
    for (const game of allGames) {
      if (game.status === 'completed') {
        const { homeTeamId, awayTeamId, homeScore, awayScore } = game;
        
        // Check if this is a head-to-head game between the tied teams
        if ((homeTeamId === team1Id && awayTeamId === team2Id) || 
            (homeTeamId === team2Id && awayTeamId === team1Id)) {
          
          const home = Number(homeScore) || 0;
          const away = Number(awayScore) || 0;
          
          if (home > away) {
            // Home team won
            if (homeTeamId === team1Id) {
              team1HeadToHeadWins++;
            } else {
              team2HeadToHeadWins++;
            }
          } else if (away > home) {
            // Away team won
            if (awayTeamId === team1Id) {
              team1HeadToHeadWins++;
            } else {
              team2HeadToHeadWins++;
            }
          }
          // Ties don't count as wins
        }
      }
    }
    
    // Apply head-to-head tie-breaker
    if (team1HeadToHeadWins > team2HeadToHeadWins) {
      return [...[sortedTeams[0], sortedTeams[1]], ...ineligibleTeams];
    }
    if (team2HeadToHeadWins > team1HeadToHeadWins) {
      return [...[sortedTeams[1], sortedTeams[0]], ...ineligibleTeams];
    }
    // If tied in head-to-head, continue to next tie-breaker
  }

  // (b)(2) Smallest runs against ratio among tied teams (runs allowed / defensive innings)
  const raRatioAmongTied = (t: any) => {
    const s = calculateStats(t.id, allGames, teamIds);
    return s.defensiveInnings > 0 ? s.runsAgainst / s.defensiveInnings : Infinity;
  };
  let result = regroupAndResolve(raRatioAmongTied);
  if (result) return [...result, ...ineligibleTeams];

  // (b)(3) Smallest runs against ratio in all games (runs allowed / defensive innings)
  result = regroupAndResolve(t => t.runsAgainstPerInning);
  if (result) return [...result, ...ineligibleTeams];

  // (b)(4) Highest runs for ratio among tied teams (runs scored / offensive innings)
  const rfRatioAmongTied = (t: any) => {
    const s = calculateStats(t.id, allGames, teamIds);
    return s.offensiveInnings > 0 ? s.runsFor / s.offensiveInnings : 0;
  };
  result = regroupAndResolve(rfRatioAmongTied, true);
  if (result) return [...result, ...ineligibleTeams];

  // (b)(5) Highest runs for ratio in all games (runs scored / offensive innings)
  result = regroupAndResolve(t => t.runsForPerInning, true);
  if (result) return [...result, ...ineligibleTeams];

  // (b)(6) Coin toss (final tiebreaker)
  // Use team IDs to create deterministic but pseudo-random ordering
  // This ensures consistent results across renders while simulating coin toss
  const finalResult = sortedTeams.sort((a, b) => {
    const aHash = a.id.toString().split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const bHash = b.id.toString().split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return aHash - bHash;
  });
  return [...finalResult, ...ineligibleTeams];
};
