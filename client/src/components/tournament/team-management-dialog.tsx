import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, Clock, Users, Zap, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Team, Game, Pool, AgeDivision } from '@shared/schema';

interface TeamManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  tournamentId: string;
  pools: Pool[];
  ageDivisions: AgeDivision[];
  games: Game[];
  allTeams: Team[];
}

interface OpenSlot {
  gameId: string;
  date: string;
  time: string;
  location: string;
  opponentName: string;
  isHome: boolean;
  poolId: string;
}

export function TeamManagementDialog({
  open,
  onOpenChange,
  team,
  tournamentId,
  pools,
  ageDivisions,
  games,
  allTeams
}: TeamManagementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    coachFirstName: '',
    coachLastName: '',
    coachEmail: '',
    coachPhone: '',
    phone: '',
    teamNumber: '',
    poolId: '',
    schedulingRequests: '',
    willingToPlayExtra: false,
  });

  useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        city: team.city || '',
        coachFirstName: team.coachFirstName || '',
        coachLastName: team.coachLastName || '',
        coachEmail: team.coachEmail || '',
        coachPhone: team.coachPhone || '',
        phone: team.phone || '',
        teamNumber: team.teamNumber || '',
        poolId: team.poolId || '',
        schedulingRequests: team.schedulingRequests || '',
        willingToPlayExtra: team.willingToPlayExtra || false,
      });
    } else {
      setFormData({
        name: '',
        city: '',
        coachFirstName: '',
        coachLastName: '',
        coachEmail: '',
        coachPhone: '',
        phone: '',
        teamNumber: '',
        poolId: '',
        schedulingRequests: '',
        willingToPlayExtra: false,
      });
    }
  }, [team, open]);

  const openSlots = useMemo((): OpenSlot[] => {
    if (!formData.poolId) return [];
    
    const poolGames = games.filter(g => 
      g.poolId === formData.poolId && 
      g.status === 'scheduled' &&
      (!g.homeTeamId || !g.awayTeamId)
    );

    return poolGames.map(game => {
      const hasHome = !!game.homeTeamId;
      const opponentId = hasHome ? game.homeTeamId : game.awayTeamId;
      const opponent = allTeams.find(t => t.id === opponentId);
      
      return {
        gameId: game.id,
        date: game.date,
        time: game.time || 'TBD',
        location: game.location || 'TBD',
        opponentName: opponent?.name || 'TBD',
        isHome: !hasHome,
        poolId: game.poolId,
      };
    }).filter(slot => slot.opponentName !== 'TBD');
  }, [games, formData.poolId, allTeams]);

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!team) throw new Error('No team to update');
      
      let rosterLink = team.rosterLink;
      if (data.teamNumber && data.teamNumber.trim().length > 0) {
        rosterLink = `https://www.playoba.ca/stats#/2111/team/${data.teamNumber.trim()}/roster`;
      }

      const updateData = {
        name: data.name,
        city: data.city || null,
        coachFirstName: data.coachFirstName || null,
        coachLastName: data.coachLastName || null,
        coachEmail: data.coachEmail || null,
        coachPhone: data.coachPhone || null,
        phone: data.phone || null,
        teamNumber: data.teamNumber || null,
        poolId: data.poolId || null,
        rosterLink,
        schedulingRequests: data.schedulingRequests || null,
        willingToPlayExtra: data.willingToPlayExtra,
      };

      return apiRequest('PUT', `/api/teams/${team.id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Team Updated",
        description: "Team information has been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update team",
        variant: "destructive",
      });
    },
  });

  const fillSlotMutation = useMutation({
    mutationFn: async (slot: OpenSlot) => {
      if (!team) throw new Error('No team selected');
      
      const updateData = slot.isHome 
        ? { homeTeamId: team.id }
        : { awayTeamId: team.id };
      
      return apiRequest('PUT', `/api/games/${slot.gameId}`, updateData);
    },
    onSuccess: (_, slot) => {
      toast({
        title: "Slot Filled",
        description: `${team?.name} has been added to the game on ${slot.date} at ${slot.time}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Fill Slot",
        description: error instanceof Error ? error.message : "Failed to assign team to game",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Team name is required",
        variant: "destructive",
      });
      return;
    }
    updateMutation.mutate(formData);
  };

  const getPoolName = (poolId: string) => {
    const pool = pools.find(p => p.id === poolId);
    if (!pool) return 'Unknown Pool';
    const division = ageDivisions.find(d => d.id === pool.ageDivisionId);
    return `${division?.name || ''} - ${pool.name}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            {team ? 'Edit Team' : 'Add Team'}
          </DialogTitle>
          <DialogDescription>
            Manage team details, scheduling preferences, and pool assignments.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Team Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Forest Glade 13U"
                data-testid="input-team-name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Windsor"
                data-testid="input-team-city"
              />
            </div>
          </div>

          <Separator />
          
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Coach Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coachFirstName">First Name</Label>
                <Input
                  id="coachFirstName"
                  value={formData.coachFirstName}
                  onChange={(e) => setFormData({ ...formData, coachFirstName: e.target.value })}
                  data-testid="input-coach-first-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="coachLastName">Last Name</Label>
                <Input
                  id="coachLastName"
                  value={formData.coachLastName}
                  onChange={(e) => setFormData({ ...formData, coachLastName: e.target.value })}
                  data-testid="input-coach-last-name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="coachEmail">Email</Label>
                <Input
                  id="coachEmail"
                  type="email"
                  value={formData.coachEmail}
                  onChange={(e) => setFormData({ ...formData, coachEmail: e.target.value })}
                  data-testid="input-coach-email"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="coachPhone">Phone</Label>
                <Input
                  id="coachPhone"
                  value={formData.coachPhone}
                  onChange={(e) => setFormData({ ...formData, coachPhone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-coach-phone"
                />
              </div>
            </div>
          </div>

          <Separator />
          
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground">Pool Assignment</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="poolId">Assigned Pool</Label>
                <Select
                  value={formData.poolId}
                  onValueChange={(value) => setFormData({ ...formData, poolId: value })}
                  data-testid="select-pool"
                >
                  <SelectTrigger data-testid="select-pool-trigger">
                    <SelectValue placeholder="Select a pool..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pools.map((pool) => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {getPoolName(pool.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="teamNumber">OBA Team Number</Label>
                <Input
                  id="teamNumber"
                  value={formData.teamNumber}
                  onChange={(e) => setFormData({ ...formData, teamNumber: e.target.value })}
                  placeholder="e.g., 500718"
                  data-testid="input-team-number"
                />
              </div>
            </div>
          </div>

          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h4 className="font-medium text-sm text-muted-foreground">Scheduling Preferences</h4>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="schedulingRequests">Special Scheduling Requests</Label>
                <Textarea
                  id="schedulingRequests"
                  value={formData.schedulingRequests}
                  onChange={(e) => setFormData({ ...formData, schedulingRequests: e.target.value })}
                  placeholder="e.g., Can't play before 11 AM on Saturday due to travel distance"
                  rows={3}
                  data-testid="input-scheduling-requests"
                />
                <p className="text-xs text-muted-foreground">
                  Note any time restrictions, travel constraints, or scheduling preferences.
                </p>
              </div>
              
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="willingToPlayExtra" className="font-medium">
                    Willing to Play Extra Games
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Team is available if an open slot needs filling
                  </p>
                </div>
                <Switch
                  id="willingToPlayExtra"
                  checked={formData.willingToPlayExtra}
                  onCheckedChange={(checked) => setFormData({ ...formData, willingToPlayExtra: checked })}
                  data-testid="switch-willing-to-play-extra"
                />
              </div>
            </div>
          </div>

          {openSlots.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h4 className="font-medium text-sm">Open Slots Available</h4>
                  <Badge variant="secondary" className="ml-auto">
                    {openSlots.length} slot{openSlots.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800">
                      Games in this pool have open slots. Click to instantly assign this team.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    {openSlots.map((slot) => (
                      <div
                        key={slot.gameId}
                        className="flex items-center justify-between bg-white rounded-md p-3 border border-amber-100"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium">
                              {formatDate(slot.date)} at {slot.time}
                            </p>
                            <p className="text-xs text-gray-500">
                              vs {slot.opponentName} ({slot.isHome ? 'Home' : 'Away'})
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          onClick={() => fillSlotMutation.mutate(slot)}
                          disabled={fillSlotMutation.isPending}
                          data-testid={`button-fill-slot-${slot.gameId}`}
                        >
                          {fillSlotMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Fill Slot'
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save-team"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Team'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
