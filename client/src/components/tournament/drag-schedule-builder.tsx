import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Calendar, MapPin, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Team, Diamond, Pool, Game, Tournament } from '@shared/schema';

// Define UnplacedMatchup type locally since it's not exported from schema
interface UnplacedMatchup {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  poolId: string;
  poolName: string;
  tournamentId: string;
}

interface DragScheduleBuilderProps {
  tournamentId: string;
  divisionId?: string;
}

interface TimeSlot {
  date: string;
  time: string;
}

function DraggableMatchup({ matchup, teams }: { matchup: UnplacedMatchup; teams: Team[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: matchup.id,
    data: matchup,
  });

  const homeTeam = teams.find(t => t.id === matchup.homeTeamId);
  const awayTeam = teams.find(t => t.id === matchup.awayTeamId);

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
      className="p-2 bg-white dark:bg-gray-800 border rounded cursor-grab active:cursor-grabbing hover:border-blue-500 transition-colors"
      data-testid={`matchup-${matchup.id}`}
    >
      <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
        {homeTeam?.name || 'Unknown'} vs {awayTeam?.name || 'Unknown'}
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {matchup.poolName}
      </div>
    </div>
  );
}

function DropZone({ 
  slot, 
  diamond, 
  game,
  onRemove
}: { 
  slot: TimeSlot; 
  diamond: Diamond;
  game?: Game;
  onRemove: (gameId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${slot.date}-${slot.time}-${diamond.id}`,
    data: { date: slot.date, time: slot.time, diamondId: diamond.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[60px] p-2 border-2 border-dashed rounded transition-colors ${
        isOver 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : game
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
            : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50'
      }`}
      data-testid={`dropzone-${slot.date}-${slot.time}-${diamond.id}`}
    >
      {game ? (
        <div className="relative">
          <button
            onClick={() => onRemove(game.id)}
            className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600"
            data-testid={`remove-game-${game.id}`}
          >
            <X className="w-3 h-3" />
          </button>
          <div className="text-xs font-medium text-gray-900 dark:text-gray-100 pr-4">
            Game Placed
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {game.location || 'TBD'}
          </div>
        </div>
      ) : (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
          Drop here
        </div>
      )}
    </div>
  );
}

