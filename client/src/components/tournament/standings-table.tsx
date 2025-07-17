import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Team, Game, Pool, AgeDivision } from '@shared/schema';

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
    stats.offensiveInnings += isHome ? (g.homeInningsBatted || 0) : (g.awayInningsBatted || 0);
    stats.defensiveInnings += isHome ? (g.awayInningsBatted || 0) : (g.homeInningsBatted || 0);

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

  // Forfeit losses first
  let result = regroupAndResolve(team => team.forfeitLosses);
  if (result) return result;

  // Head to head for 2 teams
  if (sortedTeams.length === 2) {
    const stats = calculateStats(sortedTeams[0].id, allGames, [sortedTeams[1].id]);
    if (stats.wins > stats.losses) return [sortedTeams[0], sortedTeams[1]];
    if (stats.losses > stats.wins) return [sortedTeams[1], sortedTeams[0]];
  }

  // Runs against per inning among tied teams
  const raRatioAmongTied = (t: any) => {
    const s = calculateStats(t.id, allGames, teamIds);
    return s.defensiveInnings > 0 ? s.runsAgainst / s.defensiveInnings : Infinity;
  };
  result = regroupAndResolve(raRatioAmongTied);
  if (result) return result;

  // Overall runs against per inning
  result = regroupAndResolve(t => t.runsAgainstPerInning);
  if (result) return result;

  // Runs for per inning among tied teams
  const rfRatioAmongTied = (t: any) => {
    const s = calculateStats(t.id, allGames, teamIds);
    return s.offensiveInnings > 0 ? s.runsFor / s.offensiveInnings : 0;
  };
  result = regroupAndResolve(rfRatioAmongTied, true);
  if (result) return result;

  // Overall runs for per inning
  result = regroupAndResolve(t => t.runsForPerInning, true);
  if (result) return result;

  // Alphabetical
  return sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
};

export const StandingsTable = ({ teams, games, pools, ageDivisions, showPoolColumn = true }: StandingsTableProps) => {
  const standingsByDivision = useMemo(() => {
    if (!teams.length || !ageDivisions.length) return [];
    
    // Filter to only show 11U and 13U divisions
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

      // Sort and resolve ties for overall standings
      const overallStandings = Object.keys(groups)
        .sort((a, b) => Number(b) - Number(a))
        .flatMap(points => resolveTie(groups[Number(points)], games));

      // Calculate pool standings
      const poolStandings = divisionPools.map(pool => {
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
        pools: divisionPools,
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
    <div className="overflow-x-auto">
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
                  <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                    index === 0 ? 'bg-[var(--falcons-green)]' : 
                    index === 1 ? 'bg-gray-400' : 
                    index === 2 ? 'bg-yellow-500' : 'bg-gray-300'
                  }`}>
                    <span className="text-white font-bold text-sm">{index + 1}</span>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center">
                      <span className="text-sm font-medium text-gray-900">{team.name}</span>
                      {team.forfeitLosses > 0 && (
                        <AlertTriangle className="w-4 h-4 ml-2 text-red-500" title="Team has a forfeit loss" />
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
  );

  return (
    <div className="space-y-8">
      {standingsByDivision.map(({ division, pools: divisionPools, overallStandings, poolStandings }) => (
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

          {/* Pool Standings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {poolStandings.map(({ pool, teams: poolTeams }) => (
              <div key={pool.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 text-left pl-[12px] pr-[12px] pt-[12px] pb-[12px]">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-semibold text-gray-900">{pool.name}</h4>
                  <div className="text-sm text-gray-500">
                    {poolTeams.length} Teams
                  </div>
                </div>
                {renderStandingsTable(poolTeams, pool.name)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
