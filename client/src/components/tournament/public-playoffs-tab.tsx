import { useMemo, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Trophy, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react';
import type { Tournament, Diamond, AgeDivision, Game, Team, Pool } from '@shared/schema';
import { CrossPoolBracketView } from './cross-pool-bracket-view';
import { PlayoffBracketPreview } from './playoff-bracket-preview';
import { getTeamSourceLabel } from '@shared/seedLabels';
import { calculateStats, resolveTie } from '@shared/standings';
import { format } from 'date-fns';

interface PublicPlayoffsTabProps {
  tournamentId: string;
  tournament: Tournament;
  ageDivisions: AgeDivision[];
  teams: Team[];
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export function PublicPlayoffsTab({ 
  tournamentId, 
  tournament, 
  ageDivisions, 
  teams,
  primaryColor,
  secondaryColor
}: PublicPlayoffsTabProps) {
  const { data: games = [] } = useQuery<Game[]>({
    queryKey: [`/api/tournaments/${tournamentId}/games`],
  });

  const { data: allPools = [] } = useQuery<Pool[]>({
    queryKey: [`/api/tournaments/${tournamentId}/pools`],
  });

  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: [`/api/tournaments/${tournamentId}/diamonds`],
  });

  const brandStyle = {
    "--brand-primary": primaryColor || "#1a4d2e", 
    "--brand-secondary": secondaryColor || "#ffffff",
    "--brand-light": primaryColor ? `color-mix(in srgb, ${primaryColor} 10%, white)` : "#f0fdf4",
    "--brand-muted": primaryColor ? `color-mix(in srgb, ${primaryColor} 50%, white)` : "#86efac",
  } as CSSProperties;

  const poolsForStandings = useMemo(() => {
    return allPools.filter(pool => {
      if (!pool.ageDivisionId) return false;
      const nameLower = pool.name.toLowerCase();
      if (nameLower.includes('playoff')) return false;
      if (nameLower.includes('unassigned')) return false;
      if (pool.id.includes('_pool_temp_')) return false;
      return true;
    });
  }, [allPools]);

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

  if (playoffGames.length === 0) {
    return (
      <div className="space-y-6" style={brandStyle}>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Playoff brackets will be available once pool play is complete and brackets are generated.
          </AlertDescription>
        </Alert>
        {poolsForStandings.length > 0 && (
          <PlayoffBracketPreview
            playoffFormat={tournament.playoffFormat || 'top_8'}
            seedingPattern={tournament.seedingPattern || 'straight'}
            pools={poolsForStandings}
            primaryColor={primaryColor || tournament.primaryColor || undefined}
            secondaryColor={secondaryColor || tournament.secondaryColor || undefined}
          />
        )}
      </div>
    );
  }

  const gamesByDivision = ageDivisions.map(division => {
    const divisionPlayoffPools = allPools.filter(p => 
      p.ageDivisionId === division.id && 
      p.name.toLowerCase().includes('playoff')
    );
    const playoffPoolIds = new Set(divisionPlayoffPools.map(p => p.id));
    
    const divisionGames = playoffGames.filter(g => 
      playoffPoolIds.has(g.poolId)
    );
    return { division, games: divisionGames };
  }).filter(({ games }) => games.length > 0);

  return (
    <div className="space-y-8" style={brandStyle}>
      {gamesByDivision.map(({ division, games: divisionGames }) => {
        const divisionPoolIds = new Set(
          poolsForStandings.filter(p => p.ageDivisionId === division.id).map(p => p.id)
        );
        const divisionTeams = teams.filter(t => 
          t.poolId && divisionPoolIds.has(t.poolId)
        );
        const playoffTeamIds = new Set(
          divisionGames.flatMap(g => [g.homeTeamId, g.awayTeamId].filter(Boolean))
        );
        
        const teamPoolMap = new Map(
          divisionTeams.map(t => {
            const pool = poolsForStandings.find(p => p.id === t.poolId);
            return [t.id, pool?.name];
          })
        );
        
        const allDivisionTeamsWithStats = divisionTeams.map(t => {
          const stats = calculateStats(t.id, games);
          const points = (stats.wins * 2) + (stats.ties * 1);
          return {
            id: t.id,
            name: t.name,
            poolName: teamPoolMap.get(t.id),
            poolId: t.poolId,
            wins: stats.wins,
            losses: stats.losses,
            ties: stats.ties,
            points,
            runsFor: stats.runsFor,
            runsAgainst: stats.runsAgainst,
            offensiveInnings: stats.offensiveInnings,
            defensiveInnings: stats.defensiveInnings,
            forfeitLosses: stats.forfeitLosses,
            runsForPerInning: stats.offensiveInnings > 0 ? stats.runsFor / stats.offensiveInnings : 0,
            runsAgainstPerInning: stats.defensiveInnings > 0 ? stats.runsAgainst / stats.defensiveInnings : 0,
          };
        });

        const poolRankings = new Map<string, number>();
        const divisionPools = poolsForStandings.filter(p => p.ageDivisionId === division.id);
        
        divisionPools.forEach(pool => {
          const poolTeams = allDivisionTeamsWithStats.filter(t => t.poolId === pool.id);
          const groups = poolTeams.reduce((acc, team) => {
            const pts = team.points;
            if (!acc[pts]) acc[pts] = [];
            acc[pts].push(team);
            return acc;
          }, {} as Record<number, typeof allDivisionTeamsWithStats>);
          
          const rankedTeams: typeof allDivisionTeamsWithStats = [];
          Object.keys(groups)
            .map(Number)
            .sort((a, b) => b - a)
            .forEach(pts => {
              const tied = groups[pts];
              if (tied.length === 1) {
                rankedTeams.push(tied[0]);
              } else {
                const resolved = resolveTie(tied, games);
                rankedTeams.push(...resolved);
              }
            });
          
          rankedTeams.forEach((team, index) => {
            poolRankings.set(team.id, index + 1);
          });
        });

        const playoffTeams = allDivisionTeamsWithStats
          .filter(t => playoffTeamIds.has(t.id))
          .map(t => ({
            ...t,
            poolRank: poolRankings.get(t.id),
          }));

        const isCrossPool = tournament.seedingPattern === 'cross_pool_4';

        if (isCrossPool) {
          return (
            <div key={division.id}>
              <h3 
                className="text-2xl font-bold mb-4"
                style={{ color: "var(--brand-primary)" }}
              >
                {division.name} Playoffs
              </h3>
              <CrossPoolBracketView
                playoffGames={divisionGames}
                teams={divisionTeams}
                playoffTeams={playoffTeams}
                diamonds={diamonds}
                onGameClick={() => {}}
                primaryColor={primaryColor || tournament.primaryColor || undefined}
                secondaryColor={secondaryColor || tournament.secondaryColor || undefined}
                seedingPattern={tournament.seedingPattern}
                playoffFormat={tournament.playoffFormat}
              />
            </div>
          );
        }

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
            <h3 
              className="text-2xl font-bold"
              style={{ color: "var(--brand-primary)" }}
            >
              {division.name} Playoffs
            </h3>
            
            {rounds.map(round => {
              const roundGames = gamesByRound[round];
              const isFinals = round === totalRounds;
              
              return (
                <Card 
                  key={round} 
                  className="shadow-sm overflow-hidden"
                  style={{ 
                    borderColor: isFinals ? "var(--brand-primary)" : undefined,
                    borderWidth: isFinals ? "2px" : undefined 
                  }}
                >
                  <CardHeader 
                    className="py-3 px-4 border-b"
                    style={{ 
                      backgroundColor: "var(--brand-light)",
                      borderBottomColor: "var(--brand-muted)"
                    }}
                  >
                    <CardTitle 
                      className="flex items-center gap-2 text-lg"
                      style={{ color: "var(--brand-primary)" }}
                    >
                      <Trophy 
                        className="w-5 h-5" 
                        style={{ color: "var(--brand-primary)" }}
                      />
                      {getRoundName(round)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {roundGames.map(game => {
                        const homeTeam = divisionTeams.find(t => t.id === game.homeTeamId);
                        const awayTeam = divisionTeams.find(t => t.id === game.awayTeamId);
                        const diamond = diamonds.find(d => d.id === game.diamondId);
                        const isCompleted = game.homeScore !== null && game.awayScore !== null;
                        const homeWins = isCompleted && (game.homeScore ?? 0) > (game.awayScore ?? 0);
                        const awayWins = isCompleted && (game.awayScore ?? 0) > (game.homeScore ?? 0);

                        return (
                          <div 
                            key={game.id} 
                            className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                            style={{ borderColor: "var(--brand-muted)" }}
                            data-testid={`playoff-game-${game.id}`}
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Calendar className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
                                  {game.date ? format(new Date(game.date), 'MMM d, yyyy') : 'TBD'}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                  <Clock className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
                                  {game.time || 'TBD'}
                                </div>
                                {(game.subVenue || game.location || diamond) && (
                                  <div className="flex items-start gap-2 text-sm text-gray-600">
                                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--brand-primary)" }} />
                                    <span>
                                      {game.subVenue && <span className="font-semibold">{game.subVenue}</span>}
                                      {!game.subVenue && diamond && (
                                        <span className="font-semibold">{diamond.name}</span>
                                      )}
                                      {(game.subVenue || diamond) && game.location && <span> - </span>}
                                      {game.location}
                                    </span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="md:col-span-2 space-y-2">
                                <div 
                                  className="flex justify-between items-center p-2 rounded"
                                  style={{ 
                                    backgroundColor: homeWins ? "var(--brand-light)" : "#f9fafb",
                                    borderLeft: homeWins ? "3px solid var(--brand-primary)" : undefined
                                  }}
                                >
                                  <span className="font-semibold">
                                    {!game.homeTeamId && game.team1Source 
                                      ? getTeamSourceLabel(game.team1Source, tournament.seedingPattern, tournament.playoffFormat)
                                      : homeTeam?.name || 'TBD'}
                                  </span>
                                  <span 
                                    className="text-lg font-bold"
                                    style={{ color: homeWins ? "var(--brand-primary)" : undefined }}
                                  >
                                    {game.homeScore ?? '-'}
                                  </span>
                                </div>
                                <div 
                                  className="flex justify-between items-center p-2 rounded"
                                  style={{ 
                                    backgroundColor: awayWins ? "var(--brand-light)" : "#f9fafb",
                                    borderLeft: awayWins ? "3px solid var(--brand-primary)" : undefined
                                  }}
                                >
                                  <span className="font-semibold">
                                    {!game.awayTeamId && game.team2Source
                                      ? getTeamSourceLabel(game.team2Source, tournament.seedingPattern, tournament.playoffFormat)
                                      : awayTeam?.name || 'TBD'}
                                  </span>
                                  <span 
                                    className="text-lg font-bold"
                                    style={{ color: awayWins ? "var(--brand-primary)" : undefined }}
                                  >
                                    {game.awayScore ?? '-'}
                                  </span>
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
