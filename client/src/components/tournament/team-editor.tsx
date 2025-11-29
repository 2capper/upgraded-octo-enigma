import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Edit, ExternalLink, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface Team {
  id: string;
  name: string;
  division: string | null;
  city: string | null;
  coachFirstName?: string | null;
  coachLastName?: string | null;
  coachEmail?: string | null;
  phone: string | null;
  rosterLink: string | null;
  teamNumber: string | null;
  registrationStatus?: string | null;
  paymentStatus?: string | null;
}

interface TeamEditorProps {
  teams: Team[];
  tournamentId: string;
}

function TeamEditDialog({ team, onSuccess }: { team: Team; onSuccess: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    name: team.name || '',
    city: team.city || '',
    coachFirstName: team.coachFirstName || '',
    coachLastName: team.coachLastName || '',
    coachEmail: team.coachEmail || '',
    phone: team.phone || '',
    teamNumber: team.teamNumber || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Build roster link and set roster status if team number is provided
      let rosterLink = team.rosterLink;
      
      if (formData.teamNumber && formData.teamNumber.trim().length > 0) {
        // Build the PlayOBA URL with the team number
        rosterLink = `https://www.playoba.ca/stats#/2111/team/${formData.teamNumber.trim()}/roster`;
      }

      const updateData = {
        name: formData.name,
        city: formData.city || null,
        coachFirstName: formData.coachFirstName || null,
        coachLastName: formData.coachLastName || null,
        coachEmail: formData.coachEmail || null,
        phone: formData.phone || null,
        teamNumber: formData.teamNumber || null,
        rosterLink,
      };

      await apiRequest('PUT', `/api/teams/${team.id}`, updateData);

      toast({
        title: "Team Updated",
        description: formData.teamNumber 
          ? `Team updated with roster link: ${rosterLink}`
          : "Team information updated successfully",
      });

      setIsOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update team",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" data-testid={`button-edit-team-${team.id}`}>
          <Edit className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Team</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-team-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Team city"
                data-testid="input-team-city"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coachFirstName">Coach First Name</Label>
                <Input
                  id="coachFirstName"
                  value={formData.coachFirstName}
                  onChange={(e) => setFormData({ ...formData, coachFirstName: e.target.value })}
                  placeholder="First name"
                  data-testid="input-coach-first-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="coachLastName">Coach Last Name</Label>
                <Input
                  id="coachLastName"
                  value={formData.coachLastName}
                  onChange={(e) => setFormData({ ...formData, coachLastName: e.target.value })}
                  placeholder="Last name"
                  data-testid="input-coach-last-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coachEmail">Coach Email</Label>
              <Input
                id="coachEmail"
                type="email"
                value={formData.coachEmail}
                onChange={(e) => setFormData({ ...formData, coachEmail: e.target.value })}
                placeholder="coach@example.com"
                data-testid="input-coach-email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Contact phone"
                data-testid="input-team-phone"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="teamNumber">Team Number (6 digits)</Label>
              <Input
                id="teamNumber"
                value={formData.teamNumber}
                onChange={(e) => setFormData({ ...formData, teamNumber: e.target.value })}
                placeholder="e.g., 594195"
                maxLength={10}
                data-testid="input-team-number"
              />
              <p className="text-xs text-gray-500">
                Enter the 6-digit PlayOBA team number. This will automatically create the roster link.
              </p>
              {formData.teamNumber && formData.teamNumber.trim().length > 0 && (
                <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs">
                  <div className="flex items-center gap-1 text-green-700">
                    <Check className="w-3 h-3" />
                    <span className="font-medium">Roster link will be set to:</span>
                  </div>
                  <a 
                    href={`https://www.playoba.ca/stats#/2111/team/${formData.teamNumber.trim()}/roster`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 mt-1"
                  >
                    https://www.playoba.ca/stats#/2111/team/{formData.teamNumber.trim()}/roster
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving} data-testid="button-save-team">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TeamEditor({ teams, tournamentId }: TeamEditorProps) {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    // Refresh teams data
    queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
  };

  const formatPhoneDisplay = (phone: string | null | undefined): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      const areaCode = cleaned.substring(1, 4);
      const prefix = cleaned.substring(4, 7);
      const lineNumber = cleaned.substring(7);
      return `(${areaCode}) ${prefix}-${lineNumber}`;
    } else if (cleaned.length === 10) {
      const areaCode = cleaned.substring(0, 3);
      const prefix = cleaned.substring(3, 6);
      const lineNumber = cleaned.substring(6);
      return `(${areaCode}) ${prefix}-${lineNumber}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Edit Teams</h3>
        <Badge variant="outline">{teams.length} teams</Badge>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Coach Name</TableHead>
              <TableHead>Coach Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Roster #</TableHead>
              <TableHead>Registration</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500 py-8">
                  No teams found. Import teams from CSV first.
                </TableCell>
              </TableRow>
            ) : (
              teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium" data-testid={`text-team-name-${team.id}`}>
                    {team.name}
                  </TableCell>
                  <TableCell data-testid={`text-team-city-${team.id}`}>
                    {team.city || <span className="text-gray-400">—</span>}
                  </TableCell>
                  <TableCell data-testid={`text-team-coach-${team.id}`}>
                    {team.coachFirstName || team.coachLastName ? (
                      <span>{team.coachFirstName} {team.coachLastName}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-team-email-${team.id}`}>
                    {team.coachEmail ? (
                      <a href={`mailto:${team.coachEmail}`} className="text-blue-600 hover:text-blue-800 text-sm">
                        {team.coachEmail}
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-team-phone-${team.id}`}>
                    {team.phone ? (
                      <span className="text-sm">{formatPhoneDisplay(team.phone)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-team-number-${team.id}`}>
                    {team.teamNumber ? (
                      <a 
                        href={`https://www.playoba.ca/stats#/2111/team/${team.teamNumber.trim()}/roster`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                        data-testid={`link-roster-${team.id}`}
                      >
                        <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80">
                          {team.teamNumber}
                        </Badge>
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </a>
                    ) : team.rosterLink ? (
                      <a 
                        href={team.rosterLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm"
                        data-testid={`link-roster-${team.id}`}
                      >
                        View Roster
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-registration-status-${team.id}`}>
                    {team.registrationStatus ? (
                      <Badge variant={team.registrationStatus === 'Registered' ? 'default' : 'outline'}>
                        {team.registrationStatus}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-payment-status-${team.id}`}>
                    {team.paymentStatus ? (
                      <Badge variant={team.paymentStatus === 'paid' ? 'default' : 'destructive'}>
                        {team.paymentStatus}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <TeamEditDialog team={team} onSuccess={handleSuccess} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
