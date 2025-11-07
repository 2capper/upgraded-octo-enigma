import { useState, useEffect, useRef } from 'react';
import { Calendar, Loader2, AlertCircle, CheckCircle2, Users, ArrowRight, Shuffle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Team, Pool, AgeDivision, Game, Diamond } from '@shared/schema';

interface ScheduleGeneratorProps {
  tournamentId: string;
  tournament: any;
}

type WorkflowStep = 'distribute' | 'review' | 'generate';

interface Violation {
  gameId: string;
  teamId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export function ScheduleGenerator({ tournamentId, tournament }: ScheduleGeneratorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch teams, pools, games, and age divisions directly in this component
  const { data: teams = [], isLoading: teamsLoading } = useQuery<Team[]>({
    queryKey: [`/api/tournaments/${tournamentId}/teams`],
  });
  
  const { data: pools = [], isLoading: poolsLoading } = useQuery<Pool[]>({
    queryKey: [`/api/tournaments/${tournamentId}/pools`],
  });
  
  const { data: games = [], isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: [`/api/tournaments/${tournamentId}/games`],
  });
  
  const { data: ageDivisions = [] } = useQuery<AgeDivision[]>({
    queryKey: [`/api/tournaments/${tournamentId}/age-divisions`],
  });
  
  // Fetch diamonds for the organization
  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: ['/api/organizations', tournament?.organizationId, 'diamonds'],
    enabled: !!tournament?.organizationId,
  });
  
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('distribute');
  const [numberOfPools, setNumberOfPools] = useState('4');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [draftGames, setDraftGames] = useState<any[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const manualNavigation = useRef(false);
  
  // Reset manual navigation flag after step change completes
  useEffect(() => {
    if (manualNavigation.current) {
      const timer = setTimeout(() => {
        manualNavigation.current = false;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);
  
  // Auto-select first division if only one exists
  useEffect(() => {
    if (ageDivisions.length === 1 && !selectedDivision) {
      setSelectedDivision(ageDivisions[0].id);
    }
  }, [ageDivisions, selectedDivision]);
  
  // Filter teams and pools by selected division
  const filteredTeams = selectedDivision 
    ? teams.filter((t: Team) => {
        const teamPool = pools.find((p: Pool) => p.id === t.poolId);
        return teamPool?.ageDivisionId === selectedDivision || t.division === ageDivisions.find((d: AgeDivision) => d.id === selectedDivision)?.name;
      })
    : teams;
    
  const filteredPools = selectedDivision
    ? pools.filter((p: Pool) => p.ageDivisionId === selectedDivision && !p.id.includes('_pool_temp_'))
    : pools.filter((p: Pool) => !p.id.includes('_pool_temp_'));
  
  const currentDivision = ageDivisions.find((d: AgeDivision) => d.id === selectedDivision);

  // Determine initial step based on current state
  useEffect(() => {
    // Skip if user has manually navigated
    if (manualNavigation.current) {
      return;
    }
    
    // Ignore temporary pools when determining the step - they should be replaced with real pools
    const realPools = filteredPools.filter((p: Pool) => !p.id.includes('_pool_temp_'));
    
    // Priority: games > pools > distribute
    const divisionGames = selectedDivision 
      ? games.filter((g: Game) => !g.isPlayoff && realPools.some((p: Pool) => p.id === g.poolId))
      : games.filter((g: Game) => !g.isPlayoff);
      
    if (divisionGames.length > 0) {
      setCurrentStep('generate');
    } else if (realPools.length > 0 && filteredTeams.every((t: Team) => t.poolId)) {
      setCurrentStep('review');
    }
    // If neither condition is met, stay at 'distribute' (default state)
  }, [filteredPools, filteredTeams, games, selectedDivision]);

  const autoDistributeMutation = useMutation({
    mutationFn: async (numPools: number) => {
      if (!selectedDivision) {
        throw new Error('Please select a division first');
      }
      return await apiRequest('POST', `/api/tournaments/${tournamentId}/auto-distribute-pools`, {
        numberOfPools: numPools,
        divisionId: selectedDivision
      });
    },
    onSuccess: (data: any) => {
      const poolCount = data?.pools?.length || parseInt(numberOfPools);
      const divisionName = currentDivision?.name || 'selected division';
      setMessage({ 
        type: 'success', 
        text: `Successfully distributed ${filteredTeams.length} ${divisionName} teams across ${poolCount} pools!` 
      });
      toast({
        title: "Teams Distributed",
        description: `Created ${poolCount} pools for ${divisionName} with teams evenly distributed`,
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
    onSuccess: async () => {
      // Force immediate refetch of teams data
      await queryClient.refetchQueries({ queryKey: [`/api/tournaments/${tournamentId}/teams`] });
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
      if (!selectedDivision) {
        throw new Error('Please select a division first');
      }
      const response = await apiRequest('POST', `/api/tournaments/${tournamentId}/generate-schedule`, {
        divisionId: selectedDivision
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log('Generate schedule response:', data);
      console.log('Draft games array:', data.draftGames);
      console.log('Games count:', data.gamesCount);
      console.log('Violations:', data.violations);
      
      setDraftGames(data.draftGames || []);
      setViolations(data.violations || []);
      
      const violationCount = data.violationsCount || data.violations?.length || 0;
      const hasViolations = violationCount > 0;
      
      setMessage({ 
        type: hasViolations ? 'info' : 'success', 
        text: hasViolations 
          ? `Draft schedule ready with ${violationCount} constraint violation(s). Review carefully before committing.`
          : `Draft schedule ready! Review ${data.gamesCount || 0} games before committing.`
      });
      
      toast({
        title: hasViolations ? "Draft Schedule Ready (with violations)" : "Draft Schedule Ready",
        description: hasViolations
          ? `Generated ${data.gamesCount || 0} games with ${violationCount} violations. Review before committing.`
          : `Generated ${data.gamesCount || 0} games. Review and commit when ready.`,
        variant: hasViolations ? "destructive" : "default",
      });
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

  const commitScheduleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/tournaments/${tournamentId}/commit-schedule`, {
        draftGames
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setMessage({ 
        type: 'success', 
        text: `Successfully committed ${data.gamesCreated} games to the schedule!` 
      });
      toast({
        title: "Schedule Committed",
        description: `Saved ${data.gamesCreated} pool play games`,
      });
      // Invalidate all relevant queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/games`] });
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}`] });
      setDraftGames([]);
      setViolations([]);
      setCurrentStep('generate');
    },
    onError: (error: any) => {
      const errorMessage = error.message || 'Failed to commit schedule';
      setMessage({ type: 'error', text: errorMessage });
      toast({
        title: "Commit Failed",
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
    setDraftGames([]);
    setViolations([]);
    generateScheduleMutation.mutate();
  };

  const handleCommitSchedule = () => {
    setMessage({ type: '', text: '' });
    commitScheduleMutation.mutate();
  };

  const hasTeams = filteredTeams.length > 0;
  const hasPools = filteredPools.length > 0;
  const allTeamsAssigned = filteredTeams.every((t: Team) => t.poolId);
  const poolPlayGames = games.filter((g: Game) => !g.isPlayoff);
  const hasExistingGames = poolPlayGames.length > 0;

  // Organize teams by pool for display
  const teamsByPool = filteredPools.map((pool: Pool) => ({
    pool,
    teams: filteredTeams.filter((t: Team) => t.poolId === pool.id)
  }));

  return (
    <div className="space-y-6">
      {/* Division Selector */}
      {ageDivisions.length > 1 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-4 flex-wrap">
              <Button
                onClick={() => setSelectedDivision(null)}
                variant={selectedDivision === null ? "default" : "outline"}
                style={{
                  backgroundColor: selectedDivision === null ? 'var(--field-green)' : 'transparent',
                  color: selectedDivision === null ? 'white' : 'var(--field-green)',
                }}
                data-testid="button-all-divisions"
              >
                All Divisions
              </Button>
              {ageDivisions.map((division: AgeDivision) => (
                <Button
                  key={division.id}
                  onClick={() => setSelectedDivision(division.id)}
                  variant={selectedDivision === division.id ? "default" : "outline"}
                  style={{
                    backgroundColor: selectedDivision === division.id ? 'var(--field-green)' : 'transparent',
                    color: selectedDivision === division.id ? 'white' : 'var(--field-green)',
                  }}
                  data-testid={`button-division-${division.id}`}
                >
                  {division.name}
                </Button>
              ))}
            </div>
            {selectedDivision && currentDivision && (
              <p className="text-center text-sm text-gray-600 mt-4">
                Managing schedule for <span className="font-semibold">{currentDivision.name}</span> division
              </p>
            )}
          </CardContent>
        </Card>
      )}
      
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
              Automatically create pools and evenly distribute your {filteredTeams.length} {currentDivision ? currentDivision.name : ''} teams
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedDivision && ageDivisions.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please select a division above before distributing teams into pools.
                </AlertDescription>
              </Alert>
            )}
            
            {!hasTeams && selectedDivision && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No teams found for {currentDivision?.name}. Please import teams using the Data Import tab.
                </AlertDescription>
              </Alert>
            )}

            {hasTeams && selectedDivision && (
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
                      {filteredTeams.length} teams ÷ {numberOfPools} pools = ~{Math.ceil(filteredTeams.length / parseInt(numberOfPools))} teams per pool
                    </p>
                  </div>
                  <Button
                    onClick={handleAutoDistribute}
                    disabled={!hasTeams || !selectedDivision || autoDistributeMutation.isPending}
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
              {teamsByPool.map(({ pool, teams: poolTeams }: { pool: Pool; teams: Team[] }) => (
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
                            {filteredPools.map((p: Pool) => (
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
                onClick={() => {
                  manualNavigation.current = true;
                  setCurrentStep('distribute');
                }}
                data-testid="button-back-to-distribute"
              >
                Back to Distribute
              </Button>
              <Button
                onClick={() => {
                  manualNavigation.current = true;
                  setCurrentStep('generate');
                }}
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
                <h4 className="font-semibold text-sm mb-2">Pool Distribution{currentDivision ? ` - ${currentDivision.name}` : ''}</h4>
                <div className="text-sm text-[var(--text-secondary)] space-y-1">
                  <p>Total Teams: {filteredTeams.length}</p>
                  <p>Pools: {filteredPools.length}</p>
                  <p>Teams per Pool: {teamsByPool.map((p: { pool: Pool; teams: Team[] }) => p.teams.length).join(', ')}</p>
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

            {/* Draft Games Review Table */}
            {draftGames.length > 0 && (
              <TooltipProvider>
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Draft Schedule Review</h4>
                    <span className="text-sm text-[var(--text-secondary)]">{draftGames.length} games</span>
                  </div>
                  
                  {/* Violations Summary */}
                  {(() => {
                    const errorViolations = violations.filter(v => v.severity === 'error');
                    const warningViolations = violations.filter(v => v.severity === 'warning');
                    const gamesWithErrors = new Set(errorViolations.map(v => v.gameId)).size;
                    const gamesWithWarnings = new Set(warningViolations.map(v => v.gameId)).size;
                    
                    return violations.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-3" data-testid="violations-summary">
                        <div className="p-3 border rounded-lg bg-gray-50">
                          <div className="text-sm font-medium text-gray-600">Total Games</div>
                          <div className="text-2xl font-bold" data-testid="text-total-games">{draftGames.length}</div>
                        </div>
                        {gamesWithErrors > 0 && (
                          <div className="p-3 border border-red-200 rounded-lg bg-red-50">
                            <div className="text-sm font-medium text-red-700">Games with Errors</div>
                            <div className="text-2xl font-bold text-red-600" data-testid="text-error-count">{gamesWithErrors}</div>
                          </div>
                        )}
                        {gamesWithWarnings > 0 && (
                          <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50">
                            <div className="text-sm font-medium text-yellow-700">Games with Warnings</div>
                            <div className="text-2xl font-bold text-yellow-600" data-testid="text-warning-count">{gamesWithWarnings}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <Alert className="bg-green-50 border-green-200" data-testid="alert-schedule-valid">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-700">
                          Schedule looks good! No constraint violations detected.
                        </AlertDescription>
                      </Alert>
                    );
                  })()}
                  
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b sticky top-0">
                          <tr>
                            <th className="text-left p-3 font-semibold">Game</th>
                            <th className="text-left p-3 font-semibold">Date & Time</th>
                            <th className="text-left p-3 font-semibold">Diamond</th>
                            <th className="text-left p-3 font-semibold">Home</th>
                            <th className="text-left p-3 font-semibold">Away</th>
                            <th className="text-left p-3 font-semibold">Pool</th>
                            <th className="text-left p-3 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {draftGames.map((game: any, idx: number) => {
                            const homeTeam = teams.find((t: Team) => t.id === game.homeTeamId);
                            const awayTeam = teams.find((t: Team) => t.id === game.awayTeamId);
                            const pool = pools.find((p: Pool) => p.id === game.poolId);
                            const dateTimeStr = game.date && game.time 
                              ? `${game.date} ${game.time}`
                              : game.dateTime 
                              ? new Date(game.dateTime).toLocaleString()
                              : 'TBD';
                            
                            const diamond = game.diamondId 
                              ? diamonds.find((d: Diamond) => d.id === game.diamondId)
                              : null;
                            const diamondName = diamond ? diamond.name : 'Not Assigned';
                            
                            const gameViolations = violations.filter(v => v.gameId === game.id);
                            const hasErrors = gameViolations.some(v => v.severity === 'error');
                            const hasWarnings = gameViolations.some(v => v.severity === 'warning');
                            const hasViolations = gameViolations.length > 0;
                            
                            const rowClass = hasErrors 
                              ? 'border-b hover:bg-red-50 bg-red-50/30 border-l-4 border-l-red-500'
                              : hasWarnings 
                              ? 'border-b hover:bg-yellow-50 bg-yellow-50/30 border-l-4 border-l-yellow-500'
                              : 'border-b hover:bg-gray-50';
                            
                            return (
                              <tr key={idx} className={rowClass} data-testid={`row-game-${game.id || idx}`}>
                                <td className="p-3" data-testid={`text-game-number-${idx}`}>{game.gameNumber || idx + 1}</td>
                                <td className="p-3" data-testid={`text-datetime-${idx}`}>{dateTimeStr}</td>
                                <td className="p-3" data-testid={`text-diamond-${idx}`}>
                                  <span className={!diamond ? 'text-gray-500 italic' : ''}>
                                    {diamondName}
                                  </span>
                                </td>
                                <td className="p-3" data-testid={`text-home-team-${idx}`}>{homeTeam?.name || 'TBD'}</td>
                                <td className="p-3" data-testid={`text-away-team-${idx}`}>{awayTeam?.name || 'TBD'}</td>
                                <td className="p-3" data-testid={`text-pool-${idx}`}>{pool?.name || 'N/A'}</td>
                                <td className="p-3" data-testid={`status-${idx}`}>
                                  {hasViolations ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="flex items-center gap-1 cursor-help">
                                          {hasErrors ? (
                                            <XCircle className="h-4 w-4 text-red-600" data-testid={`icon-error-${idx}`} />
                                          ) : (
                                            <AlertCircle className="h-4 w-4 text-yellow-600" data-testid={`icon-warning-${idx}`} />
                                          )}
                                          <span className={hasErrors ? 'text-red-600 text-xs font-medium' : 'text-yellow-600 text-xs font-medium'}>
                                            {gameViolations.length} {gameViolations.length === 1 ? 'issue' : 'issues'}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-xs">
                                        <div className="space-y-1">
                                          {gameViolations.map((v, i) => (
                                            <div key={i} className="text-xs">
                                              <span className={v.severity === 'error' ? 'text-red-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                                                {v.severity === 'error' ? 'ERROR' : 'WARNING'}:
                                              </span>{' '}
                                              {v.message}
                                            </div>
                                          ))}
                                        </div>
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <div className="flex items-center gap-1" data-testid={`status-valid-${idx}`}>
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      <span className="text-green-600 text-xs font-medium">Valid</span>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </TooltipProvider>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  manualNavigation.current = true;
                  setCurrentStep('review');
                }}
                data-testid="button-back-to-review"
              >
                Back to Review
              </Button>
              {draftGames.length === 0 ? (
                <Button
                  onClick={handleGenerateSchedule}
                  disabled={generateScheduleMutation.isPending || !tournament?.numberOfDiamonds}
                  style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
                  data-testid="button-generate-schedule"
                >
                  {generateScheduleMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Draft...
                    </>
                  ) : (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Generate Draft Schedule
                    </>
                  )}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDraftGames([]);
                      setViolations([]);
                    }}
                    data-testid="button-cancel-draft"
                  >
                    Cancel Draft
                  </Button>
                  <Button
                    onClick={handleCommitSchedule}
                    disabled={commitScheduleMutation.isPending}
                    style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
                    data-testid="button-commit-schedule"
                  >
                    {commitScheduleMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Committing Schedule...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Commit Schedule to Database
                      </>
                    )}
                  </Button>
                </>
              )}
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
