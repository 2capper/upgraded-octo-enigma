import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trophy, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { Tournament, Game } from '@shared/schema';
import { getPlayoffTeamCount, type PlayoffFormat } from '@shared/playoffFormats';

interface PlayoffBracketGeneratorProps {
  tournamentId: string;
  divisionId?: string;
}

export function PlayoffBracketGenerator({ tournamentId, divisionId }: PlayoffBracketGeneratorProps) {
  const { toast } = useToast();

  const { data: tournament } = useQuery<Tournament>({
    queryKey: [`/api/tournaments/${tournamentId}`],
  });

  const { data: games = [] } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'games'],
  }) as { data: Game[] };

  const generateBracketMutation = useMutation({
    mutationFn: async (divId: string) => {
      const response = await apiRequest(
        'POST',
        `/api/tournaments/${tournamentId}/divisions/${divId}/generate-bracket`
      );
      const data = await response.json();
      return data as { message: string; games: Game[] };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId, 'games'] });
      toast({
        title: 'Playoff Bracket Generated',
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to generate playoff bracket',
        variant: 'destructive',
      });
    },
  });

  const handleGenerateBracket = () => {
    if (!divisionId) {
      toast({
        title: 'No Division Selected',
        description: 'Please select an age division first',
        variant: 'destructive',
      });
      return;
    }
    generateBracketMutation.mutate(divisionId);
  };

  // Check if playoff games already exist
  const playoffGames = games.filter((g: Game) => g.isPlayoff === true);
  const hasPlayoffGames = playoffGames.length > 0;

  if (!tournament) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500">Loading tournament...</p>
        </CardContent>
      </Card>
    );
  }

  if (tournament.type !== 'pool_play') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[var(--splash-navy)]">Playoff Bracket Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This tournament is not a pool play tournament. Playoff bracket generation is only available for pool play tournaments.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!tournament.playoffFormat) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[var(--splash-navy)]">Playoff Bracket Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No playoff format has been configured for this tournament. Please edit the tournament settings to select a playoff format.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[var(--splash-navy)] flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-[var(--forest-green)]" />
          Playoff Bracket Generation
        </CardTitle>
        <CardDescription>
          Generate playoff brackets based on pool play standings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tournament Info */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Tournament Type:</span>
            <span className="text-sm text-foreground capitalize">{tournament.type.replace('_', ' ')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Playoff Format:</span>
            <span className="text-sm text-foreground">{tournament.playoffFormat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Number of Pools:</span>
            <span className="text-sm text-foreground">{tournament.numberOfPools}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Playoff Teams:</span>
            <span className="text-sm text-foreground">
              {getPlayoffTeamCount(tournament.playoffFormat as PlayoffFormat, tournament.numberOfTeams || 0)}
            </span>
          </div>
        </div>

        {/* Playoff Status */}
        {hasPlayoffGames && (
          <Alert>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              {playoffGames.length} playoff games already exist for this tournament. Generating a new bracket will **delete all existing** playoff games and create a new bracket.
            </AlertDescription>
          </Alert>
        )}

        {/* Generate Button */}
        <div className="space-y-4">
          <Button
            onClick={handleGenerateBracket}
            disabled={!divisionId || generateBracketMutation.isPending}
            className="w-full bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
            data-testid="button-generate-bracket"
          >
            <Trophy className="w-4 h-4 mr-2" />
            {generateBracketMutation.isPending ? 'Generating...' : 'Generate Playoff Bracket'}
          </Button>
        </div>

        {/* Instructions */}
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-semibold text-foreground mb-2">How It Works</h4>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Pool play games must be completed to calculate standings</li>
            <li>Teams are seeded based on pool standings and the selected playoff format</li>
            <li>Playoff games are automatically created with matchups based on seeding</li>
            <li>Team names in playoff games will be placeholders until pool play is complete</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
