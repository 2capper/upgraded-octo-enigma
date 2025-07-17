import { Calendar, Users, Trophy, BarChart3 } from 'lucide-react';
import { Tournament, Team, Game, Pool, AgeDivision } from '@shared/schema';

interface TournamentCardsProps {
  tournaments: Tournament[];
  teams: Team[];
  games: Game[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
}

export const TournamentCards = ({ tournaments, teams, games, pools, ageDivisions }: TournamentCardsProps) => {
  const activeTournament = tournaments.find(t => t.id === 'aug-classic');
  const upcomingTournament = tournaments.find(t => t.id === 'provincials');
  
  const completedGames = games.filter(g => g.status === 'completed').length;
  const totalGames = games.length;
  const progressPercentage = totalGames > 0 ? (completedGames / totalGames) * 100 : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      {/* Active Tournament Card */}
      {activeTournament && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">{activeTournament.name}</h3>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Active</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{activeTournament.date}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Users className="w-4 h-4 mr-2" />
              <span>{teams.length} Teams</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{totalGames} Games</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Trophy className="w-4 h-4 mr-2" />
              <span>{pools.length} Pools</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Progress</span>
              <span className="text-sm font-medium text-gray-900">{completedGames}/{totalGames} Games</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-[var(--falcons-green)] h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Tournament Card */}
      {upcomingTournament && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover-lift">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">{upcomingTournament.name}</h3>
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Upcoming</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>{upcomingTournament.date}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Users className="w-4 h-4 mr-2" />
              <span>8 Teams</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Calendar className="w-4 h-4 mr-2" />
              <span>16 Games</span>
            </div>
            <div className="flex items-center text-gray-600">
              <Trophy className="w-4 h-4 mr-2" />
              <span>2 Pools</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <button className="w-full bg-[var(--falcons-green)] text-white py-2 px-4 rounded-lg hover:bg-[var(--falcons-dark-green)] transition-colors">
              Manage Tournament
            </button>
          </div>
        </div>
      )}

      {/* Quick Stats Card */}
      <div className="bg-gradient-to-br from-[var(--falcons-green)] to-[var(--falcons-dark-green)] rounded-xl shadow-lg p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Quick Stats</h3>
          <BarChart3 className="w-8 h-8 opacity-75" />
        </div>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-green-200">Total Teams</span>
            <span className="text-2xl font-bold">{teams.length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-green-200">Games Today</span>
            <span className="text-2xl font-bold">{games.filter(g => g.date === new Date().toISOString().split('T')[0]).length}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-green-200">Completed</span>
            <span className="text-2xl font-bold">{completedGames}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
