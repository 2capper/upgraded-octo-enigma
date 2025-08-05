import { useMemo, useState } from 'react';
import { Medal, Trophy, RefreshCw, Printer, Edit3, CheckCircle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Team, Game, Pool, AgeDivision } from '@shared/schema';

interface PlayoffsTabProps {
  teams: Team[];
  games: Game[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
  tournamentId: string;
}

// Reuse the same calculation logic from the original code
const calculateStats = (teamId: string, games: Game[], teamIdFilter?: string[]) => {
  const relevantGames = games.filter(g => {
    const isInGame = g.homeTeamId === teamId || g.awayTeamId === teamId;
    if (!isInGame || g.status !== 'completed') return false;
    if (teamIdFilter) {
      const otherTeamId = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      return otherTeamId && teamIdFilter.includes(otherTeamId);
    }
    return true;
  });

  let stats = { wins: 0, losses: 0, ties: 0, runsFor: 0, runsAgainst: 0, offensiveInnings: 0, defensiveInnings: 0, forfeitLosses: 0 };
  
  relevantGames.forEach(g => {
    const isHome = g.homeTeamId === teamId;
    stats.runsFor += isHome ? (Number(g.homeScore) || 0) : (Number(g.awayScore) || 0);
    stats.runsAgainst += isHome ? (Number(g.awayScore) || 0) : (Number(g.homeScore) || 0);
    stats.offensiveInnings += isHome ? (Number(g.homeInningsBatted) || 0) : (Number(g.awayInningsBatted) || 0);
    stats.defensiveInnings += isHome ? (Number(g.awayInningsBatted) || 0) : (Number(g.homeInningsBatted) || 0);

    const forfeited = (isHome && g.forfeitStatus === 'home') || (!isHome && g.forfeitStatus === 'away');
    if (forfeited) { stats.losses++; stats.forfeitLosses++; return; }

    const homeScore = Number(g.homeScore) || 0;
    const awayScore = Number(g.awayScore) || 0;
    
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

// Playoff Score Dialog Component
const PlayoffScoreDialog = ({ 
  game, 
  teams, 
  tournamentId, 
  onClose 
}: { 
  game: Game | null; 
  teams: Team[]; 
  tournamentId: string; 
  onClose: () => void; 
}) => {
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [homeInnings, setHomeInnings] = useState('7');
  const [awayInnings, setAwayInnings] = useState('7');
  const [forfeitStatus, setForfeitStatus] = useState('none');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateGameMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const response = await fetch(`/api/games/${game?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (!response.ok) throw new Error('Failed to update game');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Playoff Game Updated",
        description: "Game score has been successfully submitted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId, 'games'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update game score. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!homeScore || !awayScore || !homeInnings || !awayInnings) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    updateGameMutation.mutate({
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
      homeInningsBatted: Number(homeInnings),
      awayInningsBatted: Number(awayInnings),
      forfeitStatus,
      status: 'completed'
    });
  };

  if (!game) return null;

  const homeTeam = teams.find(t => t.id === game.homeTeamId);
  const awayTeam = teams.find(t => t.id === game.awayTeamId);

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-[var(--falcons-green)]" />
          Submit Playoff Game Score
        </DialogTitle>
      </DialogHeader>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="text-center p-4 bg-gray-50 rounded-lg">
          <div className="font-semibold text-lg">
            {awayTeam?.name || 'TBD'} @ {homeTeam?.name || 'TBD'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {game.date} at {game.time} - {game.location}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="awayScore">Away Score</Label>
            <Input
              id="awayScore"
              type="number"
              min="0"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              placeholder="0"
              required
            />
            <div className="text-xs text-gray-500 mt-1">{awayTeam?.name || 'TBD'}</div>
          </div>
          
          <div>
            <Label htmlFor="homeScore">Home Score</Label>
            <Input
              id="homeScore"
              type="number"
              min="0"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              placeholder="0"
              required
            />
            <div className="text-xs text-gray-500 mt-1">{homeTeam?.name || 'TBD'}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="awayInnings">Away Innings</Label>
            <Input
              id="awayInnings"
              type="number"
              step="0.1"
              min="0"
              value={awayInnings}
              onChange={(e) => setAwayInnings(e.target.value)}
              required
            />
          </div>
          
          <div>
            <Label htmlFor="homeInnings">Home Innings</Label>
            <Input
              id="homeInnings"
              type="number"
              step="0.1"
              min="0"
              value={homeInnings}
              onChange={(e) => setHomeInnings(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="forfeit">Forfeit Status</Label>
          <Select value={forfeitStatus} onValueChange={setForfeitStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Forfeit</SelectItem>
              <SelectItem value="home">Home Team Forfeit</SelectItem>
              <SelectItem value="away">Away Team Forfeit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={updateGameMutation.isPending}
            className="flex-1 bg-[var(--falcons-green)] hover:bg-[var(--falcons-green)]/90"
          >
            {updateGameMutation.isPending ? 'Updating...' : 'Submit Score'}
          </Button>
        </div>
      </form>
    </DialogContent>
  );
};

export const PlayoffsTab = ({ teams, games, pools, ageDivisions, tournamentId }: PlayoffsTabProps) => {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const { isAuthenticated } = useAuth();
  const divisionPlayoffTeams = useMemo(() => {
    if (!teams.length || !games.length || !ageDivisions.length) return {};
    
    const result: Record<string, any[]> = {};
    
    // Process each division separately
    ageDivisions.forEach(division => {
      // Get pools for this division
      const divisionPools = pools.filter(pool => pool.ageDivisionId === division.id);
      const divisionPoolIds = divisionPools.map(p => p.id);
      
      // Get teams in this division
      const divisionTeams = teams.filter(team => divisionPoolIds.includes(team.poolId));
      
      // Get games for teams in this division
      const divisionTeamIds = divisionTeams.map(t => t.id);
      const divisionGames = games.filter(g => 
        g.homeTeamId && g.awayTeamId && 
        divisionTeamIds.includes(g.homeTeamId) && divisionTeamIds.includes(g.awayTeamId)
      );
      
      // Calculate standings for division teams
      const allTeamsWithStats = divisionTeams.map(team => {
        const stats = calculateStats(team.id, divisionGames);
        return {
          ...team,
          ...stats,
          points: (stats.wins * 2) + (stats.ties * 1),
          runsAgainstPerInning: stats.defensiveInnings > 0 ? (stats.runsAgainst / stats.defensiveInnings) : 0,
          runsForPerInning: stats.offensiveInnings > 0 ? (stats.runsFor / stats.offensiveInnings) : 0,
        };
      });

      // Sort all teams by points first
      allTeamsWithStats.sort((a, b) => b.points - a.points);
      
      // Group teams by points and resolve ties
      const groups: any[][] = [];
      if (allTeamsWithStats.length > 0) {
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
      }
      
      // Apply tie-breaker logic to each group and flatten the results
      const sortedTeams = groups.flatMap(group => resolveTie(group, divisionGames));
      
      // Store top 6 teams for this division
      result[division.id] = sortedTeams.slice(0, 6);
    });
    
    return result;
  }, [teams, games, pools, ageDivisions]);

  // Check if any division has playoff teams
  const hasAnyPlayoffTeams = Object.values(divisionPlayoffTeams).some(teams => teams.length >= 6);
  
  if (!hasAnyPlayoffTeams) {
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

      {/* Division Tabs */}
      <Tabs defaultValue={ageDivisions[0]?.id} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${ageDivisions.length}, minmax(0, 1fr))` }}>
          {ageDivisions.map((division) => (
            <TabsTrigger key={division.id} value={division.id} className="text-sm md:text-base">
              {division.name}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {ageDivisions.map((division) => {
          const playoffTeams = divisionPlayoffTeams[division.id] || [];
          const hasEnoughTeams = playoffTeams.length >= 6;
          
          if (!hasEnoughTeams) {
            return (
              <TabsContent key={division.id} value={division.id} className="mt-6">
                <div className="text-center p-8 bg-gray-50 rounded-xl">
                  <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">{division.name} Playoff Bracket Not Ready</h3>
                  <p className="text-gray-500">Not enough completed games to determine playoff bracket.</p>
                </div>
              </TabsContent>
            );
          }
          
          const [seed1, seed2, seed3, seed4, seed5, seed6] = playoffTeams;
          
          return (
            <TabsContent key={division.id} value={division.id} className="mt-6 space-y-6">
              {/* Playoff Rankings Table */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">{division.name} Playoff Rankings</h4>
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

              {/* Playoff Bracket */}
              <div className="bg-gray-800 rounded-xl p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Quarterfinals */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-bold text-white text-center uppercase tracking-wider">Quarterfinals</h4>
                    
                    {/* QF Game 1 */}
                    {(() => {
                      const qf1Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed3.id && g.awayTeamId === seed6.id) ||
                         (g.homeTeamId === seed6.id && g.awayTeamId === seed3.id))
                      );
                      const isCompleted = qf1Game?.status === 'completed';
                      const homeTeam = teams.find(t => t.id === qf1Game?.homeTeamId);
                      const awayTeam = teams.find(t => t.id === qf1Game?.awayTeamId);
                      
                      return (
                        <div 
                          className={`bg-gray-900 rounded-lg shadow-lg p-4 border-2 cursor-pointer transition-all ${
                            isCompleted ? 'border-green-500' : 'border-gray-700 hover:border-[var(--falcons-green)]'
                          }`}
                          onClick={() => {
                            if (!isAuthenticated) {
                              alert('Please sign in as an administrator to edit playoff scores.');
                              return;
                            }
                            qf1Game && setSelectedGame(qf1Game);
                          }}
                        >
                          <div className="text-center text-xs font-bold text-yellow-400 uppercase mb-3 flex items-center justify-center">
                            Game 1
                            {isCompleted ? (
                              <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                            ) : (
                              <Edit3 className="w-3 h-3 ml-1 text-gray-400" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between bg-gray-700 text-white p-3 rounded border border-gray-600">
                              <span className="font-bold">3. {seed3.name}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && qf1Game ? 
                                  (qf1Game.awayTeamId === seed3.id ? qf1Game.awayScore : qf1Game.homeScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                            <div className="text-center text-gray-400 text-xs">VS</div>
                            <div className="flex items-center justify-between bg-gray-700 text-white p-3 rounded border border-gray-600">
                              <span className="font-bold">6. {seed6.name}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && qf1Game ? 
                                  (qf1Game.awayTeamId === seed6.id ? qf1Game.awayScore : qf1Game.homeScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                          </div>
                          {!isCompleted && (
                            <div className="text-center mt-2 text-xs text-gray-400">
                              Click to enter score
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* QF Game 2 */}
                    {(() => {
                      const qf2Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed4.id && g.awayTeamId === seed5.id) ||
                         (g.homeTeamId === seed5.id && g.awayTeamId === seed4.id))
                      );
                      const isCompleted = qf2Game?.status === 'completed';
                      
                      return (
                        <div 
                          className={`bg-gray-900 rounded-lg shadow-lg p-4 border-2 cursor-pointer transition-all ${
                            isCompleted ? 'border-green-500' : 'border-gray-700 hover:border-[var(--falcons-green)]'
                          }`}
                          onClick={() => qf2Game && setSelectedGame(qf2Game)}
                        >
                          <div className="text-center text-xs font-bold text-yellow-400 uppercase mb-3 flex items-center justify-center">
                            Game 2
                            {isCompleted ? (
                              <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                            ) : (
                              <Edit3 className="w-3 h-3 ml-1 text-gray-400" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between bg-gray-700 text-white p-3 rounded border border-gray-600">
                              <span className="font-bold">4. {seed4.name}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && qf2Game ? 
                                  (qf2Game.awayTeamId === seed4.id ? qf2Game.awayScore : qf2Game.homeScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                            <div className="text-center text-gray-400 text-xs">VS</div>
                            <div className="flex items-center justify-between bg-gray-700 text-white p-3 rounded border border-gray-600">
                              <span className="font-bold">5. {seed5.name}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && qf2Game ? 
                                  (qf2Game.awayTeamId === seed5.id ? qf2Game.awayScore : qf2Game.homeScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                          </div>
                          {!isCompleted && (
                            <div className="text-center mt-2 text-xs text-gray-400">
                              Click to enter score
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Semifinals */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-bold text-white text-center uppercase tracking-wider">Semifinals</h4>
                    
                    {/* SF Game 1 */}
                    {(() => {
                      // Find QF winners
                      const qf1Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed3.id && g.awayTeamId === seed6.id) ||
                         (g.homeTeamId === seed6.id && g.awayTeamId === seed3.id))
                      );
                      const qf2Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed4.id && g.awayTeamId === seed5.id) ||
                         (g.homeTeamId === seed5.id && g.awayTeamId === seed4.id))
                      );

                      // Determine QF winners
                      let qf1Winner = null;
                      let qf2Winner = null;
                      
                      if (qf1Game?.status === 'completed' && qf1Game.homeScore !== null && qf1Game.awayScore !== null) {
                        const homeScore = Number(qf1Game.homeScore);
                        const awayScore = Number(qf1Game.awayScore);
                        if (homeScore > awayScore) {
                          qf1Winner = teams.find(t => t.id === qf1Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          qf1Winner = teams.find(t => t.id === qf1Game.awayTeamId);
                        }
                      }
                      
                      if (qf2Game?.status === 'completed' && qf2Game.homeScore !== null && qf2Game.awayScore !== null) {
                        const homeScore = Number(qf2Game.homeScore);
                        const awayScore = Number(qf2Game.awayScore);
                        if (homeScore > awayScore) {
                          qf2Winner = teams.find(t => t.id === qf2Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          qf2Winner = teams.find(t => t.id === qf2Game.awayTeamId);
                        }
                      }

                      // Find SF1 game
                      const sf1Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed2.id && qf1Winner && g.awayTeamId === qf1Winner.id) ||
                         (qf1Winner && g.homeTeamId === qf1Winner.id && g.awayTeamId === seed2.id))
                      );
                      const isCompleted = sf1Game?.status === 'completed';
                      
                      return (
                        <div 
                          className={`bg-gray-900 rounded-lg shadow-lg p-4 border-2 cursor-pointer transition-all ${
                            isCompleted ? 'border-green-500' : qf1Winner ? 'border-blue-600 hover:border-[var(--falcons-green)]' : 'border-gray-600'
                          }`}
                          onClick={() => sf1Game && qf1Winner && setSelectedGame(sf1Game)}
                        >
                          <div className="text-center text-xs font-bold text-blue-400 uppercase mb-3 flex items-center justify-center">
                            Semi 1
                            {isCompleted ? (
                              <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                            ) : qf1Winner ? (
                              <Edit3 className="w-3 h-3 ml-1 text-gray-400" />
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between bg-blue-900 text-white p-3 rounded border border-blue-700">
                              <span className="font-bold">2. {seed2.name}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && sf1Game ? 
                                  (sf1Game.homeTeamId === seed2.id ? sf1Game.homeScore : sf1Game.awayScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                            <div className="text-center text-gray-400 text-xs">VS</div>
                            <div className="flex items-center justify-between bg-gray-700 text-white p-3 rounded border border-gray-600">
                              <span className="font-bold">{qf1Winner ? `${qf1Winner.name}` : 'Winner Game 1'}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && sf1Game && qf1Winner ? 
                                  (sf1Game.homeTeamId === qf1Winner.id ? sf1Game.homeScore : sf1Game.awayScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                          </div>
                          {!isCompleted && qf1Winner && (
                            <div className="text-center mt-2 text-xs text-gray-400">
                              Click to enter score
                            </div>
                          )}
                          {!qf1Winner && (
                            <div className="text-center mt-2 text-xs text-gray-500">
                              Waiting for Game 1 result
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* SF Game 2 */}
                    {(() => {
                      // Find QF winners
                      const qf1Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed3.id && g.awayTeamId === seed6.id) ||
                         (g.homeTeamId === seed6.id && g.awayTeamId === seed3.id))
                      );
                      const qf2Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed4.id && g.awayTeamId === seed5.id) ||
                         (g.homeTeamId === seed5.id && g.awayTeamId === seed4.id))
                      );

                      // Determine QF winners
                      let qf1Winner = null;
                      let qf2Winner = null;
                      
                      if (qf1Game?.status === 'completed' && qf1Game.homeScore !== null && qf1Game.awayScore !== null) {
                        const homeScore = Number(qf1Game.homeScore);
                        const awayScore = Number(qf1Game.awayScore);
                        if (homeScore > awayScore) {
                          qf1Winner = teams.find(t => t.id === qf1Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          qf1Winner = teams.find(t => t.id === qf1Game.awayTeamId);
                        }
                      }
                      
                      if (qf2Game?.status === 'completed' && qf2Game.homeScore !== null && qf2Game.awayScore !== null) {
                        const homeScore = Number(qf2Game.homeScore);
                        const awayScore = Number(qf2Game.awayScore);
                        if (homeScore > awayScore) {
                          qf2Winner = teams.find(t => t.id === qf2Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          qf2Winner = teams.find(t => t.id === qf2Game.awayTeamId);
                        }
                      }

                      // Find SF2 game
                      const sf2Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed1.id && qf2Winner && g.awayTeamId === qf2Winner.id) ||
                         (qf2Winner && g.homeTeamId === qf2Winner.id && g.awayTeamId === seed1.id))
                      );
                      const isCompleted = sf2Game?.status === 'completed';
                      
                      return (
                        <div 
                          className={`bg-gray-900 rounded-lg shadow-lg p-4 border-2 cursor-pointer transition-all ${
                            isCompleted ? 'border-green-500' : qf2Winner ? 'border-blue-600 hover:border-[var(--falcons-green)]' : 'border-gray-600'
                          }`}
                          onClick={() => sf2Game && qf2Winner && setSelectedGame(sf2Game)}
                        >
                          <div className="text-center text-xs font-bold text-blue-400 uppercase mb-3 flex items-center justify-center">
                            Semi 2
                            {isCompleted ? (
                              <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                            ) : qf2Winner ? (
                              <Edit3 className="w-3 h-3 ml-1 text-gray-400" />
                            ) : null}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between bg-blue-900 text-white p-3 rounded border border-blue-700">
                              <span className="font-bold">1. {seed1.name}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && sf2Game ? 
                                  (sf2Game.homeTeamId === seed1.id ? sf2Game.homeScore : sf2Game.awayScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                            <div className="text-center text-gray-400 text-xs">VS</div>
                            <div className="flex items-center justify-between bg-gray-700 text-white p-3 rounded border border-gray-600">
                              <span className="font-bold">{qf2Winner ? `${qf2Winner.name}` : 'Winner Game 2'}</span>
                              <span className="font-bold text-xl">
                                {isCompleted && sf2Game && qf2Winner ? 
                                  (sf2Game.homeTeamId === qf2Winner.id ? sf2Game.homeScore : sf2Game.awayScore) : 
                                  '-'
                                }
                              </span>
                            </div>
                          </div>
                          {!isCompleted && qf2Winner && (
                            <div className="text-center mt-2 text-xs text-gray-400">
                              Click to enter score
                            </div>
                          )}
                          {!qf2Winner && (
                            <div className="text-center mt-2 text-xs text-gray-500">
                              Waiting for Game 2 result
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Finals */}
                  <div className="space-y-6">
                    <h4 className="text-lg font-bold text-white text-center uppercase tracking-wider">Championship</h4>
                    
                    {/* Championship Game */}
                    {(() => {
                      // Find QF winners first
                      const qf1Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed3.id && g.awayTeamId === seed6.id) ||
                         (g.homeTeamId === seed6.id && g.awayTeamId === seed3.id))
                      );
                      const qf2Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed4.id && g.awayTeamId === seed5.id) ||
                         (g.homeTeamId === seed5.id && g.awayTeamId === seed4.id))
                      );

                      // Determine QF winners
                      let qf1Winner = null;
                      let qf2Winner = null;
                      
                      if (qf1Game?.status === 'completed' && qf1Game.homeScore !== null && qf1Game.awayScore !== null) {
                        const homeScore = Number(qf1Game.homeScore);
                        const awayScore = Number(qf1Game.awayScore);
                        if (homeScore > awayScore) {
                          qf1Winner = teams.find(t => t.id === qf1Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          qf1Winner = teams.find(t => t.id === qf1Game.awayTeamId);
                        }
                      }
                      
                      if (qf2Game?.status === 'completed' && qf2Game.homeScore !== null && qf2Game.awayScore !== null) {
                        const homeScore = Number(qf2Game.homeScore);
                        const awayScore = Number(qf2Game.awayScore);
                        if (homeScore > awayScore) {
                          qf2Winner = teams.find(t => t.id === qf2Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          qf2Winner = teams.find(t => t.id === qf2Game.awayTeamId);
                        }
                      }

                      // Find SF winners
                      const sf1Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed2.id && qf1Winner && g.awayTeamId === qf1Winner.id) ||
                         (qf1Winner && g.homeTeamId === qf1Winner.id && g.awayTeamId === seed2.id))
                      );
                      const sf2Game = games.find(g => 
                        g.isPlayoff && 
                        ((g.homeTeamId === seed1.id && qf2Winner && g.awayTeamId === qf2Winner.id) ||
                         (qf2Winner && g.homeTeamId === qf2Winner.id && g.awayTeamId === seed1.id))
                      );

                      let sf1Winner = null;
                      let sf2Winner = null;

                      if (sf1Game?.status === 'completed' && sf1Game.homeScore !== null && sf1Game.awayScore !== null) {
                        const homeScore = Number(sf1Game.homeScore);
                        const awayScore = Number(sf1Game.awayScore);
                        if (homeScore > awayScore) {
                          sf1Winner = teams.find(t => t.id === sf1Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          sf1Winner = teams.find(t => t.id === sf1Game.awayTeamId);
                        }
                      }

                      if (sf2Game?.status === 'completed' && sf2Game.homeScore !== null && sf2Game.awayScore !== null) {
                        const homeScore = Number(sf2Game.homeScore);
                        const awayScore = Number(sf2Game.awayScore);
                        if (homeScore > awayScore) {
                          sf2Winner = teams.find(t => t.id === sf2Game.homeTeamId);
                        } else if (awayScore > homeScore) {
                          sf2Winner = teams.find(t => t.id === sf2Game.awayTeamId);
                        }
                      }

                      // Find Championship game
                      const champGame = games.find(g => 
                        g.isPlayoff && 
                        sf1Winner && sf2Winner &&
                        ((g.homeTeamId === sf1Winner.id && g.awayTeamId === sf2Winner.id) ||
                         (g.homeTeamId === sf2Winner.id && g.awayTeamId === sf1Winner.id))
                      );
                      const isCompleted = champGame?.status === 'completed';
                      const canPlay = sf1Winner && sf2Winner;

                      let champion = null;
                      if (isCompleted && champGame && champGame.homeScore !== null && champGame.awayScore !== null) {
                        const homeScore = Number(champGame.homeScore);
                        const awayScore = Number(champGame.awayScore);
                        if (homeScore > awayScore) {
                          champion = teams.find(t => t.id === champGame.homeTeamId);
                        } else if (awayScore > homeScore) {
                          champion = teams.find(t => t.id === champGame.awayTeamId);
                        }
                      }

                      return (
                        <div>
                          <div 
                            className={`bg-gradient-to-br from-yellow-600 to-yellow-700 rounded-lg shadow-xl p-4 border-2 cursor-pointer transition-all ${
                              isCompleted ? 'border-green-400' : canPlay ? 'border-yellow-500 hover:border-[var(--falcons-green)]' : 'border-gray-600'
                            }`}
                            onClick={() => champGame && canPlay && setSelectedGame(champGame)}
                          >
                            <div className="text-center text-xs font-bold text-white uppercase mb-3 flex items-center justify-center">
                              Final
                              {isCompleted ? (
                                <CheckCircle className="w-3 h-3 ml-1 text-green-400" />
                              ) : canPlay ? (
                                <Edit3 className="w-3 h-3 ml-1 text-white" />
                              ) : null}
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between bg-gray-900/80 backdrop-blur-sm text-white p-3 rounded border border-yellow-600">
                                <span className="font-bold">{sf1Winner ? sf1Winner.name : 'Winner Semi 1'}</span>
                                <span className="font-bold text-xl">
                                  {isCompleted && champGame && sf1Winner ? 
                                    (champGame.homeTeamId === sf1Winner.id ? champGame.homeScore : champGame.awayScore) : 
                                    '-'
                                  }
                                </span>
                              </div>
                              <div className="text-center text-white text-xs font-bold">VS</div>
                              <div className="flex items-center justify-between bg-gray-900/80 backdrop-blur-sm text-white p-3 rounded border border-yellow-600">
                                <span className="font-bold">{sf2Winner ? sf2Winner.name : 'Winner Semi 2'}</span>
                                <span className="font-bold text-xl">
                                  {isCompleted && champGame && sf2Winner ? 
                                    (champGame.homeTeamId === sf2Winner.id ? champGame.homeScore : champGame.awayScore) : 
                                    '-'
                                  }
                                </span>
                              </div>
                            </div>
                            {!isCompleted && canPlay && (
                              <div className="text-center mt-2 text-xs text-white">
                                Click to enter championship score
                              </div>
                            )}
                            {!canPlay && (
                              <div className="text-center mt-2 text-xs text-gray-300">
                                Waiting for semifinal results
                              </div>
                            )}
                          </div>

                          {/* Championship Trophy */}
                          <div className="text-center mt-6">
                            <Trophy className="w-20 h-20 text-yellow-400 mx-auto mb-4 drop-shadow-lg" />
                            <h5 className="text-xl font-bold text-white uppercase">Champion</h5>
                            <p className="text-sm text-gray-400">
                              {champion ? champion.name : 'To be determined'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Score Dialog */}
      <Dialog open={!!selectedGame} onOpenChange={() => setSelectedGame(null)}>
        <PlayoffScoreDialog
          game={selectedGame}
          teams={teams}
          tournamentId={tournamentId}
          onClose={() => setSelectedGame(null)}
        />
      </Dialog>
    </div>
  );
};
