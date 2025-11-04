import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, CheckCircle, Users, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Team {
  id: string;
  name: string;
  division: string;
  rosterLink?: string | null;
  teamNumber?: string | null;
  rosterData?: string | null;
  pitchCountAppName?: string | null;
  pitchCountName?: string | null;
  gameChangerName?: string | null;
}

interface TeamsTabProps {
  teams: Team[];
  pools: any[];
  ageDivisions: any[];
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

  // Load matching teams when dialog opens
  React.useEffect(() => {
    if (isOpen && matchedTeams.length === 0) {
      searchMatchingTeams();
    }
  }, [isOpen]);

  const searchMatchingTeams = async () => {
    if (!team.name) return;
    
    setIsSearching(true);
    try {
      // Extract division from team.division (e.g., "aug-classic_div_11U" -> "11U")
      const divisionMatch = team.division.match(/(\d+U)/);
      const division = divisionMatch ? divisionMatch[1] : '';
      
      const response = await fetch(`/api/roster/teams/search?query=${encodeURIComponent(team.name)}&division=${division}`);
      
      const data = await response.json();
      console.log('RosterImport search response:', data);
      if (data.success && data.teams) {
        setMatchedTeams(data.teams.map((t: any) => ({
          team_id: t.id,
          team_name: t.name,
          division: t.ageGroup,
          affiliate: t.affiliate,
          confidence: t.confidence
        })));
      } else {
        // Show honest error about OBA limitations
        setMatchedTeams([]);
        toast({
          title: "Automatic Import Not Available",
          description: data.error || "OBA website protections prevent automatic roster discovery. Manual import required.",
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tournamentTeamId: team.id
        })
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
      console.error('Roster import error:', error);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Import Authentic Roster
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
            <p className="text-sm text-gray-500">
              Select an OBA team to import authentic roster data:
            </p>
          </div>

          <div>
            <Select value={selectedTeam} onValueChange={setSelectedTeam} disabled={isSearching}>
              <SelectTrigger>
                <SelectValue placeholder={isSearching ? "Searching for matches..." : "Select an OBA team..."} />
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
          </div>

          {matchedTeams.length === 0 && (
            <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <ExternalLink className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Manual Import Required
                </span>
              </div>
              <p className="text-xs text-amber-700 mb-2">
                Automatic OBA roster discovery is not available due to website protections.
              </p>
              <div className="text-xs text-amber-600">
                <p className="font-medium">To import rosters:</p>
                <ol className="list-decimal ml-4 mt-1">
                  <li>Visit playoba.ca manually</li>
                  <li>Find your team's roster page</li>
                  <li>Copy roster data</li>
                  <li>Contact tournament organizer for manual import</li>
                </ol>
              </div>
            </div>
          )}

          {selectedTeam && matchedTeams.length > 0 && (
            <div className="bg-green-50 p-3 rounded-md border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  Verified Authentic Data
                </span>
              </div>
              <p className="text-xs text-green-700">
                Real player roster will be imported from playoba.ca
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!selectedTeam || isImporting || matchedTeams.length === 0}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Importing...
                </>
              ) : matchedTeams.length === 0 ? (
                <>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manual Import Required
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Import Roster
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function TeamsTab({ teams, pools, ageDivisions }: TeamsTabProps) {
  const [divisionFilter, setDivisionFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const filteredTeams = divisionFilter === 'all' 
    ? teams 
    : teams.filter((team: Team) => team.division === divisionFilter);

  const handleRosterImportSuccess = () => {
    // Refresh teams data by invalidating the tournament data hook queries
    queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
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
    if (team.rosterLink) {
      return "Link available";
    }
    return "No roster";
  };

  console.log('Teams data:', teams);
  console.log('Teams length:', teams.length);
  console.log('Age divisions:', ageDivisions);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Teams ({teams.length})</h3>
        
        <div className="flex items-center gap-2">
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {ageDivisions.map((division: any) => (
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
              <TableHead>Division</TableHead>
              <TableHead>Roster Status</TableHead>
              <TableHead>Roster Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeams.map((team: Team) => (
              <TableRow key={team.id}>
                <TableCell className="font-medium">{team.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">{team.division || 'Unknown'}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{getRosterStatus(team)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {team.rosterLink ? (
                    <a 
                      href={team.rosterLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm whitespace-nowrap"
                    >
                      View Roster
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-gray-400 text-sm">No link</span>
                  )}
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
    </div>
  );
}