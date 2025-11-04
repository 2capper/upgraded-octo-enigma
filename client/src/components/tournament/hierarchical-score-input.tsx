import { useState, useMemo } from 'react';
import { ListChecks, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Game, Team, Pool, AgeDivision } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface HierarchicalScoreInputProps {
  games: Game[];
  teams: Team[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
  tournamentId: string;
}

export const HierarchicalScoreInput = ({ 
  games, 
  teams, 
  pools, 
  ageDivisions, 
  tournamentId 
}: HierarchicalScoreInputProps) => {
  const [selectedDivisionId, setSelectedDivisionId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [homeInnings, setHomeInnings] = useState('');
  const [awayInnings, setAwayInnings] = useState('');
  const [forfeitStatus, setForfeitStatus] = useState('none');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Show all available divisions
  const targetDivisions = useMemo(() => 
    ageDivisions,
    [ageDivisions]
  );

  // Get teams in the selected division
  const teamsInDivision = useMemo(() => {
    if (!selectedDivisionId) return [];
    const divisionPools = pools.filter(p => p.ageDivisionId === selectedDivisionId);
    return teams.filter(t => divisionPools.some(p => p.id === t.poolId));
  }, [selectedDivisionId, pools, teams]);

  // Get games for the selected team that are scheduled
  const gamesForTeam = useMemo(() => {
    if (!selectedTeamId) return [];
    return games.filter(g => 
      (g.homeTeamId === selectedTeamId || g.awayTeamId === selectedTeamId) && 
      g.status === 'scheduled'
    );
  }, [selectedTeamId, games]);

  const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || 'Unknown';
  const getPoolName = (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return 'Unknown';
    
    // Extract number from pool name (e.g., "Pool Pool 3" -> "3")
    const match = pool.name.match(/(\d+)$/);
    return match ? match[1] : pool.name;
  };
  const selectedGame = useMemo(() => games.find(g => g.id === selectedGameId), [games, selectedGameId]);

  const updateGameMutation = useMutation({
    mutationFn: async (updateData: any) => {
      const response = await fetch(`/api/games/${selectedGameId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (!response.ok) throw new Error('Failed to update game');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Score Updated",
        description: "Game score has been successfully submitted.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId, 'games'] });
      resetForm();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to submit score. Please try again.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setSelectedGameId('');
    setHomeScore('');
    setAwayScore('');
    setHomeInnings('');
    setAwayInnings('');
    setForfeitStatus('none');
  };

  const handleDivisionChange = (divisionId: string) => {
    setSelectedDivisionId(divisionId);
    setSelectedTeamId('');
    resetForm();
  };

  const handleTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGameId || homeScore === '' || awayScore === '' || homeInnings === '' || awayInnings === '') {
      toast({
        title: "Missing Information",
        description: "Please fill out all fields.",
        variant: "destructive",
      });
      return;
    }

    const updateData = {
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
      homeInningsBatted: Number(homeInnings),
      awayInningsBatted: Number(awayInnings),
      status: 'completed' as const,
      forfeitStatus
    };

    updateGameMutation.mutate(updateData);
  };

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center">
          <ListChecks className="w-6 h-6 text-[var(--falcons-green)] mr-2" />
          Submit Game Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Step 1: Select Division */}
          <div>
            <Label htmlFor="division" className="text-sm font-medium flex items-center">
              <span className="bg-[var(--falcons-green)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">1</span>
              Select Division
            </Label>
            <Select value={selectedDivisionId} onValueChange={handleDivisionChange}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a Division" />
              </SelectTrigger>
              <SelectContent>
                {targetDivisions.map(division => (
                  <SelectItem key={division.id} value={division.id}>{division.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Team */}
          {selectedDivisionId && (
            <div>
              <Label htmlFor="team" className="text-sm font-medium flex items-center">
                <span className="bg-[var(--falcons-green)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">2</span>
                Select Your Team
              </Label>
              <Select value={selectedTeamId} onValueChange={handleTeamChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose Your Team" />
                </SelectTrigger>
                <SelectContent>
                  {teamsInDivision.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name} ({getPoolName(team.poolId)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Step 3: Select Game */}
          {selectedTeamId && (
            <div>
              <Label htmlFor="game" className="text-sm font-medium flex items-center">
                <span className="bg-[var(--falcons-green)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">3</span>
                Select Pool Game
              </Label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a Game" />
                </SelectTrigger>
                <SelectContent>
                  {gamesForTeam.map(game => {
                    const opponent = game.homeTeamId === selectedTeamId ? game.awayTeamId : game.homeTeamId;
                    const isHome = game.homeTeamId === selectedTeamId;
                    return (
                      <SelectItem key={game.id} value={game.id}>
                        {isHome ? 'vs' : '@'} {getTeamName(opponent)} ({getPoolName(game.poolId)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {gamesForTeam.length === 0 && selectedTeamId && (
                <Alert className="mt-2">
                  <AlertDescription>
                    No scheduled games found for this team. All games may already be completed.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 4: Enter Score */}
          {selectedGame && (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              <Label className="text-sm font-medium flex items-center">
                <span className="bg-[var(--falcons-green)] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs mr-2">4</span>
                Enter Final Score & Innings
              </Label>
              
              <div className="text-center p-3 bg-white rounded border">
                <div className="text-lg font-semibold text-gray-900">
                  {getTeamName(selectedGame.homeTeamId)} vs {getTeamName(selectedGame.awayTeamId)}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Pool: {getPoolName(selectedGame.poolId)}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="homeScore" className="text-sm font-medium">
                    {getTeamName(selectedGame.homeTeamId)} Score
                  </Label>
                  <Input
                    id="homeScore"
                    type="number"
                    value={homeScore}
                    onChange={(e) => setHomeScore(e.target.value)}
                    className="mt-1"
                    min="0"
                  />
                </div>
                
                <div>
                  <Label htmlFor="awayScore" className="text-sm font-medium">
                    {getTeamName(selectedGame.awayTeamId)} Score
                  </Label>
                  <Input
                    id="awayScore"
                    type="number"
                    value={awayScore}
                    onChange={(e) => setAwayScore(e.target.value)}
                    className="mt-1"
                    min="0"
                  />
                </div>
                
                <div>
                  <Label htmlFor="homeInnings" className="text-sm font-medium">Innings Batted</Label>
                  <Input
                    id="homeInnings"
                    type="number"
                    value={homeInnings}
                    onChange={(e) => setHomeInnings(e.target.value)}
                    className="mt-1"
                    min="0"
                    step="0.1"
                  />
                </div>
                
                <div>
                  <Label htmlFor="awayInnings" className="text-sm font-medium">Innings Batted</Label>
                  <Input
                    id="awayInnings"
                    type="number"
                    value={awayInnings}
                    onChange={(e) => setAwayInnings(e.target.value)}
                    className="mt-1"
                    min="0"
                    step="0.1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="forfeit" className="text-sm font-medium">Forfeit Status</Label>
                <Select value={forfeitStatus} onValueChange={setForfeitStatus}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Forfeit</SelectItem>
                    <SelectItem value="home">Forfeited by {getTeamName(selectedGame.homeTeamId)}</SelectItem>
                    <SelectItem value="away">Forfeited by {getTeamName(selectedGame.awayTeamId)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <Button 
            type="submit" 
            disabled={updateGameMutation.isPending || !selectedGameId} 
            className="w-full min-h-[48px] text-base font-semibold"
            style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
          >
            {updateGameMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Final Score'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};