export function DragScheduleBuilder({ tournamentId, divisionId }: DragScheduleBuilderProps) {
  const { toast } = useToast();
  const [activeMatchup, setActiveMatchup] = useState<UnplacedMatchup | null>(null);
  const [placedMatchupIds, setPlacedMatchupIds] = useState<Set<string>>(new Set());

  // Fetch unplaced matchups
  const { data: matchups = [], isLoading: matchupsLoading, refetch: refetchMatchups } = useQuery<UnplacedMatchup[]>({
    queryKey: ['/api/tournaments', tournamentId, 'matchups', divisionId],
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ['/api/tournaments', tournamentId, 'teams'],
  });

  // Fetch pools
  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ['/api/tournaments', tournamentId, 'pools'],
  });

  // Fetch tournament
  const { data: tournament } = useQuery<Tournament>({
    queryKey: ['/api/tournaments', tournamentId],
  });

  // Fetch diamonds
  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: ['/api/organizations', tournament?.organizationId || '', 'diamonds'],
    enabled: !!tournament?.organizationId,
  });

  // Fetch existing games
  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ['/api/tournaments', tournamentId, 'games'],
  });
  
  // Filter games to only those in the selected division's pools
  const divisionPools = pools.filter(p => !divisionId || p.ageDivisionId === divisionId);
  const divisionPoolIds = new Set(divisionPools.map(p => p.id));
  const existingGames = allGames.filter(g => divisionPoolIds.has(g.poolId));

  // Generate matchups mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/tournaments/${tournamentId}/generate-matchups`, { divisionId });
      const data = await response.json();
      return data.matchups;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/tournaments', tournamentId, 'matchups', divisionId], data);
      setPlacedMatchupIds(new Set()); // Reset placed matchup IDs when regenerating
      toast({
        title: 'Matchups Generated',
        description: `Created ${data.length} matchups ready to place`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Place game mutation
  const placeMutation = useMutation({
    mutationFn: async (gameData: {
      tournamentId: string;
      poolId: string;
      homeTeamId: string;
      awayTeamId: string;
      date: string;
      time: string;
      diamondId: string;
      matchupId: string;
    }) => {
      const response = await apiRequest('POST', '/api/games/place', gameData);
      const data = await response.json();
      return data.game;
    },
    onSuccess: (_, variables) => {
      // Track the matchup ID that was placed (from variables, not state)
      if (variables.matchupId) {
        setPlacedMatchupIds(prev => new Set([...prev, variables.matchupId]));
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId, 'games'] });
      toast({
        title: 'Game Placed',
        description: 'Game successfully scheduled',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cannot Place Game',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Remove game mutation
  const removeMutation = useMutation({
    mutationFn: async (gameId: string) => {
      await apiRequest('DELETE', `/api/games/${gameId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournamentId, 'games'] });
      refetchMatchups(); // Refresh matchups to show removed game as available again
      toast({
        title: 'Game Removed',
        description: 'Game removed from schedule',
      });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    const matchup = event.active.data.current as UnplacedMatchup;
    setActiveMatchup(matchup);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const matchup = event.active.data.current as UnplacedMatchup;
    const dropData = event.over?.data.current as { date: string; time: string; diamondId: string } | undefined;

    if (!matchup || !dropData) {
      setActiveMatchup(null);
      return;
    }

    // Save matchup ID before clearing active matchup
    const matchupId = matchup.id;
    
    placeMutation.mutate({
      tournamentId,
      poolId: matchup.poolId,
      homeTeamId: matchup.homeTeamId,
      awayTeamId: matchup.awayTeamId,
      date: dropData.date,
      time: dropData.time,
      diamondId: dropData.diamondId,
      matchupId: matchupId, // Pass matchup ID for tracking
    });
    
    setActiveMatchup(null);
  };

  // Generate time slots based on tournament dates
  const generateTimeSlots = (): TimeSlot[] => {
    if (!tournament) return [];
    
    const slots: TimeSlot[] = [];
    const start = new Date(tournament.startDate);
    const end = new Date(tournament.endDate);
    
    // Generate slots for each day
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Generate time slots from 9 AM to 5 PM (every 90 minutes)
      for (let hour = 9; hour < 17; hour += 1.5) {
        const h = Math.floor(hour);
        const m = (hour % 1) * 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({ date: dateStr, time: timeStr });
      }
    }
    
    return slots;
  };

  const timeSlots = generateTimeSlots();
  
  // Filter out matchups that have already been placed by their unique matchup IDs
  const unplacedMatchups = matchups.filter(m => !placedMatchupIds.has(m.id));

  // Calculate progress based on placed matchup IDs
  const placedCount = placedMatchupIds.size;
  const progress = matchups.length > 0 ? Math.round((placedCount / matchups.length) * 100) : 0;

  if (matchupsLoading || !tournament) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (matchups.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Drag & Drop Schedule Builder</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Generate matchups, then drag and drop them onto the calendar grid to build your schedule.
            </p>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              data-testid="button-generate-matchups"
            >
              {generateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate Matchups
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        {/* Progress header */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Schedule Progress</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {placedCount} of {matchups.length} games placed ({progress}%)
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{unplacedMatchups.length} unplaced</Badge>
                {placedCount === matchups.length && matchups.length > 0 && (
                  <Badge className="bg-green-500">
                    <Check className="w-3 h-3 mr-1" />
                    Complete
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-12 gap-4">
          {/* Unplaced matchups sidebar */}
          <div className="col-span-3">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-sm">Unplaced Matchups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[600px] overflow-y-auto">
                {unplacedMatchups.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">All games placed!</p>
                ) : (
                  unplacedMatchups.map(matchup => (
                    <DraggableMatchup key={matchup.id} matchup={matchup} teams={teams} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Calendar grid */}
          <div className="col-span-9">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Schedule Grid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border p-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium">
                          Time
                        </th>
                        {diamonds.slice(0, tournament?.selectedDiamondIds?.length || 1).map((diamond: Diamond) => (
                          <th key={diamond.id} className="border p-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {diamond.name}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map(slot => (
                        <tr key={`${slot.date}-${slot.time}`}>
                          <td className="border p-2 text-xs font-medium bg-gray-50 dark:bg-gray-800/50">
                            <div>{slot.date}</div>
                            <div className="text-gray-500">{slot.time}</div>
                          </td>
                          {diamonds.slice(0, tournament?.selectedDiamondIds?.length || 1).map((diamond: Diamond) => {
                            const game = existingGames.find(
                              g => g.date === slot.date && g.time === slot.time && g.diamondId === diamond.id
                            );
                            return (
                              <td key={diamond.id} className="border p-1">
                                <DropZone 
                                  slot={slot} 
                                  diamond={diamond}
                                  game={game}
                                  onRemove={(gameId) => removeMutation.mutate(gameId)}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeMatchup && (
          <div className="p-2 bg-white dark:bg-gray-800 border-2 border-blue-500 rounded shadow-lg">
            <div className="text-xs font-medium">
              {teams.find(t => t.id === activeMatchup.homeTeamId)?.name || 'Unknown'} vs{' '}
              {teams.find(t => t.id === activeMatchup.awayTeamId)?.name || 'Unknown'}
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
