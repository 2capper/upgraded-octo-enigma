import { useState, useEffect } from 'react';
import { Calendar, Loader2, AlertCircle, CheckCircle2, Users, ArrowRight, Shuffle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

type WorkflowStep = 'distribute' | 'review' | 'generate';

export function ScheduleGenerator({ tournamentId, tournament, pools, teams, games }: ScheduleGeneratorProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('distribute');
  const [numberOfPools, setNumberOfPools] = useState('4');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Determine initial step based on current state
  useEffect(() => {
    if (pools.length > 0 && teams.every(t => t.poolId)) {
      setCurrentStep('review');
    } else if (games.filter((g: any) => !g.isPlayoff).length > 0) {
      setCurrentStep('generate');
    }
  }, [pools, teams, games]);

  const autoDistributeMutation = useMutation({
    mutationFn: async (numPools: number) => {
      return await apiRequest('POST', `/api/tournaments/${tournamentId}/auto-distribute-pools`, {
        numberOfPools: numPools
      });
    },
    onSuccess: (data: any) => {
      setMessage({ 
        type: 'success', 
        text: `Successfully distributed ${teams.length} teams across ${data.pools.length} pools!` 
      });
      toast({
        title: "Teams Distributed",
        description: `Created ${data.pools.length} pools with teams evenly distributed`,
      });
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/pools`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/teams`] });
      setCurrentStep('review');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to distribute teams';
      setMessage({ type: 'error', text: errorMessage });
      toast({
        title: "Distribution Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const updateTeamPoolMutation = useMutation({
    mutationFn: async ({ teamId, poolId }: { teamId: string; poolId: string }) => {
      return await apiRequest('PUT', `/api/teams/${teamId}`, { poolId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/teams`] });
      toast({
        title: "Team Updated",
        description: "Team pool assignment updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || 'Failed to update team',
        variant: "destructive",
      });
    }
  });

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
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/games`] });
      setCurrentStep('generate');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to generate schedule';
      setMessage({ type: 'error', text: errorMessage });
      toast({
        title: "Schedule Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  });

  const handleAutoDistribute = () => {
    setMessage({ type: '', text: '' });
    autoDistributeMutation.mutate(parseInt(numberOfPools));
  };

  const handleTeamPoolChange = (teamId: string, newPoolId: string) => {
    updateTeamPoolMutation.mutate({ teamId, poolId: newPoolId });
  };

  const handleGenerateSchedule = () => {
    setMessage({ type: '', text: '' });
    generateScheduleMutation.mutate();
  };

  const hasTeams = teams.length > 0;
  const hasPools = pools.length > 0;
  const allTeamsAssigned = teams.every(t => t.poolId);
  const poolPlayGames = games.filter((g: any) => !g.isPlayoff);
  const hasExistingGames = poolPlayGames.length > 0;

  // Organize teams by pool for display
  const teamsByPool = pools.map(pool => ({
    pool,
    teams: teams.filter(t => t.poolId === pool.id)
  }));

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Generation Workflow</CardTitle>
          <CardDescription>Follow these steps to create your tournament schedule</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            <div className={`flex items-center gap-2 ${currentStep === 'distribute' ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'distribute' ? 'bg-field-green text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="font-semibold">Distribute</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${currentStep === 'review' ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'review' ? 'bg-field-green text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="font-semibold">Review</span>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${currentStep === 'generate' ? 'opacity-100' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'generate' ? 'bg-field-green text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="font-semibold">Generate</span>
            </div>
          </div>

          {message.text && (
            <Alert variant={message.type === 'error' ? 'destructive' : 'default'} className="mb-4">
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
        </CardContent>
      </Card>

      {/* Step 1: Auto-Distribute */}
      {currentStep === 'distribute' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shuffle className="w-5 h-5" style={{ color: 'var(--field-green)' }} />
              Step 1: Distribute Teams Across Pools
            </CardTitle>
            <CardDescription>
              Automatically create pools and evenly distribute your {teams.length} teams
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasTeams && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No teams found. Please import teams using the Data Import tab before distributing them into pools.
                </AlertDescription>
              </Alert>
            )}

            {hasTeams && (
              <>
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <Label htmlFor="numberOfPools">Number of Pools</Label>
                    <Input
                      id="numberOfPools"
                      type="number"
                      min="1"
                      max="8"
                      value={numberOfPools}
                      onChange={(e) => setNumberOfPools(e.target.value)}
                      data-testid="input-number-of-pools"
                    />
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      {teams.length} teams ÷ {numberOfPools} pools = ~{Math.ceil(teams.length / parseInt(numberOfPools))} teams per pool
                    </p>
                  </div>
                  <Button
                    onClick={handleAutoDistribute}
                    disabled={!hasTeams || autoDistributeMutation.isPending}
                    style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
                    data-testid="button-auto-distribute"
                  >
                    {autoDistributeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Distributing...
                      </>
                    ) : (
                      <>
                        <Shuffle className="w-4 h-4 mr-2" />
                        Auto-Distribute Teams
                      </>
                    )}
                  </Button>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-2">What This Does</h4>
                  <ul className="text-sm text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                    <li>Creates {numberOfPools} pools (Pool A, Pool B, etc.)</li>
                    <li>Distributes teams evenly using round-robin assignment</li>
                    <li>Allows you to review and adjust assignments before generating the schedule</li>
                  </ul>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Adjust */}
      {currentStep === 'review' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: 'var(--field-green)' }} />
              Step 2: Review Pool Assignments
            </CardTitle>
            <CardDescription>
              Review team distribution and make adjustments if needed
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {teamsByPool.map(({ pool, teams: poolTeams }) => (
                <div key={pool.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: 'var(--field-green)' }}>
                      {poolTeams.length}
                    </div>
                    {pool.name}
                  </h3>
                  <div className="space-y-2">
                    {poolTeams.map((team: any) => (
                      <div key={team.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{team.name}</span>
                        <Select
                          value={team.poolId}
                          onValueChange={(newPoolId) => handleTeamPoolChange(team.id, newPoolId)}
                        >
                          <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-pool-${team.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {pools.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('distribute')}
                data-testid="button-back-to-distribute"
              >
                Back to Distribute
              </Button>
              <Button
                onClick={() => setCurrentStep('generate')}
                disabled={!allTeamsAssigned}
                style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
                data-testid="button-proceed-to-generate"
              >
                Proceed to Generate Schedule
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generate Schedule */}
      {currentStep === 'generate' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" style={{ color: 'var(--field-green)' }} />
              Step 3: Generate Pool Play Schedule
            </CardTitle>
            <CardDescription>
              Create the complete game schedule based on your pool assignments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Tournament Configuration Summary */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Tournament Setup</h4>
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                  <p>Dates: {tournament?.startDate} to {tournament?.endDate}</p>
                  <p>Diamonds: {tournament?.numberOfDiamonds || 'Not configured'}</p>
                  {tournament?.minGameGuarantee && <p>Min Games: {tournament.minGameGuarantee} per team</p>}
                </div>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-semibold text-sm mb-2">Pool Distribution</h4>
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                  <p>Total Teams: {teams.length}</p>
                  <p>Pools: {pools.length}</p>
                  <p>Teams per Pool: {teamsByPool.map(p => p.teams.length).join(', ')}</p>
                </div>
              </div>
            </div>

            {hasExistingGames && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This tournament already has {poolPlayGames.length} pool play games. Generating a new schedule may create duplicates.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setCurrentStep('review')}
                data-testid="button-back-to-review"
              >
                Back to Review
              </Button>
              <Button
                onClick={handleGenerateSchedule}
                disabled={generateScheduleMutation.isPending || !tournament?.numberOfDiamonds}
                style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
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
            </div>

            {hasExistingGames && (
              <div className="pt-4 border-t">
                <h4 className="font-semibold text-sm mb-2">Existing Games</h4>
                <p className="text-sm text-[var(--text-secondary)]">
                  {poolPlayGames.length} pool play games already scheduled. View them in the "Edit Games" tab.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
