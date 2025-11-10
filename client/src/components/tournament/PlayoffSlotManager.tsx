import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Calendar, Clock, MapPin, Trophy, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Tournament, Diamond, AgeDivision, Game } from '@shared/schema';
import { getBracketStructure } from '@shared/bracketStructure';
import { useTournamentTimezone } from '@/hooks/useTournamentTimezone';
import { zonedTimeToUtc } from 'date-fns-tz';
import { toZonedTime, format as formatTz } from 'date-fns-tz';

interface SlotScheduleData {
  date: string;
  time: string;
  diamondId: string;
}

interface PlayoffSlotManagerProps {
  tournament: Tournament;
  ageDivision: AgeDivision;
  diamonds: Diamond[];
}

export function PlayoffSlotManager({ tournament, ageDivision, diamonds }: PlayoffSlotManagerProps) {
  const { toast } = useToast();
  const [formState, setFormState] = useState<Record<string, SlotScheduleData>>({});
  const { timezone, isLoading: timezoneLoading } = useTournamentTimezone(tournament.id);

  const slots = getBracketStructure(tournament.playoffFormat || 'top_8');

  const { data: existingGames, isLoading: isLoadingGames } = useQuery<Game[]>({
    queryKey: ['/api/tournaments', tournament.id, 'games'],
    select: (allGames) => {
      return allGames.filter(g => 
        g.isPlayoff && 
        g.ageDivisionId === ageDivision.id
      );
    }
  });

  useEffect(() => {
    if (existingGames && timezone) {
      const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const initialState: Record<string, SlotScheduleData> = {};
      
      existingGames.forEach(game => {
        const slotKey = `r${game.playoffRound}-g${game.playoffGameNumber}`;
        
        // Convert stored tournament-timezone values to browser local for display
        if (game.date && game.time) {
          try {
            // Parse stored values as tournament timezone
            const tournamentDateTime = `${game.date}T${game.time}`;
            const utcDate = zonedTimeToUtc(tournamentDateTime, timezone);
            
            // Format to browser local for input display
            const localDate = formatTz(utcDate, 'yyyy-MM-dd', { timeZone: browserTz });
            const localTime = formatTz(utcDate, 'HH:mm', { timeZone: browserTz });
            
            initialState[slotKey] = {
              date: localDate,
              time: localTime,
              diamondId: game.diamondId || '',
            };
          } catch (error) {
            console.error(`Error converting game ${slotKey} timezone:`, error);
            // Fallback: show tournament times directly
            initialState[slotKey] = {
              date: game.date || '',
              time: game.time || '',
              diamondId: game.diamondId || '',
            };
          }
        } else {
          initialState[slotKey] = {
            date: '',
            time: '',
            diamondId: game.diamondId || '',
          };
        }
      });
      setFormState(initialState);
    }
  }, [existingGames, timezone]);

  const saveSlotsMutation = useMutation({
    mutationFn: async (data: Record<string, SlotScheduleData>) => {
      return apiRequest('POST', `/api/tournaments/${tournament.id}/divisions/${ageDivision.id}/playoff-slots`, { 
        slots: data 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournament.id, 'games'] });
      toast({
        title: "Playoff Schedule Saved",
        description: "The playoff game slots have been successfully created/updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save the playoff schedule.",
        variant: "destructive",
      });
    },
  });

  const handleSlotChange = (slotKey: string, field: keyof SlotScheduleData, value: string) => {
    setFormState(prev => ({
      ...prev,
      [slotKey]: {
        ...(prev[slotKey] || { date: '', time: '', diamondId: '' }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!timezone) {
      toast({
        title: "Error",
        description: "Tournament timezone not loaded. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Validate all slots have data
    for (const slot of slots) {
      const slotKey = `r${slot.round}-g${slot.gameNumber}`;
      const data = formState[slotKey];
      if (!data || !data.date || !data.time || !data.diamondId) {
        toast({
          title: "Incomplete Schedule",
          description: `Please fill in all fields for "${slot.name}".`,
          variant: "destructive",
        });
        return;
      }
    }

    // Convert browser-local input values to tournament timezone for storage
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tournamentLocalSlots: Record<string, SlotScheduleData> = {};
    
    try {
      for (const [slotKey, slotData] of Object.entries(formState)) {
        const { date, time, diamondId } = slotData;
        
        if (date && time) {
          // Parse input values as browser-local time
          const browserDateTime = `${date}T${time}`;
          const utcFromBrowser = zonedTimeToUtc(browserDateTime, browserTz);
          
          // Convert to tournament timezone for storage
          const tournamentDate = formatTz(utcFromBrowser, 'yyyy-MM-dd', { timeZone: timezone });
          const tournamentTime = formatTz(utcFromBrowser, 'HH:mm', { timeZone: timezone });
          
          tournamentLocalSlots[slotKey] = {
            date: tournamentDate,
            time: tournamentTime,
            diamondId,
          };
        } else {
          tournamentLocalSlots[slotKey] = slotData;
        }
      }
    } catch (error) {
      console.error('Error converting times to tournament timezone:', error);
      toast({
        title: "Timezone Conversion Error",
        description: "Failed to convert times. Please try again.",
        variant: "destructive",
      });
      return;
    }

    saveSlotsMutation.mutate(tournamentLocalSlots);
  };

  if (isLoadingGames) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This tournament's playoff format ("{tournament.playoffFormat}") is not supported.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          {ageDivision.name} Playoff Schedule
        </CardTitle>
        <CardDescription>
          Pre-schedule playoff games by assigning date, time, and diamond to each bracket slot.
          Teams will be assigned automatically when you generate the bracket after pool play.
          <span className="block mt-1 text-sm text-muted-foreground">
            Times are shown in your local timezone and will be stored in the tournament's timezone ({timezone || 'America/Toronto'}).
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {slots.map((slot) => {
              const slotKey = `r${slot.round}-g${slot.gameNumber}`;
              const value = formState[slotKey] || { date: '', time: '', diamondId: '' };

              return (
                <div key={slotKey} className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-800 space-y-3">
                  <Label className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    {slot.name}
                  </Label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`${slotKey}-date`} className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> Date
                      </Label>
                      <Input
                        id={`${slotKey}-date`}
                        type="date"
                        value={value.date}
                        onChange={(e) => handleSlotChange(slotKey, 'date', e.target.value)}
                        data-testid={`input-${slotKey}-date`}
                        min={tournament.startDate}
                        max={tournament.endDate}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${slotKey}-time`} className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> Time
                      </Label>
                      <Input
                        id={`${slotKey}-time`}
                        type="time"
                        value={value.time}
                        onChange={(e) => handleSlotChange(slotKey, 'time', e.target.value)}
                        data-testid={`input-${slotKey}-time`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`${slotKey}-diamond`} className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" /> Diamond
                      </Label>
                      <Select
                        value={value.diamondId}
                        onValueChange={(val) => handleSlotChange(slotKey, 'diamondId', val)}
                      >
                        <SelectTrigger id={`${slotKey}-diamond`} data-testid={`select-${slotKey}-diamond`}>
                          <SelectValue placeholder="Select a diamond" />
                        </SelectTrigger>
                        <SelectContent>
                          {diamonds.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saveSlotsMutation.isPending}
              className="min-h-[48px] font-semibold"
              data-testid="button-save-playoff-schedule"
            >
              {saveSlotsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Playoff Schedule'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
