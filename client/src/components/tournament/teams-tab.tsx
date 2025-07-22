import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Download, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Team, Pool, AgeDivision } from '@shared/schema';

interface TeamsTabProps {
  teams: Team[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
}

export const TeamsTab = ({ teams, pools, ageDivisions }: TeamsTabProps) => {
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<string>('all');

  const getPoolName = (poolId: string) => pools.find(p => p.id === poolId)?.name || 'Unknown Pool';

  const getTeamInitials = (teamName: string) => {
    return teamName.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 3);
  };

  const getTeamColor = (index: number) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-green-500 to-green-600',
      'from-purple-500 to-purple-600',
      'from-orange-500 to-orange-600',
      'from-red-500 to-red-600',
      'from-indigo-500 to-indigo-600',
      'from-pink-500 to-pink-600',
      'from-teal-500 to-teal-600',
    ];
    return colors[index % colors.length];
  };

  // Filter to only show 11U and 13U divisions
  const targetDivisions = useMemo(() => {
    if (!ageDivisions || ageDivisions.length === 0) {
      return [];
    }
    return ageDivisions.filter(div => 
      div.name === '11U' || div.name === '13U'
    );
  }, [ageDivisions]);

  // Filter teams based on selected division
  const filteredTeams = useMemo(() => {
    if (divisionFilter === 'all') {
      return teams;
    }
    return teams.filter(team => team.divisionId === divisionFilter);
  }, [teams, divisionFilter]);

  const handleAddTeam = () => {
    // TODO: Implement add team functionality
    console.log('Add new team');
  };

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
  };

  const handleDeleteTeam = (teamId: string) => {
    // TODO: Implement delete team functionality
    console.log('Delete team:', teamId);
  };

  const handleExportTeams = () => {
    // TODO: Implement export teams functionality
    console.log('Export teams');
  };

  if (teams.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Teams Yet</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first team to the tournament.</p>
          <Button onClick={handleAddTeam} className="bg-[var(--falcons-green)] text-white hover:bg-[var(--falcons-dark-green)]">
            <Plus className="w-4 h-4 mr-2" />
            Add First Team
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">Team Management</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button onClick={handleAddTeam} className="bg-[var(--falcons-green)] text-white hover:bg-[var(--falcons-dark-green)]">
            <Plus className="w-4 h-4 mr-2" />
            Add Team
          </Button>
          <Button onClick={handleExportTeams} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Teams
          </Button>
        </div>
      </div>

      {/* Division Tabs */}
      <Tabs defaultValue="all" value={divisionFilter} onValueChange={setDivisionFilter} className="w-full">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${targetDivisions.length + 1}, minmax(0, 1fr))` }}>
          <TabsTrigger value="all" className="text-sm md:text-base">
            All Divisions
          </TabsTrigger>
          {targetDivisions.map((division) => (
            <TabsTrigger key={division.id} value={division.id} className="text-sm md:text-base">
              {division.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team, index) => (
              <div key={team.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover-lift">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className={`w-12 h-12 bg-gradient-to-br ${getTeamColor(index)} rounded-full flex items-center justify-center mr-3`}>
                  <span className="text-white font-bold text-sm">{getTeamInitials(team.name)}</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{team.name}</h4>
                  <p className="text-sm text-gray-500">{team.city || 'Unknown City'}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleEditTeam(team)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteTeam(team.id)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Pool</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {getPoolName(team.poolId)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Coach</span>
                <span className="text-sm text-gray-900">{team.coach || 'Not specified'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Contact</span>
                <span className="text-sm text-gray-900">{team.phone || 'Not specified'}</span>
              </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {targetDivisions.map((division) => (
          <TabsContent key={division.id} value={division.id} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTeams.map((team, index) => (
                <div key={team.id} className="bg-white rounded-xl shadow-lg p-6 border border-gray-200 hover-lift">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getTeamColor(index)} rounded-full flex items-center justify-center mr-3`}>
                        <span className="text-white font-bold text-sm">{getTeamInitials(team.name)}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{team.name}</h4>
                        <p className="text-sm text-gray-500">{team.city || 'Unknown City'}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleEditTeam(team)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteTeam(team.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Pool</span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                        {getPoolName(team.poolId)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Coach</span>
                      <span className="text-sm text-gray-900">{team.coach || 'Not specified'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">Contact</span>
                      <span className="text-sm text-gray-900">{team.phone || 'Not specified'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
