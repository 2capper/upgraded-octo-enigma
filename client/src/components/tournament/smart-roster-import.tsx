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

interface OBAMatch {
  id: string;
  name: string;
  division: string;
  city: string;
  classification: string;
  url: string;
  match_score: number;
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
  const [matches, setMatches] = useState<OBAMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<OBAMatch | null>(null);
  const [importingRoster, setImportingRoster] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const importRosterMutation = useMutation({
    mutationFn: async (obaTeamId: string) => {
      const response = await fetch(`/api/teams/${team.id}/roster/import-by-team-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: team.id, obaTeamId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to import roster');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Roster Imported",
        description: `Successfully imported ${data.player_count || 0} players for ${team.name}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import roster. Please try again.",
        variant: "destructive",
      });
    }
  });

  useEffect(() => {
    const findMatches = async () => {
      try {
        const response = await fetch(`/api/teams/${team.id}/find-oba-matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (!response.ok) {
          throw new Error('Failed to find matches');
        }
        
        const data = await response.json();
        
        setMatches(data.matches || []);
        setLoading(false);
        
        if (data.total_found === 0) {
          toast({
            title: "No Matches Found",
            description: `No OBA teams found matching "${team.name}".`,
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error finding matches:', error);
        setLoading(false);
        toast({
          title: "Search Failed",
          description: "Failed to search for matching OBA teams.",
          variant: "destructive",
        });
      }
    };

    findMatches();
  }, [team.id, team.name, toast]);

  const handleImportRoster = (match: OBAMatch) => {
    setSelectedMatch(match);
    setImportingRoster(true);
    importRosterMutation.mutate(match.id);
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 2) return "bg-green-100 text-green-800";
    if (score >= 1) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
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
          ) : matches.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Matches Found</h3>
                  <p className="text-gray-600">
                    No OBA teams found matching "{team.name}". Try using the manual team search instead.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Found {matches.length} matching OBA teams for "{team.name}"
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Match Quality</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matches.map((match) => (
                    <TableRow key={match.id}>
                      <TableCell>
                        <Badge className={getMatchScoreColor(match.match_score)}>
                          {match.match_score >= 2 ? 'Excellent' : 
                           match.match_score >= 1 ? 'Good' : 'Possible'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium max-w-[200px] truncate" title={match.name}>
                        {match.name}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{match.division}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {match.city}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(match.url, '_blank')}
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleImportRoster(match)}
                            disabled={importingRoster}
                            className="bg-[var(--forest-green)] hover:bg-[var(--forest-green)]/90"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            {importingRoster && selectedMatch?.id === match.id ? 'Importing...' : 'Import'}
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