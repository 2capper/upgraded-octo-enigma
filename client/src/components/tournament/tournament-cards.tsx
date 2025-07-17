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

  // Calculate age division stats
  const ageDivisionStats = ageDivisions.map(division => {
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

  return (
    <div className="space-y-6 mb-8">
      {/* Tournament Overview */}
      {activeTournament && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-900">{activeTournament.name}</h3>
            <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">Active</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{ageDivisions.length}</div>
              <div className="text-sm text-gray-500">Age Divisions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{pools.length}</div>
              <div className="text-sm text-gray-500">Total Pools</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{teams.length}</div>
              <div className="text-sm text-gray-500">Total Teams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{completedGames}/{totalGames}</div>
              <div className="text-sm text-gray-500">Games Complete</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-500">Overall Progress</span>
              <span className="text-sm font-medium text-gray-900">{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-[var(--falcons-green)] h-2 rounded-full transition-all duration-300" 
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Age Division Cards */}
      {ageDivisionStats.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Age Divisions</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ageDivisionStats.map(({ division, poolCount, teamCount, gameCount, completedGames, progressPercentage }) => (
              <div key={division.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-lg font-semibold text-gray-900">{division.name}</h5>
                  <Trophy className="w-5 h-5 text-[var(--falcons-green)]" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Pools:</span>
                    <span className="font-medium text-gray-900">{poolCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Teams:</span>
                    <span className="font-medium text-gray-900">{teamCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Games:</span>
                    <span className="font-medium text-gray-900">{completedGames}/{gameCount}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">Progress</span>
                    <span className="text-xs font-medium text-gray-900">{Math.round(progressPercentage)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-[var(--falcons-green)] h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
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
