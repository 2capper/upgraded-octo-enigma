import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, CheckCircle, Users, ExternalLink, Edit, Ghost, AlertTriangle, Trash2, Zap, Clock, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { TeamManagementDialog } from './team-management-dialog';
import type { Team, Game, Pool, AgeDivision } from '@shared/schema';

interface TeamsTabProps {
  teams: Team[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
  games?: Game[];
  tournamentId?: string;
}

interface RosterImportProps {
  team: Team;
  onSuccess: () => void;
}

function RosterImport({ team, onSuccess }: RosterImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [matchedTeams, setMatchedTeams] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const searchMatchingTeams = async () => {
    if (!team.name) return;
    
    setIsSearching(true);
    try {
      const divisionMatch = team.division?.match(/(\d+U)/);
      const division = divisionMatch ? divisionMatch[1] : '';
      
      const response = await fetch(`/api/roster/teams/search?query=${encodeURIComponent(team.name)}&division=${division}`);
      
      const data = await response.json();
      if (data.success && data.teams) {
        setMatchedTeams(data.teams.map((t: any) => ({
          team_id: t.id,
          team_name: t.name,
          division: t.ageGroup,
          affiliate: t.affiliate,
          confidence: t.confidence
        })));
      } else {
        setMatchedTeams([]);
        toast({
          title: "Automatic Import Not Available",
          description: data.error || "OBA website protections prevent automatic roster discovery.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error searching teams:', error);
      setMatchedTeams([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async () => {
    if (!selectedTeam) {
      toast({
        title: "Selection Required",
        description: "Please select an OBA team to import roster from",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    
    try {
      const response = await fetch(`/api/roster/teams/${selectedTeam}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentTeamId: team.id })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Roster Imported Successfully",
          description: `Imported ${data.playerCount} authentic players from OBA`,
        });
        setIsOpen(false);
        onSuccess();
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (error) {
      toast({
        title: "Import Failed", 
        description: error instanceof Error ? error.message : "Failed to import roster",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (open && matchedTeams.length === 0) searchMatchingTeams();
    }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Import Roster
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Authentic OBA Roster</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Tournament Team: <span className="font-medium">{team.name}</span>
            </p>
          </div>

          <Select value={selectedTeam} onValueChange={setSelectedTeam} disabled={isSearching}>
            <SelectTrigger>
              <SelectValue placeholder={isSearching ? "Searching..." : "Select OBA team..."} />
            </SelectTrigger>
            <SelectContent>
              {matchedTeams.length === 0 ? (
                <SelectItem value="no-teams" disabled>
                  No automatic roster discovery available
                </SelectItem>
              ) : (
                matchedTeams.map((obaTeam: any) => (
                  <SelectItem key={obaTeam.team_id} value={obaTeam.team_id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{obaTeam.team_name}</span>
                      <span className="text-xs text-gray-500">
                        {obaTeam.affiliate} • {obaTeam.division} • {obaTeam.confidence}% match
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {matchedTeams.length === 0 && (
            <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Manual Import Required</span>
              </div>
              <p className="text-xs text-amber-700">
                Visit playoba.ca manually to get roster data.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedTeam || isImporting || matchedTeams.length === 0}
              className="flex-1"
            >
              {isImporting ? "Importing..." : "Import Roster"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ImpactAnalysis {
  teamId: string;
  affectedGames: Game[];
  opponentTeams: Team[];
}

function ImpactAnalysisDialog({ 
  team, 
  games, 
  allTeams,
  onConfirmDelete 
}: { 
  team: Team; 
  games: Game[]; 
  allTeams: Team[];
  onConfirmDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const affectedGames = games.filter(g => 
    g.homeTeamId === team.id || g.awayTeamId === team.id
  );
  
  const affectedOpponents = useMemo(() => {
    const opponentIds = new Set<string>();
    affectedGames.forEach(g => {
      if (g.homeTeamId === team.id && g.awayTeamId) opponentIds.add(g.awayTeamId);
      if (g.awayTeamId === team.id && g.homeTeamId) opponentIds.add(g.homeTeamId);
    });
    return allTeams.filter(t => opponentIds.has(t.id));
  }, [affectedGames, team.id, allTeams]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          size="sm" 
          variant="ghost" 
          className="text-red-600 hover:text-red-700 hover:bg-red-50"
          data-testid={`button-delete-team-${team.id}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Impact Analysis: Remove {team.name}
          </DialogTitle>
          <DialogDescription>
            Review the impact before removing this team from the tournament.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {affectedGames.length > 0 ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-red-600" />
                  <span className="font-medium text-red-800">
                    {affectedGames.length} Game{affectedGames.length > 1 ? 's' : ''} Will Be Affected
                  </span>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {affectedGames.map((game) => {
                    const opponent = game.homeTeamId === team.id 
                      ? allTeams.find(t => t.id === game.awayTeamId)
                      : allTeams.find(t => t.id === game.homeTeamId);
                    
                    return (
                      <div key={game.id} className="flex items-center justify-between text-sm bg-white p-2 rounded border border-red-100">
                        <span>{formatDate(game.date)} at {game.time || 'TBD'}</span>
                        <span className="text-gray-600">vs {opponent?.name || 'TBD'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-800">
                    {affectedOpponents.length} Team{affectedOpponents.length > 1 ? 's' : ''} Will Need Notifications
                  </span>
                </div>
                <p className="text-xs text-amber-700">
                  These teams have scheduled games with {team.name} and should be notified of the change.
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {affectedOpponents.map(t => (
                    <Badge key={t.id} variant="secondary" className="text-xs">
                      {t.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="font-medium text-green-800">No Scheduled Games</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                This team can be safely removed without affecting any games.
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setIsOpen(false)}
            data-testid={`button-cancel-delete-${team.id}`}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={() => {
              onConfirmDelete();
              setIsOpen(false);
            }}
            data-testid={`button-confirm-delete-${team.id}`}
          >
            {affectedGames.length > 0 ? 'Remove & Create Ghost' : 'Remove Team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TeamsTab({ teams, pools, ageDivisions, games = [], tournamentId }: TeamsTabProps) {
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const filteredTeams = useMemo(() => {
    let filtered = teams;
    
    if (divisionFilter !== 'all') {
      const divisionPools = pools.filter(p => p.ageDivisionId === divisionFilter);
      filtered = filtered.filter(t => divisionPools.some(p => p.id === t.poolId));
    }
    
    return filtered.filter(t => !t.isPlaceholder);
  }, [teams, pools, divisionFilter]);

  const ghostTeams = useMemo(() => {
    return teams.filter(t => t.isPlaceholder);
  }, [teams]);

  const teamsWillingToPlayExtra = useMemo(() => {
    return teams.filter(t => t.willingToPlayExtra && !t.isPlaceholder);
  }, [teams]);

  const handleRosterImportSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
  };

  const deleteMutation = useMutation({
    mutationFn: async (teamId: string) => {
      return apiRequest('DELETE', `/api/teams/${teamId}`, {});
    },
    onSuccess: () => {
      toast({
        title: "Team Removed",
        description: "The team has been removed from the tournament.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Remove",
        description: error instanceof Error ? error.message : "Failed to remove team",
        variant: "destructive",
      });
    },
  });

  const formatPhoneDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7)}`;
    } else if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6)}`;
    }
    return phone;
  };

  const getRosterStatus = (team: Team) => {
    if (team.rosterData) {
      try {
        const players = JSON.parse(team.rosterData);
        return `${players.length} players`;
      } catch {
        return "Invalid data";
      }
    }
    if (team.rosterLink) return "Link available";
    return "No roster";
  };

  const getPoolName = (poolId: string | null) => {
    if (!poolId) return 'Unassigned';
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return 'Unknown';
    const division = ageDivisions.find(d => d.id === pool.ageDivisionId);
    return `${division?.name || ''} - ${pool.name}`;
  };

  const getTeamGameCount = (teamId: string) => {
    return games.filter(g => g.homeTeamId === teamId || g.awayTeamId === teamId).length;
  };

  return (
    <div className="space-y-6">
      {ghostTeams.length > 0 && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-purple-800 text-base">
              <Ghost className="w-5 h-5" />
              Ghost Protocol Active
              <Badge variant="secondary" className="ml-auto bg-purple-100 text-purple-800">
                {ghostTeams.length} Ghost{ghostTeams.length > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-purple-700 mb-3">
              These placeholder teams preserve game slots and standings when a team is removed.
            </p>
            <div className="flex flex-wrap gap-2">
              {ghostTeams.map(ghost => (
                <Badge key={ghost.id} variant="outline" className="border-purple-300 text-purple-700">
                  {ghost.name}
                  <span className="ml-1 text-xs text-purple-500">
                    ({getTeamGameCount(ghost.id)} games)
                  </span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {teamsWillingToPlayExtra.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-amber-800 text-base">
              <Zap className="w-5 h-5" />
              Plug & Play Ready
              <Badge variant="secondary" className="ml-auto bg-amber-100 text-amber-800">
                {teamsWillingToPlayExtra.length} Team{teamsWillingToPlayExtra.length > 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-3">
              These teams are willing to play extra games if open slots need filling.
            </p>
            <div className="flex flex-wrap gap-2">
              {teamsWillingToPlayExtra.map(team => (
                <Badge key={team.id} variant="outline" className="border-amber-300 text-amber-700">
                  {team.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Teams ({filteredTeams.length})</h3>
        
        <div className="flex items-center gap-2">
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-48" data-testid="select-division-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {ageDivisions.map((division) => (
                <SelectItem key={division.id} value={division.id}>
                  {division.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>Pool</TableHead>
              <TableHead>Coach</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Games</TableHead>
              <TableHead>Roster</TableHead>
              <TableHead className="text-center">Flags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.map((team) => (
              <TableRow key={team.id} data-testid={`team-row-${team.id}`}>
                <TableCell className="font-medium" data-testid={`team-name-${team.id}`}>
                  <div className="flex items-center gap-2">
                    {team.name}
                    {team.isPlaceholder && (
                      <Ghost className="w-4 h-4 text-purple-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getPoolName(team.poolId)}</Badge>
                </TableCell>
                <TableCell data-testid={`coach-name-${team.id}`}>
                  {team.coachFirstName || team.coachLastName ? (
                    <span className="text-sm">{team.coachFirstName} {team.coachLastName}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </TableCell>
                <TableCell data-testid={`coach-phone-${team.id}`}>
                  {team.coachPhone || team.phone ? (
                    <span className="text-sm">{formatPhoneDisplay(team.coachPhone || team.phone)}</span>
                  ) : (
                    <span className="text-gray-400 text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{getTeamGameCount(team.id)}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{getRosterStatus(team)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {team.willingToPlayExtra && (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-xs" title="Willing to play extra games">
                        <Zap className="w-3 h-3" />
                      </Badge>
                    )}
                    {team.schedulingRequests && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs" title={team.schedulingRequests}>
                        <Clock className="w-3 h-3" />
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => setEditingTeam(team)}
                      data-testid={`button-edit-team-${team.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <ImpactAnalysisDialog 
                      team={team}
                      games={games}
                      allTeams={teams}
                      onConfirmDelete={() => deleteMutation.mutate(team.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredTeams.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No teams found for the selected division.
        </div>
      )}

      {tournamentId && (
        <TeamManagementDialog
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          team={editingTeam}
          tournamentId={tournamentId}
          pools={pools}
          ageDivisions={ageDivisions}
          games={games}
          allTeams={teams}
        />
      )}
    </div>
  );
}
