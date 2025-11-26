import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Team, Game, Pool, AgeDivision, Tournament } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateStats, resolveTie } from '@shared/standings';

interface StandingsTableProps {
  teams: Team[];
  games: Game[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
  tournament?: Tournament | null;
  showPoolColumn?: boolean;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export const StandingsTable = ({ 
  teams, 
  games, 
  pools, 
  ageDivisions, 
  tournament, 
  showPoolColumn = true,
  primaryColor,
  secondaryColor
}: StandingsTableProps) => {
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  
  const brandStyle = {
    "--brand-primary": primaryColor || "#1a4d2e", 
    "--brand-secondary": secondaryColor || "#ffffff",
    "--brand-light": primaryColor ? `color-mix(in srgb, ${primaryColor} 10%, white)` : "#f0fdf4",
    "--brand-muted": primaryColor ? `color-mix(in srgb, ${primaryColor} 50%, white)` : "#86efac",
  } as React.CSSProperties;

  const standingsByDivision = useMemo(() => {
    if (!teams.length || !ageDivisions.length) return [];
    
    const targetDivisions = ageDivisions;
    
    return targetDivisions.map(division => {
      const divisionPools = pools.filter(p => p.ageDivisionId === division.id);
      
      const divisionTeams = teams.filter(t => 
        divisionPools.some(p => p.id === t.poolId)
      );
      
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

      const groups = teamStats.reduce((acc, team) => {
        const points = team.points;
        if (!acc[points]) acc[points] = [];
        acc[points].push(team);
        return acc;
      }, {} as Record<number, any[]>);

      const poolWinners: any[] = [];
      const poolRunnersUp: any[] = [];
      const remainingTeams: any[] = [];
      
      divisionPools.forEach(pool => {
        const poolTeams = teamStats.filter(t => t.poolId === pool.id);
        
        const poolGroups = poolTeams.reduce((acc, team) => {
          const points = team.points;
          if (!acc[points]) acc[points] = [];
          acc[points].push(team);
          return acc;
        }, {} as Record<number, any[]>);

        const sortedPoolTeams = Object.keys(poolGroups)
          .sort((a, b) => Number(b) - Number(a))
          .flatMap(points => resolveTie(poolGroups[Number(points)], games));
        
        if (sortedPoolTeams.length > 0) {
          const poolWinner = { ...sortedPoolTeams[0], isPoolWinner: true };
          poolWinners.push(poolWinner);
          
          if (sortedPoolTeams.length > 1) {
            const runnerUp = { ...sortedPoolTeams[1], isPoolRunnerUp: true };
            poolRunnersUp.push(runnerUp);
            
            remainingTeams.push(...sortedPoolTeams.slice(2));
          }
        }
      });
      
      poolWinners.sort((a, b) => a.runsAgainstPerInning - b.runsAgainstPerInning);
      
      poolRunnersUp.sort((a, b) => a.runsAgainstPerInning - b.runsAgainstPerInning);
      
      const remainingGroups = remainingTeams.reduce((acc, team) => {
        const points = team.points;
        if (!acc[points]) acc[points] = [];
        acc[points].push(team);
        return acc;
      }, {} as Record<number, any[]>);
      
      const sortedRemainingTeams = Object.keys(remainingGroups)
        .sort((a, b) => Number(b) - Number(a))
        .flatMap(points => resolveTie(remainingGroups[Number(points)], games));
      
      const overallStandings = [...poolWinners, ...poolRunnersUp, ...sortedRemainingTeams];

      const sortedPoolsForDisplay = [...divisionPools].sort((a, b) => {
        const extractIdentifier = (name: string) => {
          const match = name.match(/Pool\s*([A-Za-z0-9]+)/i);
          return match ? match[1] : name;
        };
        
        const idA = extractIdentifier(a.name || '');
        const idB = extractIdentifier(b.name || '');
        
        const numA = parseInt(idA);
        const numB = parseInt(idB);
        
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        } else {
          return idA.localeCompare(idB);
        }
      });

      const poolStandings = sortedPoolsForDisplay.map(pool => {
        const poolTeams = teamStats.filter(t => t.poolId === pool.id);
        
        const poolGroups = poolTeams.reduce((acc, team) => {
          const points = team.points;
          if (!acc[points]) acc[points] = [];
          acc[points].push(team);
          return acc;
        }, {} as Record<number, any[]>);

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
                <div 
                  className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: "var(--brand-primary)" }}
                >
                  {index + 1}
                </div>
                <div>
                  <div className="flex items-center">
                    <span className="font-semibold text-gray-900">{team.name}</span>
                    {team.isPoolWinner && (
                      <span 
                        className="ml-2 px-2 py-1 text-white text-xs rounded-full font-bold"
                        style={{ backgroundColor: "var(--brand-primary)" }}
                      >
                        POOL WINNER
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
            <div className={`grid gap-3 text-center ${(tournament?.showTiebreakers !== false) ? 'grid-cols-4' : 'grid-cols-2'}`}>
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
              {(tournament?.showTiebreakers !== false) && (
                <>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{team.runsAgainstPerInning.toFixed(3)}</div>
                    <div className="text-xs text-gray-500">RA/Inn</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{team.runsForPerInning.toFixed(3)}</div>
                    <div className="text-xs text-gray-500">RF/Inn</div>
                  </div>
                </>
              )}
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
              {(tournament?.showTiebreakers !== false) && (
                <>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Defensive Innings Played">DIP</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Runs Allowed per Defensive Inning">RA/Inn</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" title="Runs For per Offensive Inning">RF/Inn</th>
                </>
              )}
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {teams.map((team, index) => (
              <tr key={team.id} className={`hover:bg-gray-50 transition-colors ${team.forfeitLosses > 0 ? 'bg-red-50' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div 
                      className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: "var(--brand-primary)" }}
                    >
                      {index + 1}
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-900">{team.name}</span>
                        {team.isPoolWinner && (
                          <span 
                            className="ml-2 px-2 py-1 text-white text-xs rounded-full font-bold"
                            style={{ backgroundColor: "var(--brand-primary)" }}
                          >
                            POOL WINNER
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
                    <span 
                      className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                      style={{ 
                        backgroundColor: "var(--brand-light)", 
                        color: "var(--brand-primary)" 
                      }}
                    >
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
                {(tournament?.showTiebreakers !== false) && (
                  <>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                      {team.defensiveInnings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                      {team.runsAgainstPerInning.toFixed(3)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 font-semibold">
                      {team.runsForPerInning.toFixed(3)}
                    </td>
                  </>
                )}
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

  const targetDivisions = ageDivisions;

  const displayedDivisions = selectedDivision 
    ? standingsByDivision.filter(s => s.division.id === selectedDivision)
    : standingsByDivision;

  return (
    <div className="space-y-8" style={brandStyle}>
      {/* Division Toggle Buttons */}
      <div className="flex items-center justify-center space-x-4 overflow-x-auto pb-2">
        <Button
          onClick={() => setSelectedDivision(null)}
          style={{
            backgroundColor: selectedDivision === null ? "var(--brand-primary)" : "transparent",
            color: selectedDivision === null ? "white" : "var(--brand-primary)",
            borderColor: "var(--brand-primary)",
            borderWidth: "1px"
          }}
          className="hover:opacity-90 whitespace-nowrap"
          data-testid="button-all-divisions"
        >
          All Divisions
        </Button>
        {targetDivisions.map(division => (
          <Button
            key={division.id}
            onClick={() => setSelectedDivision(division.id)}
            style={{
              backgroundColor: selectedDivision === division.id ? "var(--brand-primary)" : "transparent",
              color: selectedDivision === division.id ? "white" : "var(--brand-primary)",
              borderColor: "var(--brand-primary)",
              borderWidth: "1px"
            }}
            className="hover:opacity-90 whitespace-nowrap"
            data-testid={`button-division-${division.id}`}
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
              <TabsList className="grid w-full bg-gray-100" style={{ gridTemplateColumns: `repeat(${poolStandings.length}, minmax(0, 1fr))` }}>
                {poolStandings.map(({ pool }) => (
                  <TabsTrigger 
                    key={pool.id} 
                    value={pool.id} 
                    className="text-xs md:text-sm data-[state=active]:bg-[var(--brand-primary)] data-[state=active]:text-white"
                  >
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

      {/* Tiebreaker Information Section */}
      {(tournament?.showTiebreakers !== false) && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 mt-8">
          <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span 
              className="text-white rounded-full w-6 h-6 flex items-center justify-center text-sm mr-3"
              style={{ backgroundColor: "var(--brand-primary)" }}
            >!</span>
            Tiebreaker Rules
          </h4>
          <div className="text-sm text-gray-700 space-y-3">
            <div>
              <p className="font-medium text-gray-900 mb-2">Point System:</p>
              <div className="ml-4 text-xs space-y-1">
                <div><strong>Win</strong> = 2 pts | <strong>Tie</strong> = 1 pt | <strong>Loss</strong> = 0 pts</div>
              </div>
            </div>
            
            <div>
              <p className="font-medium text-gray-900">When teams are tied in points, rankings are determined by:</p>
              <ol className="list-decimal list-inside space-y-1 ml-4">
                <li><strong>Teams with a forfeit loss are ineligible</strong> for tiebreakers</li>
                <li><strong>Head-to-head record</strong> among tied teams</li>
                <li><strong>Smallest runs against ratio</strong> (runs allowed ÷ defensive innings played) in games among tied teams</li>
                <li><strong>Smallest runs against ratio</strong> (runs allowed ÷ defensive innings played) in all games</li>
                <li><strong>Highest runs for ratio</strong> (runs scored ÷ offensive innings played) in games among tied teams</li>
                <li><strong>Highest runs for ratio</strong> (runs scored ÷ offensive innings played) in all games</li>
                <li><strong>Coin toss</strong> (final tiebreaker)</li>
              </ol>
            </div>

            <div 
              className="mt-4 p-3 border rounded-md"
              style={{ 
                backgroundColor: "var(--brand-light)", 
                borderColor: "var(--brand-muted)" 
              }}
            >
              <p className="text-xs" style={{ color: "var(--brand-primary)" }}>
                <strong>Special Rule for 3+ Team Ties:</strong> When 3 or more teams are tied, head-to-head record (rule #2) is excluded until only 2 teams remain. Once down to 2 teams, tiebreakers restart from head-to-head record.
              </p>
            </div>

            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-xs text-yellow-800">
                <strong>Abbreviations:</strong> DIP = Defensive Innings Played, RA/Inn = Runs Allowed per Defensive Inning. These ratios ensure fair comparison when teams have played different numbers of games or innings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
