import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Team, Game, Pool, AgeDivision } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StandingsTableProps {
  teams: Team[];
  games: Game[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
  showPoolColumn?: boolean;
}

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

const calculateStats = (teamId: string, games: Game[], teamIdFilter?: string[]): TeamStats => {
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

const resolveTie = (tiedTeams: any[], allGames: Game[]): any[] => {
  if (tiedTeams.length <= 1) return tiedTeams;
  
  let sortedTeams = [...tiedTeams];
  const teamIds = sortedTeams.map(t => t.id);

  const regroupAndResolve = (getMetric: (team: any) => number, descending = false) => {
    sortedTeams.sort((a, b) => descending ? getMetric(b) - getMetric(a) : getMetric(a) - getMetric(b));
    if (getMetric(sortedTeams[0]) !== getMetric(sortedTeams[sortedTeams.length - 1])) {
      const groups: any[][] = [];
      let currentGroup = [sortedTeams[0]];
      
      for (let i = 1; i < sortedTeams.length; i++) {
        if (getMetric(sortedTeams[i]) === getMetric(currentGroup[0])) {
          currentGroup.push(sortedTeams[i]);
        } else {
          groups.push(currentGroup);
          currentGroup = [sortedTeams[i]];
        }
      }
      groups.push(currentGroup);
      return groups.flatMap(group => resolveTie(group, allGames));
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

  // (b)(6) Coin toss (alphabetical as substitute)
  const finalResult = sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
  return [...finalResult, ...ineligibleTeams];
};

export const StandingsTable = ({ teams, games, pools, ageDivisions, showPoolColumn = true }: StandingsTableProps) => {
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  
  const standingsByDivision = useMemo(() => {
    if (!teams.length || !ageDivisions.length) return [];
    
    // Filter to only show 11U and 13U divisions using real division data
    const targetDivisions = ageDivisions.filter(div => 
      div.name === '11U' || div.name === '13U'
    );
    
    return targetDivisions.map(division => {
      // Get pools for this division
      const divisionPools = pools.filter(p => p.ageDivisionId === division.id);
      
      // Get teams in this division
      const divisionTeams = teams.filter(t => 
        divisionPools.some(p => p.id === t.poolId)
      );
      
      // Calculate stats for each team
      const teamStats = divisionTeams.map(team => {
        const allGameStats = calculateStats(team.id, games);
        return {
          ...team,
          ...allGameStats,
          points: (allGameStats.wins * 2) + (allGameStats.ties * 1),
          runsAgainstPerInning: allGameStats.defensiveInnings > 0 ? (allGameStats.runsAgainst / allGameStats.defensiveInnings) : 0,
          runsForPerInning: allGameStats.offensiveInnings > 0 ? (allGameStats.runsFor / allGameStats.offensiveInnings) : 0,
        };
      });

      // Group teams by points for tie-breaking
      const groups = teamStats.reduce((acc, team) => {
        const points = team.points;
        if (!acc[points]) acc[points] = [];
        acc[points].push(team);
        return acc;
      }, {} as Record<number, any[]>);

      // Calculate pool standings first to identify pool winners and runners-up
      const poolWinners: any[] = [];
      const poolRunnersUp: any[] = [];
      const remainingTeams: any[] = [];
      
      divisionPools.forEach(pool => {
        const poolTeams = teamStats.filter(t => t.poolId === pool.id);
        
        // Group pool teams by points for tie-breaking
        const poolGroups = poolTeams.reduce((acc, team) => {
          const points = team.points;
          if (!acc[points]) acc[points] = [];
          acc[points].push(team);
          return acc;
        }, {} as Record<number, any[]>);

        // Sort and resolve ties for pool standings
        const sortedPoolTeams = Object.keys(poolGroups)
          .sort((a, b) => Number(b) - Number(a))
          .flatMap(points => resolveTie(poolGroups[Number(points)], games));
        
        if (sortedPoolTeams.length > 0) {
          // Mark the pool winner
          const poolWinner = { ...sortedPoolTeams[0], isPoolWinner: true };
          poolWinners.push(poolWinner);
          
          // Mark the runner-up (2nd place in pool)
          if (sortedPoolTeams.length > 1) {
            const runnerUp = { ...sortedPoolTeams[1], isPoolRunnerUp: true };
            poolRunnersUp.push(runnerUp);
            
            // Add remaining teams from this pool
            remainingTeams.push(...sortedPoolTeams.slice(2));
          }
        }
      });
      
      // Sort pool winners by RA/DIP (best defensive performance first)
      poolWinners.sort((a, b) => a.runsAgainstPerInning - b.runsAgainstPerInning);
      
      // Sort pool runners-up by RA/DIP (best defensive performance first)
      poolRunnersUp.sort((a, b) => a.runsAgainstPerInning - b.runsAgainstPerInning);
      
      // Sort remaining teams by regular standings logic (points first, then tie-breakers)
      const remainingGroups = remainingTeams.reduce((acc, team) => {
        const points = team.points;
        if (!acc[points]) acc[points] = [];
        acc[points].push(team);
        return acc;
      }, {} as Record<number, any[]>);
      
      const sortedRemainingTeams = Object.keys(remainingGroups)
        .sort((a, b) => Number(b) - Number(a))
        .flatMap(points => resolveTie(remainingGroups[Number(points)], games));
      
      // Combine: Pool winners (1-3), then pool runners-up (4-6), then everyone else
      const overallStandings = [...poolWinners, ...poolRunnersUp, ...sortedRemainingTeams];

      // Now calculate individual pool standings for display
      // Sort pools in ascending order
      const sortedPoolsForDisplay = [...divisionPools].sort((a, b) => {
        // Extract the pool identifier (number or letter) from the name
        const extractIdentifier = (name: string) => {
          const match = name.match(/Pool\s*([A-Za-z0-9]+)/i);
          return match ? match[1] : name;
        };
        
        const idA = extractIdentifier(a.name || '');
        const idB = extractIdentifier(b.name || '');
        
        // Try to parse as numbers first
        const numA = parseInt(idA);
        const numB = parseInt(idB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          // Both are numbers, sort numerically
          return numA - numB;
        } else {
          // At least one is not a number, sort alphabetically
          return idA.localeCompare(idB);
        }
      });

      // Calculate pool standings for display
      const poolStandings = sortedPoolsForDisplay.map(pool => {
        const poolTeams = teamStats.filter(t => t.poolId === pool.id);
        
        // Group pool teams by points for tie-breaking
        const poolGroups = poolTeams.reduce((acc, team) => {
          const points = team.points;
          if (!acc[points]) acc[points] = [];
          acc[points].push(team);
          return acc;
        }, {} as Record<number, any[]>);

        // Sort and resolve ties for pool standings
        const sortedPoolTeams = Object.keys(poolGroups)
          .sort((a, b) => Number(b) - Number(a))
          .flatMap(points => resolveTie(poolGroups[Number(points)], games));

        return {
          pool,
          teams: sortedPoolTeams
        };
      });

      return {
        division,
        pools: sortedPoolsForDisplay,
        overallStandings,
        poolStandings
      };
    });
  }, [teams, games, pools, ageDivisions]);

  const getPoolName = (poolId: string) => pools.find(p => p.id === poolId)?.name || '';

  if (standingsByDivision.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 text-center">
        <p className="text-gray-500">No teams or games available to display standings.</p>
      </div>
    );
  }

  const renderStandingsTable = (teams: any[], title: string) => (
    <>
      {/* Mobile view - Cards */}
      <div className="md:hidden space-y-3">
        {teams.map((team, index) => (
          <div key={team.id} className={`bg-white border rounded-lg p-4 ${team.forfeitLosses > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-[var(--splash-navy)] text-white font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-900">{team.name}</span>
                    {team.isPoolWinner && (
                      <span className="ml-2 px-2 py-1 bg-[var(--falcons-green)] text-white text-xs rounded-full font-bold">
                        POOL WINNER
                      </span>
                    )}
                    {team.isPoolRunnerUp && (
                      <span className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full font-bold">
                        POOL 2ND
                      </span>
                    )}
                    {team.forfeitLosses > 0 && (
                      <AlertTriangle className="w-4 h-4 ml-2 text-red-500" />
                    )}
                  </div>
                  {showPoolColumn && (
                    <span className="text-xs text-gray-500">{getPoolName(team.poolId)}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-900">{team.points}</div>
                <div className="text-xs text-gray-500">PTS</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-sm font-semibold text-gray-900">{team.wins}-{team.losses}-{team.ties}</div>
                <div className="text-xs text-gray-500">W-L-T</div>
              </div>
              <div>
                <div className="text-sm font-semibold">
                  <span className="text-green-600">{team.runsFor}</span>
                  <span className="text-gray-400 mx-1">/</span>
                  <span className="text-red-600">{team.runsAgainst}</span>
                </div>
                <div className="text-xs text-gray-500">RF/RA</div>
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900">{team.runsAgainstPerInning.toFixed(2)}</div>
                <div className="text-xs text-gray-500">RA/Inn</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop view - Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
              {showPoolColumn && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pool</th>}
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">GP</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">W-L-T</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">RF</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">RA</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Defensive Innings Played">DIP</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Runs Allowed per Defensive Inning">RA/Inn</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teams.map((team, index) => (
              <tr key={team.id} className={`hover:bg-gray-50 transition-colors ${team.forfeitLosses > 0 ? 'bg-red-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center bg-[#92a1b3]">
                      <span className="text-white font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{team.name}</span>
                        {team.isPoolWinner && (
                          <span className="ml-2 px-2 py-1 bg-[var(--falcons-green)] text-white text-xs rounded-full font-bold">
                            POOL WINNER
                          </span>
                        )}
                        {team.isPoolRunnerUp && (
                          <span className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full font-bold">
                            POOL 2ND
                          </span>
                        )}
                        {team.forfeitLosses > 0 && (
                          <span title="Team has a forfeit loss">
                            <AlertTriangle className="w-4 h-4 ml-2 text-red-500" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                {showPoolColumn && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {getPoolName(team.poolId)}
                    </span>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                  {team.wins + team.losses + team.ties}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900">
                  {`${team.wins}-${team.losses}-${team.ties}`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-green-600">
                  {team.runsFor}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-semibold text-red-600">
                  {team.runsAgainst}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                  {team.defensiveInnings}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                  {team.runsAgainstPerInning.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-bold">
                  {team.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  const targetDivisions = ageDivisions.filter(div => 
    div.name === '11U' || div.name === '13U'
  );

  const displayedDivisions = selectedDivision 
    ? standingsByDivision.filter(s => s.division.id === selectedDivision)
    : standingsByDivision;

  return (
    <div className="space-y-8">
      {/* Division Toggle Buttons */}
      <div className="flex items-center justify-center space-x-4">
        <Button
          onClick={() => setSelectedDivision(null)}
          className={`${selectedDivision === null ? 'bg-[var(--yellow)] text-[var(--forest-green)]' : 'bg-[var(--forest-green)] text-[var(--yellow)]'} hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors`}
        >
          All Divisions
        </Button>
        {targetDivisions.map(division => (
          <Button
            key={division.id}
            onClick={() => setSelectedDivision(division.id)}
            className={`${selectedDivision === division.id ? 'bg-[var(--yellow)] text-[var(--forest-green)]' : 'bg-[var(--forest-green)] text-[var(--yellow)]'} hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors`}
          >
            {division.name}
          </Button>
        ))}
      </div>
      {displayedDivisions.map(({ division, pools: divisionPools, overallStandings, poolStandings }) => (
        <div key={division.id} className="space-y-6">
          {/* Overall Division Standings */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 pl-[12px] pr-[12px] pt-[12px] pb-[12px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">{division.name} Overall Standings</h3>
              <div className="text-sm text-gray-500">
                {divisionPools.length} Pools • {overallStandings.length} Teams
              </div>
            </div>
            {renderStandingsTable(overallStandings, `${division.name} Overall`)}
          </div>

          {/* Pool Standings with Tabs */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">{division.name} Pool Standings</h4>
            
            <Tabs defaultValue={poolStandings[0]?.pool.id} className="w-full">
              <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${poolStandings.length}, minmax(0, 1fr))` }}>
                {poolStandings.map(({ pool }) => (
                  <TabsTrigger key={pool.id} value={pool.id} className="text-xs md:text-sm">
                    {pool.name.replace(/^Pool\s*Pool\s*/i, 'Pool ')}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {poolStandings.map(({ pool, teams: poolTeams }) => (
                <TabsContent key={pool.id} value={pool.id} className="mt-4">
                  {renderStandingsTable(poolTeams, pool.name)}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
      ))}
    </div>
  );
};
