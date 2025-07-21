import { useMemo } from 'react';
import { Medal, Trophy, RefreshCw, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Team, Game, Pool } from '@/hooks/use-tournament-data';

interface PlayoffsTabProps {
  teams: Team[];
  games: Game[];
  pools: Pool[];
}

// Reuse the same calculation logic from the original code
const calculateStats = (teamId: string, games: Game[], teamIdFilter?: string[]) => {
  const relevantGames = games.filter(g => {
    const isInGame = g.homeTeamId === teamId || g.awayTeamId === teamId;
    if (!isInGame || g.status !== 'completed') return false;
    if (teamIdFilter) {
      const otherTeamId = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      return teamIdFilter.includes(otherTeamId);
    }
    return true;
  });

  let stats = { wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0, offensiveInnings: 0, defensiveInnings: 0, forfeitLosses: 0 };
  
  relevantGames.forEach(g => {
    const isHome = g.homeTeamId === teamId;
    stats.runsFor += isHome ? (g.homeScore || 0) : (g.awayScore || 0);
    stats.runsAgainst += isHome ? (g.awayScore || 0) : (g.homeScore || 0);
    stats.offensiveInnings += isHome ? (g.homeInningsBatted || 0) : (g.awayInningsBatted || 0);
    stats.defensiveInnings += isHome ? (g.awayInningsBatted || 0) : (g.homeInningsBatted || 0);

    const forfeited = (isHome && g.forfeitStatus === 'home') || (!isHome && g.forfeitStatus === 'away');
    if (forfeited) { stats.losses++; stats.forfeitLosses++; return; }

    const homeScore = g.homeScore || 0;
    const awayScore = g.awayScore || 0;
    
    if (homeScore > awayScore) isHome ? stats.wins++ : stats.losses++;
    else if (awayScore > homeScore) isHome ? stats.losses++ : stats.wins++;
    else stats.ties++;
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
      for(let i = 1; i < sortedTeams.length; i++) {
        if (getMetric(sortedTeams[i]) === getMetric(currentGroup[0])) currentGroup.push(sortedTeams[i]);
        else { groups.push(currentGroup); currentGroup = [sortedTeams[i]]; }
      }
      groups.push(currentGroup);
      return groups.flatMap(group => resolveTie(group, allGames));
    }
    return null;
  };

  let result = regroupAndResolve(team => team.forfeitLosses); if (result) return result;
  if (sortedTeams.length === 2) {
    const stats = calculateStats(sortedTeams[0].id, allGames, [sortedTeams[1].id]);
    if (stats.wins > stats.losses) return [sortedTeams[0], sortedTeams[1]];
    if (stats.losses > stats.wins) return [sortedTeams[1], sortedTeams[0]];
  }
  const raRatioAmongTied = (t: any) => { const s = calculateStats(t.id, allGames, teamIds); return s.defensiveInnings > 0 ? s.runsAgainst / s.defensiveInnings : Infinity; };
  result = regroupAndResolve(raRatioAmongTied); if (result) return result;
  result = regroupAndResolve(t => t.runsAgainstPerInning); if (result) return result;
  const rfRatioAmongTied = (t: any) => { const s = calculateStats(t.id, allGames, teamIds); return s.offensiveInnings > 0 ? s.runsFor / s.offensiveInnings : 0; };
  result = regroupAndResolve(rfRatioAmongTied, true); if (result) return result;
  result = regroupAndResolve(t => t.runsForPerInning, true); if (result) return result;
  return sortedTeams.sort((a, b) => a.name.localeCompare(b.name));
};

