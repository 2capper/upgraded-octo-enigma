import { useState } from 'react';
import { Calendar, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ScheduleGeneratorProps {
  tournamentId: string;
  tournament: any;
  pools: any[];
  teams: any[];
  games: any[];
}

export function ScheduleGenerator({ tournamentId, tournament, pools, teams, games }: ScheduleGeneratorProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateScheduleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/tournaments/${tournamentId}/generate-schedule`, {});
    },
    onSuccess: (data: any) => {
      setMessage({ 
        type: 'success', 
        text: `Successfully generated ${data.gamesCreated} games!` 
      });
      toast({
        title: "Schedule Generated",
        description: `Created ${data.gamesCreated} pool play games`,
      });
      // Invalidate games query to refresh the data
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/games`] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to generate schedule';
      setMessage({ 
        type: 'error', 
        text: errorMessage
      });
      toast({
        title: "Schedule Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleGenerateSchedule = () => {
    setMessage({ type: '', text: '' });
    generateScheduleMutation.mutate();
  };

  // Check if tournament has necessary configuration
  const hasConfiguration = tournament?.startDate && tournament?.endDate && tournament?.numberOfDiamonds;
  const hasTeams = teams.length > 0;
  const hasPools = pools.length > 0;
  const poolPlayGames = games.filter((g: any) => !g.isPlayoff);
  const hasExistingGames = poolPlayGames.length > 0;

  // Calculate some stats
  const totalTeams = teams.length;
  const teamsPerPool = hasPools ? Math.floor(totalTeams / pools.length) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: 'var(--field-green)' }} />
            Generate Pool Play Schedule
          </CardTitle>
          <CardDescription>
            Automatically generate a complete pool play schedule based on your tournament configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Overview */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg" style={{ borderColor: hasConfiguration ? 'var(--field-green)' : 'var(--clay-red)' }}>
              <div className="flex items-start gap-3">
                {hasConfiguration ? (
                  <CheckCircle2 className="w-5 h-5 mt-0.5" style={{ color: 'var(--field-green)' }} />
                ) : (
                  <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--clay-red)' }} />
                )}
                <div>
                  <h4 className="font-semibold text-sm mb-1">Tournament Configuration</h4>
                  {hasConfiguration ? (
                    <div className="text-sm text-[var(--text-secondary)] space-y-1">
                      <p>Start Date: {tournament.startDate}</p>
                      <p>End Date: {tournament.endDate}</p>
                      <p>Diamonds: {tournament.numberOfDiamonds}</p>
                      {tournament.minGameGuarantee && <p>Min Games: {tournament.minGameGuarantee} per team</p>}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Tournament needs dates and diamond configuration
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border rounded-lg" style={{ borderColor: hasTeams && hasPools ? 'var(--field-green)' : 'var(--clay-red)' }}>
              <div className="flex items-start gap-3">
                {hasTeams && hasPools ? (
                  <CheckCircle2 className="w-5 h-5 mt-0.5" style={{ color: 'var(--field-green)' }} />
                ) : (
                  <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: 'var(--clay-red)' }} />
                )}
                <div>
                  <h4 className="font-semibold text-sm mb-1">Teams & Pools</h4>
                  {hasTeams && hasPools ? (
                    <div className="text-sm text-[var(--text-secondary)] space-y-1">
                      <p>Total Teams: {totalTeams}</p>
                      <p>Pools: {pools.length}</p>
                      <p>Avg per Pool: ~{teamsPerPool} teams</p>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-secondary)]">
                      {!hasTeams && 'No teams imported yet'}
                      {hasTeams && !hasPools && 'No pools created yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Existing Games Warning */}
          {hasExistingGames && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This tournament already has {poolPlayGames.length} pool play games. Generating a new schedule may create duplicates.
                Consider deleting existing games first if you want to regenerate the complete schedule.
              </AlertDescription>
            </Alert>
          )}

          {/* Requirements Checklist */}
          {(!hasConfiguration || !hasTeams || !hasPools) && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Requirements to generate schedule:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {!hasConfiguration && <li>Set tournament dates and number of diamonds (edit tournament in Tournaments tab)</li>}
                  {!hasTeams && <li>Import teams via Data Import tab</li>}
                  {!hasPools && <li>Teams must be assigned to pools</li>}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <div className="flex flex-col gap-3">
            <Button
              onClick={handleGenerateSchedule}
              disabled={!hasConfiguration || !hasTeams || !hasPools || generateScheduleMutation.isPending}
              className="w-full md:w-auto text-sm font-semibold"
              style={{ 
                backgroundColor: hasConfiguration && hasTeams && hasPools ? 'var(--field-green)' : 'var(--text-secondary)', 
                color: 'white' 
              }}
              data-testid="button-generate-schedule"
            >
              {generateScheduleMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Schedule...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Generate Pool Play Schedule
                </>
              )}
            </Button>

            {message.text && (
              <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
                {message.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--field-green)' }} />
                ) : message.type === 'error' ? (
                  <AlertCircle className="h-4 w-4" />
                ) : null}
                <AlertDescription className={message.type === 'error' ? '' : 'text-[var(--field-green)]'}>
                  {message.text}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* How It Works */}
          <div className="pt-4 border-t">
            <h4 className="font-semibold text-sm mb-2">How Schedule Generation Works</h4>
            <div className="text-sm text-[var(--text-secondary)] space-y-2">
              <p>1. <strong>Round-Robin:</strong> Each team plays every other team in their pool</p>
              <p>2. <strong>Game Guarantee:</strong> Ensures minimum games per team (if configured)</p>
              <p>3. <strong>Diamond Assignment:</strong> Distributes games across available diamonds</p>
              <p>4. <strong>Time Slots:</strong> Schedules games based on tournament dates and duration</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
