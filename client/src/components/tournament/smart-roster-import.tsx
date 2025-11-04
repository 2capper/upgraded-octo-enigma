import { useState, useEffect } from 'react';
import { Search, Download, ExternalLink, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Team } from '@shared/schema';

interface OBATeam {
  id: string;
  name: string;
  affiliate: string;
  ageGroup: string;
  confidence: number;
}

interface MatchResult {
  team: {
    id: string;
    name: string;
    division: string;
  };
  matches: OBAMatch[];
  total_found: number;
}

interface SmartRosterImportProps {
  team: Team;
  onClose: () => void;
}

export const SmartRosterImport = ({ team, onClose }: SmartRosterImportProps) => {
  const [teams, setTeams] = useState<OBATeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState<OBATeam | null>(null);
  const [importingRoster, setImportingRoster] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importRosterMutation = useMutation({
    mutationFn: async (obaTeamId: string) => {
      const response = await fetch(`/api/roster/teams/${obaTeamId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentTeamId: team.id })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to import roster');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Roster Imported",
        description: data.message || `Successfully imported roster for ${team.name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: error.message || "Failed to import roster. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    const searchTeams = async () => {
      try {
        setLoading(true);
        setSearchPerformed(false);
        
        // Search for teams using the improved API
        const searchUrl = `/api/roster/teams/search?query=${encodeURIComponent(team.name)}`;
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Search results:', data);
        
        if (data.success) {
          setTeams(data.teams || []);
          setSearchPerformed(true);
          
          if (data.teams && data.teams.length === 0) {
            toast({
              title: "No Teams Found",
              description: `No OBA teams found matching "${team.name}". Try a shorter or different search term.`,
            });
          } else {
            toast({
              title: "Teams Found",
              description: `Found ${data.teams.length} matching OBA teams for "${team.name}".`,
            });
          }
        } else {
          toast({
            title: "Search Failed",
            description: data.error || "Failed to search for OBA teams.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error searching teams:', error);
        toast({
          title: "Search Error",
          description: "Failed to search for matching OBA teams.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    searchTeams();
  }, [team.id, team.name, toast]);

  const handleImportRoster = (obaTeam: OBATeam) => {
    setSelectedTeam(obaTeam);
    setImportingRoster(true);
    importRosterMutation.mutate(obaTeam.id);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return "bg-green-100 text-green-800";
    if (confidence >= 50) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Smart Roster Import for {team.name}
          </DialogTitle>
          <DialogDescription>
            Select the matching OBA team to import roster data. Teams are ranked by match quality.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-gray-600">
                <Search className="w-4 h-4 animate-spin" />
                Searching OBA teams for matches...
              </div>
            </div>
          ) : teams.length === 0 && searchPerformed ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Teams Found</h3>
                  <p className="text-gray-600">
                    No OBA teams found matching "{team.name}". Try a shorter search term.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Found {teams.length} matching OBA teams for "{team.name}"
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Age Group</TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((obaTeam) => (
                    <TableRow key={obaTeam.id}>
                      <TableCell>
                        <Badge className={getConfidenceColor(obaTeam.confidence)}>
                          {obaTeam.confidence}%
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={obaTeam.name}>
                        {obaTeam.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{obaTeam.ageGroup}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {obaTeam.affiliate}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`https://www.playoba.ca/stats#/team/${obaTeam.id}/roster`, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleImportRoster(obaTeam)}
                            disabled={importingRoster}
                            className="bg-[var(--forest-green)] hover:bg-[var(--forest-green)]/90"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            {importingRoster && selectedTeam?.id === obaTeam.id ? 'Importing...' : 'Import'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};