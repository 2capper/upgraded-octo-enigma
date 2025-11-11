import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import type { Tournament, Diamond, AgeDivision, Game, Team, Pool } from '@shared/schema';
import { CrossPoolBracketView } from './cross-pool-bracket-view';
import { PlayoffBracketPreview } from './playoff-bracket-preview';
import { format } from 'date-fns';

interface PublicPlayoffsTabProps {
  tournamentId: string;
  tournament: Tournament;
  ageDivisions: AgeDivision[];
  teams: Team[];
}

export function PublicPlayoffsTab({ tournamentId, tournament, ageDivisions, teams }: PublicPlayoffsTabProps) {
  const { data: games = [] } = useQuery<Game[]>({
    queryKey: [`/api/tournaments/${tournamentId}/games`],
  });

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: [`/api/tournaments/${tournamentId}/pools`],
  });

  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: [`/api/tournaments/${tournamentId}/diamonds`],
  });

  const playoffGames = games.filter(g => g.isPlayoff);

  if (ageDivisions.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No age divisions found for this tournament.
        </AlertDescription>
      </Alert>
    );
  }

  // If no playoff games exist yet, show preview
  if (playoffGames.length === 0) {
    return (
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Playoff brackets will be available once pool play is complete and brackets are generated.
          </AlertDescription>
        </Alert>
        {pools.length > 0 && (
          <PlayoffBracketPreview
            playoffFormat={tournament.playoffFormat || 'top_8'}
            seedingPattern={tournament.seedingPattern || 'straight'}
            pools={pools}
            primaryColor={tournament.primaryColor || undefined}
            secondaryColor={tournament.secondaryColor || undefined}
          />
        )}
      </div>
    );
  }

  // Group playoff games by division
  // Note: Games don't have ageDivisionId, we need to join through pools
  const gamesByDivision = ageDivisions.map(division => {
    const divisionPoolIds = new Set(
      pools.filter(p => p.ageDivisionId === division.id).map(p => p.id)
    );
    const divisionGames = playoffGames.filter(g => 
      divisionPoolIds.has(g.poolId)
    );
    return { division, games: divisionGames };
  }).filter(({ games }) => games.length > 0);

  return (
    <div className="space-y-8">
      {gamesByDivision.map(({ division, games: divisionGames }) => {
        // Calculate playoff teams for this division
        // Teams don't have ageDivisionId, we need to join through pools
        const divisionPoolIds = new Set(
          pools.filter(p => p.ageDivisionId === division.id).map(p => p.id)
        );
        const divisionTeams = teams.filter(t => 
          t.poolId && divisionPoolIds.has(t.poolId)
        );
        const playoffTeamIds = new Set(
          divisionGames.flatMap(g => [g.homeTeamId, g.awayTeamId].filter(Boolean))
        );
        // Find pool info for each team to get poolName
        const teamPoolMap = new Map(
          divisionTeams.map(t => {
            const pool = pools.find(p => p.id === t.poolId);
            return [t.id, pool?.name];
          })
        );
        
        const playoffTeams = divisionTeams
          .filter(t => playoffTeamIds.has(t.id))
          .map(t => ({
            id: t.id,
            name: t.name,
            poolName: teamPoolMap.get(t.id),
            poolRank: undefined, // Not stored on teams table
            wins: 0,
            losses: 0,
            ties: 0,
            points: 0,
            runsFor: 0,
            runsAgainst: 0,
          }));

        // Check if this is a cross-pool bracket
        const isCrossPool = tournament.seedingPattern === 'cross_pool_4';

        if (isCrossPool) {
          return (
            <div key={division.id}>
              <h3 className="text-2xl font-bold mb-4">{division.name} Playoffs</h3>
              <CrossPoolBracketView
                playoffGames={divisionGames}
                teams={divisionTeams}
                playoffTeams={playoffTeams}
                onGameClick={() => {}} // No-op for public view
                primaryColor={tournament.primaryColor || undefined}
                secondaryColor={tournament.secondaryColor || undefined}
              />
            </div>
          );
        }

        // Standard bracket view - show games grouped by round
        const gamesByRound: Record<number, Game[]> = {};
        divisionGames.forEach(game => {
          const round = game.playoffRound || 1;
          if (!gamesByRound[round]) {
            gamesByRound[round] = [];
          }
          gamesByRound[round].push(game);
        });

        const rounds = Object.keys(gamesByRound).map(Number).sort((a, b) => a - b);
        const totalRounds = rounds.length;

        const getRoundName = (round: number) => {
          if (round === totalRounds) return 'Finals';
          if (round === totalRounds - 1) return 'Semifinals';
          if (round === totalRounds - 2) return 'Quarterfinals';
          return `Round ${round}`;
        };

        return (
          <div key={division.id} className="space-y-6">
            <h3 className="text-2xl font-bold">{division.name} Playoffs</h3>
            
            {rounds.map(round => {
              const roundGames = gamesByRound[round];
              return (
                <Card key={round}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      {getRoundName(round)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {roundGames.map(game => {
                        const homeTeam = divisionTeams.find(t => t.id === game.homeTeamId);
                        const awayTeam = divisionTeams.find(t => t.id === game.awayTeamId);
                        const diamond = diamonds.find(d => d.id === game.diamondId);

                        return (
                          <div
                            key={game.id}
                            className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-800"
                            data-testid={`playoff-game-${game.id}`}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <Calendar className="w-4 h-4" />
                                  {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'TBD'}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                  <Clock className="w-4 h-4" />
                                  {game.time || 'TBD'}
                                </div>
                                {diamond && (
                                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                                    <MapPin className="w-4 h-4" />
                                    {diamond.name}
                                  </div>
                                )}
                              </div>
                              
                              <div className="md:col-span-2 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold">{homeTeam?.name || 'TBD'}</span>
                                  <span className="text-lg font-bold">{game.homeScore ?? '-'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold">{awayTeam?.name || 'TBD'}</span>
                                  <span className="text-lg font-bold">{game.awayScore ?? '-'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
