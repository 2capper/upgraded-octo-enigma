import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { DragScheduleBuilder } from './drag-schedule-builder';
import { PoolAssignment } from './pool-assignment';
import type { Team, Pool, AgeDivision } from '@shared/schema';

interface ScheduleGeneratorProps {
  tournamentId: string;
  tournament: any;
}

// Ref type for scroll target
interface ScrollTargetRef {
  scrollIntoView: (options?: ScrollIntoViewOptions) => void;
}

export function ScheduleGenerator({ tournamentId, tournament }: ScheduleGeneratorProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const schedulerRef = useRef<HTMLDivElement>(null);
  
  // Function to scroll to scheduler
  const scrollToScheduler = () => {
    setTimeout(() => {
      schedulerRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }, 300); // Small delay to let queries refresh
  };
  
  // Fetch teams, pools, and age divisions
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/tournaments', tournamentId, 'teams'],
  });
  
  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ['/api/tournaments', tournamentId, 'pools'],
  });
  
  const { data: ageDivisions = [] } = useQuery<AgeDivision[]>({
    queryKey: ['/api/tournaments', tournamentId, 'age-divisions'],
  });
  
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  
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
        // Include teams that: have no pool, have a pool matching the division, have an unassigned pool, or match division by name
        return !t.poolId || teamPool?.ageDivisionId === selectedDivision || teamPool?.ageDivisionId === null || t.division === ageDivisions.find((d: AgeDivision) => d.id === selectedDivision)?.name;
      })
    : teams;
    
  const filteredPools = selectedDivision
    ? pools.filter((p: Pool) => (p.ageDivisionId === selectedDivision || p.ageDivisionId === null) && !p.id.includes('_pool_temp_'))
    : pools.filter((p: Pool) => !p.id.includes('_pool_temp_'));
  
  const currentDivision = ageDivisions.find((d: AgeDivision) => d.id === selectedDivision);

  // Update division default game duration
  const updateDivisionDuration = useMutation({
    mutationFn: async ({ divisionId, duration }: { divisionId: string; duration: number }) => {
      return await apiRequest('PUT', `/api/age-divisions/${divisionId}`, { defaultGameDuration: duration });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId, 'age-divisions'] });
      toast({
        title: "Default Duration Updated",
        description: "New games will use the updated duration",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || 'Failed to update default duration',
        variant: "destructive",
      });
    }
  });

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
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between max-w-md mx-auto">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-gray-500" />
                    <Label className="text-sm text-gray-700 dark:text-gray-300">Default Game Duration:</Label>
                  </div>
                  <Select 
                    value={String(currentDivision.defaultGameDuration || 90)} 
                    onValueChange={(value) => {
                      updateDivisionDuration.mutate({ 
                        divisionId: currentDivision.id, 
                        duration: Number(value) 
                      });
                    }}
                    data-testid="select-division-default-duration"
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="60">60 min</SelectItem>
                      <SelectItem value="75">75 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                      <SelectItem value="105">105 min</SelectItem>
                      <SelectItem value="120">120 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                  New games will default to this duration when placed on the schedule grid
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Pool Assignment */}
      {selectedDivision && (
        <PoolAssignment 
          teams={filteredTeams}
          pools={pools}
          tournamentId={tournamentId}
          divisionId={selectedDivision || undefined}
          tournament={tournament}
          onMatchupsGenerated={scrollToScheduler}
        />
      )}
      
      {/* Drag-and-Drop Schedule Builder */}
      <div ref={schedulerRef}>
        {selectedDivision ? (
          <DragScheduleBuilder
            tournamentId={tournamentId}
            divisionId={selectedDivision}
          />
        ) : (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 h-4" />
              <AlertDescription>
                Please select an age division above to start building your schedule.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
        )}
      </div>
    </div>
  );
}
