import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { nanoid } from 'nanoid';
import type { Team, Pool } from '@shared/schema';

interface PoolAssignmentProps {
  teams: Team[];
  pools: Pool[];
  tournamentId: string;
  divisionId?: string;
  tournament?: any;
}

function DraggableTeam({ team }: { team: Team }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: team.id,
    data: team,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group flex items-center gap-2 p-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-grab active:cursor-grabbing hover:border-[var(--field-green)] hover:shadow-md transition-all"
      data-testid={`draggable-team-${team.id}`}
    >
      <GripVertical className="w-4 h-4 text-gray-400" />
      <div className="flex-1">
        <div className="font-semibold text-sm text-[var(--deep-navy)] dark:text-white">
          {team.name}
        </div>
        {team.division && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {team.division}
          </div>
        )}
      </div>
    </div>
  );
}

function PoolDropZone({ pool, teams, activeTeam }: { pool: Pool; teams: Team[]; activeTeam: Team | null }) {
  const { setNodeRef, isOver } = useDroppable({
    id: pool.id,
    data: { poolId: pool.id },
  });

  const isValid = isOver && activeTeam !== null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" 
          style={{ backgroundColor: 'var(--field-green)' }}
        >
          {teams.length}
        </div>
        <h3 className="font-semibold text-[var(--deep-navy)] dark:text-white">
          {pool.name}
        </h3>
      </div>
      
      <div
        ref={setNodeRef}
        className={`flex-1 border-2 rounded-lg p-3 space-y-2 min-h-[200px] transition-all ${
          isValid 
            ? 'border-[var(--field-green)] bg-[var(--field-green)]/10 shadow-lg' 
            : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
        }`}
        data-testid={`pool-dropzone-${pool.id}`}
      >
        {teams.length === 0 && !isValid && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-600 italic">
            Drop teams here
          </div>
        )}
        {teams.map((team) => (
          <DraggableTeam key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}

function UnassignedDropZone({ teams, activeTeam }: { teams: Team[]; activeTeam: Team | null }) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'unassigned',
    data: { poolId: null },
  });

  const isValid = isOver && activeTeam !== null && activeTeam.poolId !== null;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-3">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-400 text-white text-sm font-bold"
        >
          {teams.length}
        </div>
        <h3 className="font-semibold text-[var(--deep-navy)] dark:text-white">
          Unassigned Teams
        </h3>
      </div>
      
      <div
        ref={setNodeRef}
        className={`flex-1 border-2 rounded-lg p-3 space-y-2 min-h-[200px] transition-all ${
          isValid 
            ? 'border-[var(--field-green)] bg-[var(--field-green)]/10 shadow-lg' 
            : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
        }`}
        data-testid="unassigned-dropzone"
      >
        {teams.length === 0 && !isValid && (
          <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-600 italic">
            All teams assigned
          </div>
        )}
        {teams.map((team) => (
          <DraggableTeam key={team.id} team={team} />
        ))}
      </div>
    </div>
  );
}