export const PlayoffsTab = ({ teams, games, pools }: PlayoffsTabProps) => {
  const playoffTeams = useMemo(() => {
    if (!teams.length || !games.length) return [];
    
    // Calculate overall standings for all teams across all pools
    const allTeamsWithStats = teams.map(team => {
      const stats = calculateStats(team.id, games);
      return {
        ...team,
        ...stats,
        points: (stats.wins * 2) + (stats.ties * 1),
        runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : 0,
        runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
      };
    });

    // Sort all teams by points first, then apply tie-breaker logic
    allTeamsWithStats.sort((a, b) => b.points - a.points);
    
    // Group teams by points and resolve ties
    const groups: any[][] = [];
    let currentGroup = [allTeamsWithStats[0]];
    
    for (let i = 1; i < allTeamsWithStats.length; i++) {
      if (allTeamsWithStats[i].points === currentGroup[0].points) {
        currentGroup.push(allTeamsWithStats[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [allTeamsWithStats[i]];
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);
    
    // Apply tie-breaker logic to each group and flatten the results
    const sortedTeams = groups.flatMap(group => resolveTie(group, games));
    
    // Return top 6 teams
    return sortedTeams.slice(0, 6);
  }, [teams, games, pools]);

  if (playoffTeams.length < 6) {
    return (
      <div className="p-6">
        <div className="text-center p-8 bg-gray-50 rounded-xl">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Playoff Bracket Not Ready</h3>
          <p className="text-gray-500">Not enough completed games to determine playoff bracket.</p>
        </div>
      </div>
    );
  }

  const [seed1, seed2, seed3, seed4, seed5, seed6] = playoffTeams;

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">Playoff Bracket</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="bg-[var(--falcons-gold)] text-white hover:bg-[var(--falcons-dark-gold)]">
            <RefreshCw className="w-4 h-4 mr-2" />
            Update Bracket
          </Button>
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print Bracket
          </Button>
        </div>
      </div>

      {/* Playoff Rankings Table */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">Playoff Rankings</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Rank</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-700">Team</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">W</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">L</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">T</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">PTS</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">RF</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-700">RA</th>
              </tr>
            </thead>
            <tbody>
              {playoffTeams.map((team, index) => (
                <tr key={team.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                  <td className="py-2 px-3">
                    <div className="flex items-center">
                      <span className="font-bold text-gray-900">{index + 1}</span>
                      {index < 3 && (
                        <Medal className={`w-4 h-4 ml-2 ${
                          index === 0 ? 'text-yellow-500' :
                          index === 1 ? 'text-gray-400' :
                          'text-orange-600'
                        }`} />
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-3 font-medium text-gray-900">{team.name}</td>
                  <td className="text-center py-2 px-3">{team.wins}</td>
                  <td className="text-center py-2 px-3">{team.losses}</td>
                  <td className="text-center py-2 px-3">{team.ties}</td>
                  <td className="text-center py-2 px-3 font-bold">{team.points}</td>
                  <td className="text-center py-2 px-3">{team.runsFor}</td>
                  <td className="text-center py-2 px-3">{team.runsAgainst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quarterfinals */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 text-center">Quarterfinals</h4>
            
            {/* QF Game 1 */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="text-center text-sm text-gray-500 mb-3">QF1</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[var(--falcons-green)] text-white p-2 rounded">
                  <span className="font-medium">3. {seed3.name}</span>
                  <span className="font-bold">-</span>
                </div>
                <div className="flex items-center justify-between bg-gray-100 p-2 rounded">
                  <span className="font-medium">6. {seed6.name}</span>
                  <span className="font-bold">-</span>
                </div>
              </div>
            </div>

            {/* QF Game 2 */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="text-center text-sm text-gray-500 mb-3">QF2</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-[var(--falcons-green)] text-white p-2 rounded">
                  <span className="font-medium">4. {seed4.name}</span>
                  <span className="font-bold">-</span>
                </div>
                <div className="flex items-center justify-between bg-gray-100 p-2 rounded">
                  <span className="font-medium">5. {seed5.name}</span>
                  <span className="font-bold">-</span>
                </div>
              </div>
            </div>
          </div>

          {/* Semifinals */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 text-center">Semifinals</h4>
            
            {/* SF Game 1 */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="text-center text-sm text-gray-500 mb-3">SF1</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-blue-100 border border-blue-300 p-2 rounded">
                  <span className="font-medium">2. {seed2.name}</span>
                  <span className="font-bold">-</span>
                </div>
                <div className="flex items-center justify-between bg-blue-100 border border-blue-300 p-2 rounded">
                  <span className="font-medium">Winner QF1</span>
                  <span className="font-bold">-</span>
                </div>
              </div>
            </div>

            {/* SF Game 2 */}
            <div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">
              <div className="text-center text-sm text-gray-500 mb-3">SF2</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-blue-100 border border-blue-300 p-2 rounded">
                  <span className="font-medium">1. {seed1.name}</span>
                  <span className="font-bold">-</span>
                </div>
                <div className="flex items-center justify-between bg-blue-100 border border-blue-300 p-2 rounded">
                  <span className="font-medium">Winner QF2</span>
                  <span className="font-bold">-</span>
                </div>
              </div>
            </div>
          </div>

          {/* Finals */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-gray-900 text-center">Championship</h4>
            
            {/* Championship Game */}
            <div className="bg-gradient-to-br from-[var(--falcons-gold)] to-[var(--falcons-dark-gold)] rounded-lg shadow-lg p-4 border border-amber-300">
              <div className="text-center text-sm text-amber-100 mb-3">Championship</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-white/20 backdrop-blur-sm text-white p-2 rounded">
                  <span className="font-medium">Winner SF1</span>
                  <span className="font-bold">-</span>
                </div>
                <div className="flex items-center justify-between bg-white/20 backdrop-blur-sm text-white p-2 rounded">
                  <span className="font-medium">Winner SF2</span>
                  <span className="font-bold">-</span>
                </div>
              </div>
            </div>

            {/* Championship Trophy */}
            <div className="text-center">
              <Trophy className="w-16 h-16 text-[var(--falcons-gold)] mx-auto mb-4" />
              <h5 className="text-lg font-semibold text-gray-900">Tournament Champion</h5>
              <p className="text-sm text-gray-500">To be determined</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
