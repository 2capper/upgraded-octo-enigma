import { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Download, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Team, Pool, AgeDivision } from '@shared/schema';

interface TeamsTabProps {
  teams: Team[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
}

export const TeamsTab = ({ teams, pools, ageDivisions }: TeamsTabProps) => {
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    coach: '',
    phone: '',
    rosterLink: '',
    pitchCountAppName: '',
    pitchCountName: '',
    gameChangerName: ''
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getPoolName = (poolId: string) => pools.find(p => p.id === poolId)?.name || 'Unknown Pool';

  // Get division for a team based on its pool
  const getTeamDivision = (team: Team) => {
    const pool = pools.find(p => p.id === team.poolId);
    if (!pool) return null;
    return ageDivisions.find(d => d.id === pool.ageDivisionId);
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
    return teams.filter(team => {
      const division = getTeamDivision(team);
      return division?.id === divisionFilter;
    });
  }, [teams, divisionFilter, pools, ageDivisions]);

  const handleAddTeam = () => {
    // TODO: Implement add team functionality
    console.log('Add new team');
  };

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Team> }) => {
      await apiRequest('PUT', `/api/teams/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      toast({
        title: "Success",
        description: "Team updated successfully",
      });
      setEditingTeam(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update team",
        variant: "destructive",
      });
    },
  });

  const handleEditTeam = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
      city: team.city || '',
      coach: team.coach || '',
      phone: team.phone || '',
      rosterLink: team.rosterLink || '',
      pitchCountAppName: team.pitchCountAppName || '',
      pitchCountName: team.pitchCountName || '',
      gameChangerName: team.gameChangerName || ''
    });
  };

  const handleSaveTeam = () => {
    if (!editingTeam) return;
    
    updateTeamMutation.mutate({
      id: editingTeam.id,
      data: formData
    });
  };

  const handleDeleteTeam = (teamId: string) => {
    // TODO: Implement delete team functionality
    console.log('Delete team:', teamId);
  };

  const handleExportTeams = () => {
    // TODO: Implement export teams functionality
    console.log('Export teams');
  };

  const generateRosterLink = (teamName: string) => {
    // Generate the roster link for playoba.ca/stats
    const formattedTeamName = teamName.toLowerCase().replace(/\s+/g, '-');
    return `https://playoba.ca/stats/${formattedTeamName}`;
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

  const renderTeamsTable = (teamsToRender: Team[]) => (
    <div className="bg-white rounded-lg shadow-sm border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">Team Name</TableHead>
            <TableHead>City</TableHead>
            <TableHead>Pool</TableHead>
            <TableHead>Coach</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Roster</TableHead>
            <TableHead>Pitch Count App</TableHead>
            <TableHead>Pitch Count Name</TableHead>
            <TableHead>Game Changer</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teamsToRender.map((team) => (
            <TableRow key={team.id}>
              <TableCell className="font-medium">{team.name}</TableCell>
              <TableCell>{team.city || 'Not specified'}</TableCell>
              <TableCell>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                  {getPoolName(team.poolId)}
                </span>
              </TableCell>
              <TableCell>{team.coach || 'Not specified'}</TableCell>
              <TableCell>{team.phone || 'Not specified'}</TableCell>
              <TableCell>
                {team.rosterLink ? (
                  <a 
                    href={team.rosterLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[var(--falcons-green)] hover:text-[var(--falcons-dark-green)] inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <a 
                    href={generateRosterLink(team.name)} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[var(--falcons-green)] hover:text-[var(--falcons-dark-green)] inline-flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </TableCell>
              <TableCell>{team.pitchCountAppName || 'Not specified'}</TableCell>
              <TableCell>{team.pitchCountName || 'Not specified'}</TableCell>
              <TableCell>{team.gameChangerName || 'Not specified'}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end space-x-2">
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
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

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
          {renderTeamsTable(filteredTeams)}
        </TabsContent>

        {targetDivisions.map((division) => (
          <TabsContent key={division.id} value={division.id} className="mt-6">
            {renderTeamsTable(filteredTeams)}
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Team Dialog */}
      <Dialog open={!!editingTeam} onOpenChange={(open) => !open && setEditingTeam(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>
              Update the team information below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Team Name
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="city" className="text-right">
                City
              </Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="coach" className="text-right">
                Coach
              </Label>
              <Input
                id="coach"
                value={formData.coach}
                onChange={(e) => setFormData({ ...formData, coach: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="phone" className="text-right">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="rosterLink" className="text-right">
                Roster Link
              </Label>
              <Input
                id="rosterLink"
                value={formData.rosterLink}
                onChange={(e) => setFormData({ ...formData, rosterLink: e.target.value })}
                className="col-span-3"
                placeholder="https://playoba.ca/stats/team-name"
              />
            </div>
            
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="pitchCountName" className="text-right">
                Pitch Count Name
              </Label>
              <Input
                id="pitchCountName"
                value={formData.pitchCountName}
                onChange={(e) => setFormData({ ...formData, pitchCountName: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="gameChangerName" className="text-right">
                Game Changer
              </Label>
              <Input
                id="gameChangerName"
                value={formData.gameChangerName}
                onChange={(e) => setFormData({ ...formData, gameChangerName: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTeam(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTeam} 
              className="bg-[var(--falcons-green)] text-[#262626] hover:bg-[var(--falcons-dark-green)]"
              disabled={updateTeamMutation.isPending}
            >
              {updateTeamMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};