import { useState, useMemo } from 'react';
import { ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Game, Team, Pool } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface ScoreSubmissionNewProps {
  games: Game[];
  teams: Team[];
  pools: Pool[];
  tournamentId: string;
}

export const ScoreSubmissionNew = ({ games, teams, pools, tournamentId }: ScoreSubmissionNewProps) => {
  const [selectedPoolId, setSelectedPoolId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [homeInnings, setHomeInnings] = useState('');
  const [awayInnings, setAwayInnings] = useState('');
  const [forfeitStatus, setForfeitStatus] = useState('none');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const scheduledGames = useMemo(() => games.filter(g => g.status === 'scheduled'), [games]);
  const gamesInPool = useMemo(() => scheduledGames.filter(g => g.poolId === selectedPoolId), [scheduledGames, selectedPoolId]);
  const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || 'Unknown';
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

    updateGameMutation.mutate({
      homeScore: Number(homeScore),
      awayScore: Number(awayScore),
      homeInningsBatted: homeInnings,
      awayInningsBatted: awayInnings,
      status: 'completed',
      forfeitStatus
    });
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
          <div>
            <Label htmlFor="pool" className="text-sm font-medium">1. Select Pool</Label>
            <Select value={selectedPoolId} onValueChange={(value) => { setSelectedPoolId(value); resetForm(); }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Choose a Pool" />
              </SelectTrigger>
              <SelectContent>
                {pools.map(pool => (
                  <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPoolId && (
            <div>
              <Label htmlFor="game" className="text-sm font-medium">2. Select Game</Label>
              <Select value={selectedGameId} onValueChange={setSelectedGameId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a Game" />
                </SelectTrigger>
                <SelectContent>
                  {gamesInPool.map(game => (
                    <SelectItem key={game.id} value={game.id}>
                      {getTeamName(game.homeTeamId)} vs {getTeamName(game.awayTeamId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedGame && (
            <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 space-y-4">
              <h3 className="font-semibold text-gray-900">3. Enter Final Score & Innings</h3>
              
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
                  <Label htmlFor="homeInnings" className="text-sm font-medium">Home Innings Batted</Label>
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
                  <Label htmlFor="awayInnings" className="text-sm font-medium">Away Innings Batted</Label>
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
            className="w-full bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
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