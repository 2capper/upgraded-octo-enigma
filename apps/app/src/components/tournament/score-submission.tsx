import { useState, useMemo } from 'react';
import { ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { db, appId } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Team, Game, Pool } from '@/hooks/use-tournament-data';

interface ScoreSubmissionProps {
  games: Game[];
  teams: Team[];
  pools: Pool[];
  tournamentId: string;
}

export const ScoreSubmission = ({ games, teams, pools, tournamentId }: ScoreSubmissionProps) => {
  const [selectedPoolId, setSelectedPoolId] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [homeInnings, setHomeInnings] = useState('');
  const [awayInnings, setAwayInnings] = useState('');
  const [forfeitStatus, setForfeitStatus] = useState('none');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  const scheduledGames = useMemo(() => games.filter(g => g.status === 'scheduled'), [games]);
  const gamesInPool = useMemo(() => scheduledGames.filter(g => g.poolId === selectedPoolId), [scheduledGames, selectedPoolId]);
  const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || 'Unknown';
  const selectedGame = useMemo(() => games.find(g => g.id === selectedGameId), [games, selectedGameId]);

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
      setMessage({ type: 'error', text: 'Please fill out all fields.' });
      return;
    }

    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      const gameRef = doc(db, `/artifacts/${appId}/public/data/tournaments/${tournamentId}/games`, selectedGameId);
      await updateDoc(gameRef, {
        homeScore: Number(homeScore),
        awayScore: Number(awayScore),
        homeInningsBatted: Number(homeInnings),
        awayInningsBatted: Number(awayInnings),
        status: 'completed',
        forfeitStatus
      });

      setMessage({ type: 'success', text: 'Score submitted successfully!' });
      resetForm();
    } catch (error) {
      console.error("Error submitting score:", error);
      setMessage({ type: 'error', text: 'An error occurred while submitting the score.' });
    } finally {
      setSubmitting(false);
    }
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
            disabled={submitting || !selectedGameId} 
            className="w-full bg-[var(--falcons-green)] text-white hover:bg-[var(--falcons-dark-green)]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Final Score'
            )}
          </Button>
        </form>

        {message.text && (
          <Alert className={`mt-4 ${message.type === 'success' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
            <AlertDescription className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