export function PoolAssignment({ teams, pools, tournamentId, divisionId, tournament }: PoolAssignmentProps) {
  const { toast } = useToast();
  const [activeTeam, setActiveTeam] = useState<Team | null>(null);

  // Filter teams by division if specified
  const filteredTeams = divisionId 
    ? teams.filter(t => {
        // Find the pool for this team
        const teamPool = pools.find(p => p.id === t.poolId);
        // Include if team has no pool, pool matches division, or pool is unassigned (null ageDivisionId)
        return !t.poolId || teamPool?.ageDivisionId === divisionId || teamPool?.ageDivisionId === null;
      })
    : teams;

  // Filter pools by division if specified - include unassigned pools (null ageDivisionId)
  // Also filter out temporary pools created during CSV import
  const filteredPools = divisionId 
    ? pools.filter(p => (p.ageDivisionId === divisionId || p.ageDivisionId === null) && !p.id.includes('_pool_temp_'))
    : pools.filter(p => !p.id.includes('_pool_temp_'));

  // Get number of pools from tournament settings
  const numberOfPools = tournament?.numberOfPools || filteredPools.length;

  // Group teams by pool
  // Treat teams in temporary pools as unassigned
  const unassignedTeams = filteredTeams.filter(t => !t.poolId || t.poolId.includes('_pool_temp_'));
  const teamsByPool = filteredPools.map(pool => ({
    pool,
    teams: filteredTeams.filter(t => t.poolId === pool.id),
  }));

  // Update team pool mutation
  const updateTeamMutation = useMutation({
    mutationFn: async ({ teamId, poolId }: { teamId: string; poolId: string | null }) => {
      return await apiRequest('PUT', `/api/teams/${teamId}`, { poolId });
    },
    onSuccess: (_, variables) => {
      // THIS IS THE FIX.
      // We tell React Query the 'teams' data is stale and force
      // a refetch from the database. This is the single source of truth.
      queryClient.invalidateQueries({ 
        queryKey: [`/api/tournaments/${tournamentId}/teams`] 
      });

      toast({
        title: 'Team Updated',
        description: variables.poolId ? 'Team assigned to pool' : 'Team unassigned from pool',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const team = event.active.data.current as Team;
    setActiveTeam(team);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveTeam(null);
      return;
    }

    const team = active.data.current as Team;
    const dropData = over.data.current as { poolId: string | null };

    // Don't do anything if dropped in same pool
    if (team.poolId === dropData.poolId) {
      setActiveTeam(null);
      return;
    }

    // Update team's pool
    updateTeamMutation.mutate({
      teamId: team.id,
      poolId: dropData.poolId,
    });

    setActiveTeam(null);
  };

  // Generate pool name for any index (Pool A-Z, then Pool AA, Pool AB, etc.)
  const getPoolName = (index: number): string => {
    let letter = '';
    if (index < 26) {
      letter = String.fromCharCode(65 + index); // A-Z
    } else {
      // For pools beyond Z, use AA, AB, AC, etc.
      const firstLetter = String.fromCharCode(65 + Math.floor(index / 26) - 1);
      const secondLetter = String.fromCharCode(65 + (index % 26));
      letter = firstLetter + secondLetter;
    }
    return `Pool ${letter}`;
  };

  // Create pools mutation
  const createPoolsMutation = useMutation({
    mutationFn: async () => {
      if (!divisionId) {
        throw new Error('Division ID is required to create pools');
      }
      if (!numberOfPools || numberOfPools === 0) {
        throw new Error('Number of pools must be configured in tournament settings');
      }
      
      const promises = [];
      for (let i = 0; i < numberOfPools; i++) {
        promises.push(
          apiRequest('POST', `/api/tournaments/${tournamentId}/pools`, {
            id: nanoid(),
            name: getPoolName(i),
            ageDivisionId: divisionId,
          })
        );
      }
      return await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/pools`] });
      toast({
        title: 'Pools Created',
        description: `Successfully created ${numberOfPools} pools`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Creation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Generate matchups mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/tournaments/${tournamentId}/generate-matchups`,
        { divisionId },
      );
      const data = await response.json();
      return data.matchups;
    },
    onSuccess: (data) => {
      // Invalidate both matchups and games queries to refetch from database
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'matchups'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'games'] 
      });

      toast({
        title: "Matchups Generated",
        description: `Successfully created matchups for all pools.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: 'var(--field-green)' }} />
            Assign Teams to Pools
          </CardTitle>
          {tournament && (
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              Tournament configured for <Badge variant="outline">{numberOfPools} pools</Badge> · {filteredTeams.length} teams total
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filteredPools.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No pools have been created yet for this division.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  Click below to create {numberOfPools} pools based on your tournament settings.
                </p>
              </div>
              <Button
                onClick={() => createPoolsMutation.mutate()}
                disabled={createPoolsMutation.isPending}
                style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
                data-testid="button-create-pools"
              >
                {createPoolsMutation.isPending ? 'Creating...' : `Create ${numberOfPools} Pools`}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                {/* Unassigned teams sidebar */}
                <div className="lg:col-span-1">
                  <UnassignedDropZone teams={unassignedTeams} activeTeam={activeTeam} />
                </div>

                {/* Pool columns */}
                <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {teamsByPool.map(({ pool, teams: poolTeams }) => (
                    <PoolDropZone 
                      key={pool.id} 
                      pool={pool} 
                      teams={poolTeams}
                      activeTeam={activeTeam}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 flex justify-end">
                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={unassignedTeams.length > 0 || generateMutation.isPending}
                  style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
                  data-testid="button-generate-matchups"
                >
                  {generateMutation.isPending ? "Generating..." : "Lock Pools & Generate Matchups"}
                </Button>
              </div>
              {unassignedTeams.length > 0 && (
                <p className="text-right text-sm text-red-600 mt-2">
                  You must assign all teams to a pool before generating matchups.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <DragOverlay>
        {activeTeam && <DraggableTeam team={activeTeam} />}
      </DragOverlay>
    </DndContext>
  );
}
