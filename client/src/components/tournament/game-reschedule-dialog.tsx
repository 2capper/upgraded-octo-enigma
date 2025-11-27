import { useState, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Calendar, Clock, MapPin, MessageSquare, AlertTriangle, Send, Users, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Game, Diamond, Team } from '@shared/schema';

interface GameRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  game: Game | null;
  diamonds: Diamond[];
  teams: Team[];
  orgId: string;
}

interface CoachContact {
  teamId: string;
  teamName: string;
  coachName: string;
  phone: string;
  type: 'coach' | 'manager' | 'assistant';
}

export function GameRescheduleDialog({
  open,
  onOpenChange,
  game,
  diamonds,
  teams,
  orgId
}: GameRescheduleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    diamondId: '',
  });
  
  const [sendNotification, setSendNotification] = useState(true);
  const [customMessage, setCustomMessage] = useState('');
  const [notificationSent, setNotificationSent] = useState(false);

  useEffect(() => {
    if (game) {
      setFormData({
        date: game.date || '',
        time: game.time || '',
        diamondId: game.diamondId || '',
      });
      setNotificationSent(false);
      setCustomMessage('');
    }
  }, [game, open]);

  const affectedCoaches = useMemo((): CoachContact[] => {
    if (!game) return [];
    
    const contacts: CoachContact[] = [];
    const homeTeam = teams.find(t => t.id === game.homeTeamId);
    const awayTeam = teams.find(t => t.id === game.awayTeamId);
    
    const addTeamContacts = (team: Team | undefined) => {
      if (!team) return;
      
      if (team.coachPhone) {
        contacts.push({
          teamId: team.id,
          teamName: team.name,
          coachName: `${team.coachFirstName || ''} ${team.coachLastName || ''}`.trim() || 'Coach',
          phone: team.coachPhone,
          type: 'coach',
        });
      }
      if (team.managerPhone) {
        contacts.push({
          teamId: team.id,
          teamName: team.name,
          coachName: team.managerName || 'Manager',
          phone: team.managerPhone,
          type: 'manager',
        });
      }
      if (team.assistantPhone) {
        contacts.push({
          teamId: team.id,
          teamName: team.name,
          coachName: team.assistantName || 'Assistant',
          phone: team.assistantPhone,
          type: 'assistant',
        });
      }
    };
    
    addTeamContacts(homeTeam);
    addTeamContacts(awayTeam);
    
    return contacts;
  }, [game, teams]);

  const hasChanges = useMemo(() => {
    if (!game) return false;
    return (
      formData.date !== (game.date || '') ||
      formData.time !== (game.time || '') ||
      formData.diamondId !== (game.diamondId || '')
    );
  }, [game, formData]);

  const generateNotificationMessage = () => {
    if (!game) return '';
    
    const homeTeam = teams.find(t => t.id === game.homeTeamId);
    const awayTeam = teams.find(t => t.id === game.awayTeamId);
    const diamond = diamonds.find(d => d.id === formData.diamondId);
    
    const changes: string[] = [];
    
    if (formData.date !== game.date) {
      const newDate = new Date(formData.date).toLocaleDateString('en-US', { 
        weekday: 'short', month: 'short', day: 'numeric' 
      });
      changes.push(`Date: ${newDate}`);
    }
    
    if (formData.time !== game.time) {
      changes.push(`Time: ${formData.time}`);
    }
    
    if (formData.diamondId !== game.diamondId) {
      changes.push(`Field: ${diamond?.name || 'TBD'}`);
    }
    
    const matchup = `${awayTeam?.name || 'TBD'} vs ${homeTeam?.name || 'TBD'}`;
    
    if (customMessage) {
      return `GAME UPDATE: ${matchup}\n${changes.join('\n')}\n\n${customMessage}`;
    }
    
    return `GAME UPDATE: ${matchup}\n${changes.join('\n')}\n\nPlease confirm your attendance.`;
  };

  const updateGameMutation = useMutation({
    mutationFn: async () => {
      if (!game) throw new Error('No game to update');
      
      return apiRequest('PUT', `/api/games/${game.id}`, {
        date: formData.date,
        time: formData.time,
        diamondId: formData.diamondId || null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Game Updated",
        description: "The game schedule has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update game",
        variant: "destructive",
      });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      if (affectedCoaches.length === 0) {
        throw new Error('No coaches with phone numbers to notify');
      }
      
      const message = generateNotificationMessage();
      const recipients = affectedCoaches.map(c => ({
        phone: c.phone,
        name: c.coachName,
        teamId: c.teamId,
      }));
      
      return apiRequest('POST', `/api/organizations/${orgId}/sms/send-bulk`, {
        recipients,
        messageBody: message,
        tournamentId: game?.tournamentId,
      });
    },
    onSuccess: (data: any) => {
      setNotificationSent(true);
      toast({
        title: "Notifications Sent",
        description: `SMS sent to ${data.sent} coach${data.sent !== 1 ? 'es' : ''}.${data.failed > 0 ? ` ${data.failed} failed.` : ''}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Notification Failed",
        description: error instanceof Error ? error.message : "Failed to send notifications",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasChanges) {
      toast({
        title: "No Changes",
        description: "No changes were made to the game schedule.",
      });
      return;
    }
    
    await updateGameMutation.mutateAsync();
    
    if (sendNotification && affectedCoaches.length > 0) {
      await sendNotificationMutation.mutateAsync();
    }
    
    onOpenChange(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
    });
  };

  const homeTeam = game ? teams.find(t => t.id === game.homeTeamId) : null;
  const awayTeam = game ? teams.find(t => t.id === game.awayTeamId) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Reschedule Game
          </DialogTitle>
          <DialogDescription>
            Update game schedule and optionally notify affected coaches via SMS.
          </DialogDescription>
        </DialogHeader>

        {game && (
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="bg-gray-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Current Game</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-lg">
                      {awayTeam?.name || 'TBD'} vs {homeTeam?.name || 'TBD'}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatDate(game.date)} at {game.time || 'TBD'}
                    </p>
                  </div>
                  <Badge variant={game.status === 'completed' ? 'default' : 'secondary'}>
                    {game.status === 'completed' ? 'Final' : 'Scheduled'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">New Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  data-testid="input-game-date"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="time">New Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  data-testid="input-game-time"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diamondId">Diamond / Field</Label>
              <Select
                value={formData.diamondId}
                onValueChange={(value) => setFormData({ ...formData, diamondId: value })}
                data-testid="select-diamond"
              >
                <SelectTrigger data-testid="select-diamond-trigger">
                  <SelectValue placeholder="Select a field..." />
                </SelectTrigger>
                <SelectContent>
                  {diamonds.map((diamond) => (
                    <SelectItem key={diamond.id} value={diamond.id}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        {diamond.name}
                        {diamond.location && (
                          <span className="text-xs text-gray-500">({diamond.location})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Notification Options</h4>
              </div>
              
              {affectedCoaches.length > 0 ? (
                <>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sendNotification"
                      checked={sendNotification}
                      onCheckedChange={(checked) => setSendNotification(!!checked)}
                      data-testid="checkbox-send-notification"
                    />
                    <Label htmlFor="sendNotification" className="text-sm font-normal">
                      Send SMS notification to coaches
                    </Label>
                  </div>
                  
                  {sendNotification && (
                    <div className="space-y-4 pl-6">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-2 mb-3">
                          <Users className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-blue-800 text-sm">
                              {affectedCoaches.length} Contact{affectedCoaches.length > 1 ? 's' : ''} Will Be Notified
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {affectedCoaches.map((coach, idx) => (
                            <Badge 
                              key={`${coach.teamId}-${coach.type}-${idx}`}
                              variant="secondary" 
                              className="text-xs"
                            >
                              {coach.coachName} ({coach.teamName})
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="customMessage">Additional Message (optional)</Label>
                        <Textarea
                          id="customMessage"
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          placeholder="Add any additional details for coaches..."
                          rows={2}
                          data-testid="input-custom-message"
                        />
                      </div>
                      
                      {hasChanges && (
                        <div className="bg-gray-50 border rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-2">Preview:</p>
                          <p className="text-sm whitespace-pre-wrap">{generateNotificationMessage()}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-amber-800 text-sm">No Phone Numbers Available</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Neither team has coach phone numbers on file. Notifications cannot be sent.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {notificationSent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <p className="font-medium text-green-800 text-sm">Notifications Sent Successfully</p>
                </div>
              </div>
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
                disabled={updateGameMutation.isPending || sendNotificationMutation.isPending || !hasChanges}
                data-testid="button-save-game"
              >
                {updateGameMutation.isPending || sendNotificationMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {sendNotificationMutation.isPending ? 'Sending...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {sendNotification && affectedCoaches.length > 0 ? (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Save & Notify
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
