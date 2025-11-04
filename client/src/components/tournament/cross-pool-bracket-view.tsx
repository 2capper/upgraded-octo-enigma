import { useMemo } from 'react';
import { Trophy, Medal, ChevronDown, ArrowRight } from 'lucide-react';
import { Game, Team } from '@shared/schema';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface CrossPoolBracketViewProps {
  playoffGames: Game[];
  teams: Team[];
  playoffTeams: Array<{
    id: string;
    name: string;
    poolName?: string;
    poolRank?: number;
    wins: number;
    losses: number;
    ties: number;
    points: number;
    runsFor: number;
    runsAgainst: number;
  }>;
  onGameClick: (game: Game) => void;
  primaryColor?: string;
  secondaryColor?: string;
}

interface PoolStandings {
  [poolName: string]: Array<{
    id: string;
    name: string;
    poolName?: string;
    poolRank?: number;
    wins: number;
    losses: number;
    ties: number;
    points: number;
    runsFor: number;
    runsAgainst: number;
  }>;
}

export function CrossPoolBracketView({
  playoffGames,
  teams,
  playoffTeams,
  onGameClick,
  primaryColor = '#1f2937',
  secondaryColor = '#ca8a04',
}: CrossPoolBracketViewProps) {
  // Group playoff teams by pool
  const poolStandings = useMemo<PoolStandings>(() => {
    const standings: PoolStandings = {};
    playoffTeams.forEach(team => {
      if (team.poolName) {
        if (!standings[team.poolName]) {
          standings[team.poolName] = [];
        }
        standings[team.poolName].push(team);
      }
    });
    
    // Sort each pool by poolRank
    Object.keys(standings).forEach(poolName => {
      standings[poolName].sort((a, b) => (a.poolRank || 0) - (b.poolRank || 0));
    });
    
    return standings;
  }, [playoffTeams]);

  // Group games by round
  const gamesByRound = useMemo(() => {
    const grouped: Record<number, Game[]> = {};
    playoffGames.forEach(game => {
      const round = game.playoffRound || 1;
      if (!grouped[round]) {
        grouped[round] = [];
      }
      grouped[round].push(game);
    });
    
    // Sort games within each round by game number
    Object.keys(grouped).forEach(round => {
      grouped[Number(round)].sort((a, b) => 
        (a.playoffGameNumber || 0) - (b.playoffGameNumber || 0)
      );
    });
    
    return grouped;
  }, [playoffGames]);

  const rounds = Object.keys(gamesByRound).map(Number).sort((a, b) => a - b);
  const totalRounds = rounds.length;

  // Get round name
  const getRoundName = (round: number) => {
    if (round === totalRounds) return 'Finals';
    if (round === totalRounds - 1) return 'Semifinals';
    if (round === totalRounds - 2) return 'Quarterfinals';
    return `Round ${round}`;
  };

  // Get team label with pool info
  const getTeamLabel = (teamId: string | null | undefined) => {
    if (!teamId) return 'TBD';
    const team = teams.find(t => t.id === teamId);
    if (!team) return 'TBD';
    
    const playoffTeam = playoffTeams.find(t => t.id === teamId);
    if (playoffTeam?.poolName && playoffTeam?.poolRank) {
      return `${playoffTeam.poolName}${playoffTeam.poolRank} - ${team.name}`;
    }
    
    return team.name;
  };

  // Get winner of a game
  const getWinner = (game: Game): string | null => {
    if (game.status !== 'completed') return null;
    
    const homeScore = Number(game.homeScore) || 0;
    const awayScore = Number(game.awayScore) || 0;
    
    if (game.forfeitStatus === 'home') return game.awayTeamId;
    if (game.forfeitStatus === 'away') return game.homeTeamId;
    
    if (homeScore > awayScore) return game.homeTeamId;
    if (awayScore > homeScore) return game.awayTeamId;
    
    return null; // Tie
  };

  const poolNames = Object.keys(poolStandings).sort();

  // Reusable game card component
  const GameCard = ({ game, isFinals = false }: { game: Game; isFinals?: boolean }) => {
    const isCompleted = game.status === 'completed';
    const homeTeam = teams.find(t => t.id === game.homeTeamId);
    const awayTeam = teams.find(t => t.id === game.awayTeamId);
    const winner = getWinner(game);
    const homeScore = game.homeScore !== null && game.homeScore !== undefined ? game.homeScore : null;
    const awayScore = game.awayScore !== null && game.awayScore !== undefined ? game.awayScore : null;
    
    return (
      <div 
        className={`rounded-lg shadow-lg border-2 cursor-pointer transition-all hover:scale-105 ${isFinals ? 'max-w-md mx-auto' : ''}`}
        style={{
          backgroundColor: isFinals 
            ? secondaryColor
            : 'rgba(0, 0, 0, 0.3)',
          borderColor: isCompleted 
            ? '#22c55e'
            : isFinals 
              ? secondaryColor
              : 'rgba(255, 255, 255, 0.2)'
        }}
        onClick={() => onGameClick(game)}
        data-testid={`bracket-game-${game.playoffGameNumber}`}
      >
        {/* Game Number */}
        <div className="px-4 pt-3 pb-2 border-b border-white/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white/80">
              Game {game.playoffGameNumber}
            </span>
            {isCompleted && (
              <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white font-semibold">
                FINAL
              </span>
            )}
          </div>
        </div>

        {/* Teams */}
        <div className="p-3 space-y-2">
          {/* Home Team */}
          <div 
            className={`flex items-center justify-between p-2 rounded ${
              winner === game.homeTeamId ? 'bg-green-500/30 border border-green-400' : 'bg-white/10'
            }`}
            data-testid={`game-${game.playoffGameNumber}-home`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">
                {getTeamLabel(game.homeTeamId)}
              </div>
            </div>
            <div className="ml-2 text-white font-bold text-lg min-w-[2rem] text-right">
              {homeScore !== null ? homeScore : '-'}
            </div>
          </div>

          {/* Away Team */}
          <div 
            className={`flex items-center justify-between p-2 rounded ${
              winner === game.awayTeamId ? 'bg-green-500/30 border border-green-400' : 'bg-white/10'
            }`}
            data-testid={`game-${game.playoffGameNumber}-away`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">
                {getTeamLabel(game.awayTeamId)}
              </div>
            </div>
            <div className="ml-2 text-white font-bold text-lg min-w-[2rem] text-right">
              {awayScore !== null ? awayScore : '-'}
            </div>
          </div>
        </div>

        {/* Game Info */}
        <div className="px-4 pb-3 pt-2 border-t border-white/20">
          <div className="text-xs text-white/70">
            {game.date} • {game.time} • {game.location}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Pool Standings */}
      <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 border border-gray-200">
        <h4 className="text-lg md:text-xl font-bold text-gray-900 mb-4 md:mb-6">Pool Standings - Top 2 Teams</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {poolNames.map(poolName => (
            <div key={poolName} className="border-2 rounded-lg p-4" style={{ borderColor: primaryColor }}>
              <h5 className="text-base md:text-lg font-bold mb-3 text-center" style={{ color: primaryColor }}>
                Pool {poolName}
              </h5>
              <div className="space-y-2">
                {poolStandings[poolName].slice(0, 2).map((team, index) => (
                  <div
                    key={team.id}
                    className="bg-gray-50 rounded p-3 border border-gray-200"
                    data-testid={`pool-${poolName}-rank-${index + 1}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm" style={{ color: primaryColor }}>
                        {poolName}{index + 1}
                      </span>
                      {index === 0 && <Medal className="w-4 h-4 text-yellow-500" />}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">{team.name}</div>
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{team.wins}-{team.losses}-{team.ties}</span>
                      <span>{team.points} pts</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>RF: {team.runsFor}</span>
                      <span>RA: {team.runsAgainst}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Accordion View */}
      <div className="lg:hidden rounded-xl p-4 md:p-6" style={{ backgroundColor: primaryColor }}>
        <Accordion type="single" collapsible defaultValue={`round-${rounds[0]}`} className="space-y-4">
          {rounds.map(round => {
            const roundGames = gamesByRound[round] || [];
            const roundName = getRoundName(round);
            const isFinals = round === totalRounds;
            
            return (
              <AccordionItem 
                key={round} 
                value={`round-${round}`}
                className="border-2 border-white/20 rounded-lg overflow-hidden"
                data-testid={`accordion-round-${round}`}
              >
                <AccordionTrigger 
                  className="px-4 py-3 hover:no-underline hover:bg-white/5 text-white"
                >
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="text-base md:text-lg font-bold uppercase tracking-wide">
                      {roundName}
                    </span>
                    <span className="text-sm font-normal text-white/70">
                      {roundGames.length} {roundGames.length === 1 ? 'game' : 'games'}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4 pt-2">
                  <div className="space-y-4">
                    {roundGames.map((game) => (
                      <GameCard key={game.id} game={game} isFinals={isFinals} />
                    ))}
                    {round < totalRounds && (
                      <div className="flex items-center justify-center py-2 text-white/60">
                        <span className="text-xs font-semibold uppercase tracking-wide mr-2">
                          Winners advance to {getRoundName(round + 1)}
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Desktop Grid View */}
      <div className="hidden lg:block rounded-xl p-6" style={{ backgroundColor: primaryColor }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {rounds.map(round => {
            const roundGames = gamesByRound[round] || [];
            const roundName = getRoundName(round);
            const isFinals = round === totalRounds;
            
            return (
              <div key={round} className="space-y-6">
                <h4 className="text-lg font-bold text-white text-center uppercase tracking-wider">
                  {roundName}
                </h4>
                
                <div className={`space-y-4 ${isFinals ? 'flex justify-center' : ''}`}>
                  {roundGames.map((game) => (
                    <GameCard key={game.id} game={game} isFinals={isFinals} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
