import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
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
  const filteredPools = divisionId 
    ? pools.filter(p => p.ageDivisionId === divisionId || p.ageDivisionId === null)
    : pools;

  // Debug logging
  console.log('PoolAssignment Debug:', {
    divisionId,
    totalPools: pools.length,
    filteredPoolsCount: filteredPools.length,
    totalTeams: teams.length,
    filteredTeamsCount: filteredTeams.length,
    pools: pools.map(p => ({ id: p.id, name: p.name, ageDivisionId: p.ageDivisionId })),
    filteredPools: filteredPools.map(p => ({ id: p.id, name: p.name, ageDivisionId: p.ageDivisionId }))
  });

  // Get number of pools from tournament settings
  const numberOfPools = tournament?.numberOfPools || filteredPools.length;

  // Group teams by pool
  const unassignedTeams = filteredTeams.filter(t => !t.poolId);
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
      // Optimistically update teams cache - preserve null for unassigned teams
      queryClient.setQueryData<Team[]>(
        [`/api/tournaments/${tournamentId}/teams`],
        (oldTeams = []) => oldTeams.map(t => 
          t.id === variables.teamId ? { ...t, poolId: variables.poolId as string } : t
        )
      );

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
        </CardContent>
      </Card>

      <DragOverlay>
        {activeTeam && <DraggableTeam team={activeTeam} />}
      </DragOverlay>
    </DndContext>
  );
}
