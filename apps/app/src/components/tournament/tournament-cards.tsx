import { Calendar, Users, Trophy, BarChart3 } from 'lucide-react';
import { Tournament, Team, Game, Pool, AgeDivision } from '@shared/schema';

interface TournamentCardsProps {
  tournaments: Tournament[];
  teams: Team[];
  games: Game[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
}

export const TournamentCards = ({ tournaments = [], teams = [], games = [], pools = [], ageDivisions = [] }: TournamentCardsProps) => {
  const activeTournament = tournaments.find(t => t.id === 'aug-classic');
  const upcomingTournament = tournaments.find(t => t.id === 'provincials');
  
  const completedGames = games.filter(g => g.status === 'completed').length;
  const totalGames = games.length;
  const progressPercentage = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;

  // Calculate age division stats - show all available divisions
  const targetDivisions = ageDivisions;
  
  const ageDivisionStats = targetDivisions.map(division => {
    const divisionPools = pools.filter(p => p.ageDivisionId === division.id);
    const divisionTeams = teams.filter(t => divisionPools.some(p => p.id === t.poolId));
    const divisionGames = games.filter(g => divisionPools.some(p => p.id === g.poolId));
    const completedDivisionGames = divisionGames.filter(g => g.status === 'completed').length;
    
    return {
      division,
      poolCount: divisionPools.length,
      teamCount: divisionTeams.length,
      gameCount: divisionGames.length,
      completedGames: completedDivisionGames,
      progressPercentage: divisionGames.length > 0 ? (completedDivisionGames / divisionGames.length) * 100 : 0
    };
  });

  // Cards removed for simplicity
  return null;
};
