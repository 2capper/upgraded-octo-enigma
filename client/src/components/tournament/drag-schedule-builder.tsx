import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { DndContext, DragOverlay, useDraggable, useDroppable, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar, MapPin, X, Check, Download, AlertTriangle } from 'lucide-react';
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

function DraggableMatchup({ matchup, teams, pools }: { matchup: UnplacedMatchup; teams: Team[]; pools: Pool[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: matchup.id,
    data: matchup,
  });

  const homeTeam = teams.find(t => t.id === matchup.homeTeamId);
  const awayTeam = teams.find(t => t.id === matchup.awayTeamId);
  const pool = pools.find(p => p.id === matchup.poolId);

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
      className="group p-3 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-grab active:cursor-grabbing hover:border-[var(--field-green)] hover:shadow-md transition-all"
      data-testid={`matchup-${matchup.id}`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-bold text-[var(--deep-navy)] dark:text-white">
          {homeTeam?.name || 'Unknown'}
        </div>
        <div className="text-xs text-gray-500">vs</div>
        <div className="text-sm font-bold text-[var(--deep-navy)] dark:text-white">
          {awayTeam?.name || 'Unknown'}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <Badge variant="outline" className="bg-[var(--field-green)]/10 text-[var(--field-green)] border-[var(--field-green)]/30">
          {pool?.name || matchup.poolName}
        </Badge>
        {homeTeam?.division && (
          <span className="text-gray-600 dark:text-gray-400">{homeTeam.division}</span>
        )}
      </div>
    </div>
  );
}

// Game card component for displaying scheduled games
function GameCard({
  game,
  teams,
  pools,
  allGames,
  timeInterval,
  onRemove,
  onResize,
  showToast,
}: {
  game: Game;
  teams: Team[];
  pools: Pool[];
  allGames: Game[];
  timeInterval: number;
  onRemove: (gameId: string) => void;
  onResize: (gameId: string, newDuration: number) => void;
  showToast: (options: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}) {
  const homeTeam = teams.find(t => t.id === game.homeTeamId);
  const awayTeam = teams.find(t => t.id === game.awayTeamId);
  const pool = pools.find(p => p.id === game.poolId);

  return (
    <div 
      className="relative group h-full"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        const resizeHandle = target.closest('.resize-handle');
        
        if (resizeHandle) {
          e.preventDefault();
          e.stopPropagation();
          const startY = e.clientY;
          const startDuration = game.durationMinutes || 90;
          const pixelsPerMinute = 1.5;
          
          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaMinutes = Math.round(deltaY / pixelsPerMinute / timeInterval) * timeInterval;
            const newDuration = Math.max(timeInterval, Math.min(480, startDuration + deltaMinutes));
            
            if (resizeHandle) {
              const newEndTime = getEndTime(game.time, newDuration);
              resizeHandle.textContent = `${newDuration} min → ${newEndTime}`;
            }
          };
          
          const handleMouseUp = (upEvent: MouseEvent) => {
            const deltaY = upEvent.clientY - startY;
            const deltaMinutes = Math.round(deltaY / pixelsPerMinute / timeInterval) * timeInterval;
            const newDuration = Math.max(timeInterval, Math.min(480, startDuration + deltaMinutes));
            
            if (resizeHandle && newDuration !== startDuration) {
              const newEndTime = getEndTime(game.time, newDuration);
              resizeHandle.textContent = `${newDuration} min → ${newEndTime}`;
            }
            
            if (newDuration !== startDuration) {
              const gameStartMinutes = parseInt(game.time.split(':')[0]) * 60 + parseInt(game.time.split(':')[1]);
              const gameEndMinutes = gameStartMinutes + newDuration;
              
              const hasOverlap = allGames.some(otherGame => {
                if (otherGame.id === game.id || otherGame.diamondId !== game.diamondId || otherGame.date !== game.date) {
                  return false;
                }
                
                const otherStartMinutes = parseInt(otherGame.time.split(':')[0]) * 60 + parseInt(otherGame.time.split(':')[1]);
                const otherEndMinutes = otherStartMinutes + (otherGame.durationMinutes || 90);
                
                return gameEndMinutes > otherStartMinutes && gameStartMinutes < otherEndMinutes;
              });
              
              if (hasOverlap) {
                showToast({
                  title: 'Cannot Resize',
                  description: 'Game would overlap with another game on the same diamond',
                  variant: 'destructive',
                });
              } else {
                onResize(game.id, newDuration);
              }
            }
            
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
          };
          
          document.addEventListener('mousemove', handleMouseMove);
          document.addEventListener('mouseup', handleMouseUp);
        }
      }}
    >
      <button
        onClick={() => onRemove(game.id)}
        className="absolute -top-1 -right-1 p-0.5 bg-[var(--clay-red)] text-white rounded-full hover:bg-red-700 z-10"
        data-testid={`remove-game-${game.id}`}
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--deep-navy)] dark:text-white mb-0.5">
        <span className="truncate">{homeTeam?.name || 'TBD'}</span>
        <span className="text-[10px] text-gray-500 mx-1">vs</span>
        <span className="truncate">{awayTeam?.name || 'TBD'}</span>
      </div>
      <div className="flex items-center justify-between text-xs mb-1">
        <Badge variant="outline" className="text-[10px] bg-[var(--field-green)]/20 text-[var(--field-green)] border-[var(--field-green)]/30 px-1 py-0">
          {pool?.name || 'Pool'}
        </Badge>
        {homeTeam?.division && (
          <span className="text-[10px] text-gray-600 dark:text-gray-400">{homeTeam.division}</span>
        )}
      </div>
      <div 
        className="resize-handle text-center py-0.5 bg-gray-200 dark:bg-gray-700 rounded cursor-ns-resize text-[10px] text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`resize-handle-${game.id}`}
      >
        {game.durationMinutes || 90} min → {getEndTime(game.time, game.durationMinutes || 90)}
      </div>
    </div>
  );
}

// Lightweight drop zone for drag-drop targeting only
function DropZone({ 
  slot, 
  diamond, 
  activeMatchup,
  allGames,
  timeInterval,
  newGameDuration
}: { 
  slot: TimeSlot; 
  diamond: Diamond;
  activeMatchup: UnplacedMatchup | null;
  allGames: Game[];
  timeInterval: number;
  newGameDuration: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${slot.date}-${slot.time}-${diamond.id}`,
    data: { date: slot.date, time: slot.time, diamondId: diamond.id },
  });

  // Check if time slot is within diamond's availability hours
  const isAvailable = isTimeAvailable(slot.time, diamond);

  // Check for conflicts when hovering
  const hasConflict = isOver && activeMatchup && (() => {
    // Block drops on unavailable time slots
    if (!isAvailable) return true;
    
    // Check for games on the same date that might overlap
    const gamesOnSameDate = allGames.filter(g => g.date === slot.date);
    for (const existingGame of gamesOnSameDate) {
      const existingDuration = existingGame.durationMinutes || 90;
      
      // Check if new game would overlap with existing game on same diamond
      if (existingGame.diamondId === diamond.id && 
          timeRangesOverlap(slot.time, newGameDuration, existingGame.time, existingDuration)) {
        return true;
      }
      
      // Check if either team has an overlapping game
      if ((existingGame.homeTeamId === activeMatchup.homeTeamId || 
           existingGame.awayTeamId === activeMatchup.homeTeamId ||
           existingGame.homeTeamId === activeMatchup.awayTeamId || 
           existingGame.awayTeamId === activeMatchup.awayTeamId) &&
          timeRangesOverlap(slot.time, newGameDuration, existingGame.time, existingDuration)) {
        return true;
      }
    }
    return false;
  })();

  const isValid = isOver && !hasConflict;

  return (
    <div
      ref={setNodeRef}
      className={`absolute inset-0 flex items-center justify-center transition-all ${
        activeMatchup ? 'pointer-events-auto' : 'pointer-events-none'
      } ${
        !isAvailable
          ? 'bg-gray-100/50 dark:bg-gray-900/30 opacity-40'
          : hasConflict
            ? 'bg-red-100 dark:bg-red-900/20 animate-shake' 
            : isValid 
              ? 'bg-[var(--field-green)]/10 shadow-inner' 
              : activeMatchup 
                ? 'bg-gray-50/30 dark:bg-gray-800/30'
                : ''
      }`}
      data-testid={`dropzone-${slot.date}-${slot.time}-${diamond.id}`}
    >
      {!isAvailable && activeMatchup ? (
        <div className="text-xs text-gray-400 dark:text-gray-600 italic">
          Unavailable
        </div>
      ) : null}
    </div>
  );
}

// Helper function to check if a time is within diamond availability
function isTimeAvailable(time: string, diamond: Diamond): boolean {
  const [hours, minutes] = time.split(':').map(Number);
  const timeMinutes = hours * 60 + minutes;
  
  const [startHours, startMinutes] = diamond.availableStartTime.split(':').map(Number);
  const startTimeMinutes = startHours * 60 + startMinutes;
  
  const [endHours, endMinutes] = diamond.availableEndTime.split(':').map(Number);
  const endTimeMinutes = endHours * 60 + endMinutes;
  
  return timeMinutes >= startTimeMinutes && timeMinutes < endTimeMinutes;
}

// Helper function to convert time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to calculate end time given start time and duration
function getEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const hours = Math.floor(endMinutes / 60);
  const mins = endMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Helper function to check if two time ranges overlap
function timeRangesOverlap(
  start1: string, 
  duration1: number, 
  start2: string, 
  duration2: number
): boolean {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = start1Minutes + duration1;
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = start2Minutes + duration2;
  
  // Ranges overlap if one starts before the other ends
  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
}

export function DragScheduleBuilder({ tournamentId, divisionId }: DragScheduleBuilderProps) {
  const { toast } = useToast();
  const [activeMatchup, setActiveMatchup] = useState<UnplacedMatchup | null>(null);
  const [placedMatchupIds, setPlacedMatchupIds] = useState<Set<string>>(new Set());
  const [timeInterval, setTimeInterval] = useState<number>(60); // 15, 30, or 60 minutes
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // Selected date for day filter

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

  // Fetch age divisions to get defaultGameDuration
  const { data: ageDivisions = [] } = useQuery<Array<{ id: string; name: string; tournamentId: string; defaultGameDuration: number }>>({
    queryKey: [`/api/tournaments/${tournamentId}/age-divisions`],
  });

  // Get current division's default game duration
  const currentDivision = ageDivisions.find(d => d.id === divisionId);
  const defaultDuration = currentDivision?.defaultGameDuration || 90;

  // Game duration state (can be overridden)
  const [gameDuration, setGameDuration] = useState<number>(defaultDuration);

  // Update gameDuration when division or defaultDuration changes
  useEffect(() => {
    setGameDuration(defaultDuration);
  }, [defaultDuration]);

  // Fetch diamonds
  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: ['/api/organizations', tournament?.organizationId || '', 'diamonds'],
    enabled: !!tournament?.organizationId,
  });

  // Get selected diamonds for this tournament
  const selectedDiamonds = diamonds.filter((d: Diamond) => 
    tournament?.selectedDiamondIds?.includes(d.id)
  );

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
      durationMinutes?: number;
    }) => {
      const response = await apiRequest('POST', '/api/games/place', gameData);
      const data = await response.json();
      return data.game;
    },
    onSuccess: (newGame, variables) => {
      // Track the matchup ID that was placed (from variables, not state)
      if (variables.matchupId) {
        setPlacedMatchupIds(prev => new Set([...Array.from(prev), variables.matchupId]));
      }
      
      // Optimistically update games cache with new game
      queryClient.setQueryData<Game[]>(
        ['/api/tournaments', tournamentId, 'games'],
        (oldGames = []) => [...oldGames, newGame]
      );
      
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
      return gameId;
    },
    onSuccess: (gameId) => {
      // Optimistically remove game from cache
      queryClient.setQueryData<Game[]>(
        ['/api/tournaments', tournamentId, 'games'],
        (oldGames = []) => oldGames.filter(g => g.id !== gameId)
      );
      
      refetchMatchups(); // Refresh matchups to show removed game as available again
      toast({
        title: 'Game Removed',
        description: 'Game removed from schedule',
      });
    },
  });

  // Resize game mutation
  const resizeMutation = useMutation({
    mutationFn: async ({ gameId, durationMinutes }: { gameId: string; durationMinutes: number }) => {
      const response = await apiRequest('PUT', `/api/games/${gameId}`, { durationMinutes });
      return response.json();
    },
    onSuccess: (updatedGame) => {
      // Optimistically update game in cache
      queryClient.setQueryData<Game[]>(
        ['/api/tournaments', tournamentId, 'games'],
        (oldGames = []) => oldGames.map(g => g.id === updatedGame.game.id ? updatedGame.game : g)
      );
      
      toast({
        title: 'Duration Updated',
        description: 'Game duration successfully changed',
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

    // Snap time to nearest interval
    const [hours, minutes] = dropData.time.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const snappedMinutes = Math.round(totalMinutes / timeInterval) * timeInterval;
    const snappedHours = Math.floor(snappedMinutes / 60);
    const snappedMins = snappedMinutes % 60;
    const snappedTime = `${String(snappedHours).padStart(2, '0')}:${String(snappedMins).padStart(2, '0')}`;

    // Check if drop location is within diamond availability hours
    const targetDiamond = diamonds.find(d => d.id === dropData.diamondId);
    if (targetDiamond && !isTimeAvailable(snappedTime, targetDiamond)) {
      toast({
        title: 'Cannot Place Game',
        description: `${targetDiamond.name} is not available at ${snappedTime}. Operating hours: ${targetDiamond.availableStartTime} - ${targetDiamond.availableEndTime}`,
        variant: 'destructive',
      });
      setActiveMatchup(null);
      return;
    }

    // Check for overlapping games
    const gamesOnSameDate = existingGames.filter(g => g.date === dropData.date);
    for (const existingGame of gamesOnSameDate) {
      const existingDuration = existingGame.durationMinutes || 90;
      
      // Check if new game would overlap with existing game on same diamond
      if (existingGame.diamondId === dropData.diamondId && 
          timeRangesOverlap(snappedTime, gameDuration, existingGame.time, existingDuration)) {
        const endTime = getEndTime(snappedTime, gameDuration);
        const existingEndTime = getEndTime(existingGame.time, existingDuration);
        toast({
          title: 'Cannot Place Game',
          description: `This ${gameDuration}-minute game (${snappedTime}-${endTime}) would overlap with an existing game at ${existingGame.time}-${existingEndTime} on ${targetDiamond?.name}`,
          variant: 'destructive',
        });
        setActiveMatchup(null);
        return;
      }
      
      // Check if either team has an overlapping game
      if ((existingGame.homeTeamId === matchup.homeTeamId || 
           existingGame.awayTeamId === matchup.homeTeamId ||
           existingGame.homeTeamId === matchup.awayTeamId || 
           existingGame.awayTeamId === matchup.awayTeamId) &&
          timeRangesOverlap(snappedTime, gameDuration, existingGame.time, existingDuration)) {
        // Find which team(s) actually have the conflict
        const conflictingTeamIds = new Set<string>();
        if (existingGame.homeTeamId === matchup.homeTeamId || existingGame.awayTeamId === matchup.homeTeamId) {
          conflictingTeamIds.add(matchup.homeTeamId);
        }
        if (existingGame.homeTeamId === matchup.awayTeamId || existingGame.awayTeamId === matchup.awayTeamId) {
          conflictingTeamIds.add(matchup.awayTeamId);
        }
        
        const conflictingTeamNames = Array.from(conflictingTeamIds)
          .map(id => teams.find(t => t.id === id)?.name)
          .filter(Boolean)
          .join(' and ');
        
        toast({
          title: 'Cannot Place Game',
          description: `${conflictingTeamNames || 'A team'} already has a game that overlaps with this time slot`,
          variant: 'destructive',
        });
        setActiveMatchup(null);
        return;
      }
    }

    // Save matchup ID before clearing active matchup
    const matchupId = matchup.id;
    
    placeMutation.mutate({
      tournamentId,
      poolId: matchup.poolId,
      homeTeamId: matchup.homeTeamId,
      awayTeamId: matchup.awayTeamId,
      date: dropData.date,
      time: snappedTime, // Use snapped time instead of raw drop time
      diamondId: dropData.diamondId,
      matchupId: matchupId, // Pass matchup ID for tracking
      durationMinutes: gameDuration, // Use division's default or overridden duration
    });
    
    setActiveMatchup(null);
  };

  // Generate time slots based on tournament dates, selected interval, and diamond availability
  const generateTimeSlots = (): TimeSlot[] => {
    if (!tournament) return [];
    
    const slots: TimeSlot[] = [];
    const start = new Date(tournament.startDate);
    const end = new Date(tournament.endDate);
    
    // Get selected diamonds for this tournament
    const selectedDiamonds = diamonds.filter(d => 
      tournament.selectedDiamondIds?.includes(d.id)
    );
    
    // Calculate earliest start time and latest end time across all diamonds
    let earliestStartMinutes = 9 * 60; // Default 9 AM
    let latestEndMinutes = 17 * 60; // Default 5 PM
    
    if (selectedDiamonds.length > 0) {
      earliestStartMinutes = Math.min(...selectedDiamonds.map(d => {
        const [hours, minutes] = d.availableStartTime.split(':').map(Number);
        return hours * 60 + minutes;
      }));
      
      latestEndMinutes = Math.max(...selectedDiamonds.map(d => {
        const [hours, minutes] = d.availableEndTime.split(':').map(Number);
        return hours * 60 + minutes;
      }));
    }
    
    // Generate slots for each day
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      
      // Generate time slots from earliest to latest based on selected interval
      for (let minuteOffset = earliestStartMinutes; minuteOffset < latestEndMinutes; minuteOffset += timeInterval) {
        const h = Math.floor(minuteOffset / 60);
        const m = minuteOffset % 60;
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        slots.push({ date: dateStr, time: timeStr });
      }
    }
    
    return slots;
  };

  const allTimeSlots = generateTimeSlots();
  
  // Get unique dates from time slots
  const uniqueDates = Array.from(new Set(allTimeSlots.map(slot => slot.date))).sort();
  
  // Initialize selected date to first date if not set
  if (selectedDate === null && uniqueDates.length > 0 && tournament) {
    setSelectedDate(uniqueDates[0]);
  }
  
  // Filter time slots by selected date (or show all if no date selected)
  const timeSlots = selectedDate 
    ? allTimeSlots.filter(slot => slot.date === selectedDate)
    : allTimeSlots;
  
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

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (divisionId) {
      params.set('divisionId', divisionId);
    }
    if (selectedDate) {
      params.set('date', selectedDate);
    }
    const url = `/api/tournaments/${tournamentId}/schedule-export${params.toString() ? '?' + params.toString() : ''}`;
    window.open(url, '_blank');
  };

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
              <div className="flex gap-2 items-center">
                {placedCount > 0 && (
                  <Button
                    onClick={handleExportCSV}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    data-testid="button-export-csv"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </Button>
                )}
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
                    <DraggableMatchup key={matchup.id} matchup={matchup} teams={teams} pools={pools} />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Calendar grid */}
          <div className="col-span-9">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between mb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Schedule Grid
                  </CardTitle>
                  <div className="flex items-center gap-4">
                    {uniqueDates.length > 1 && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Day:</Label>
                        <Select value={selectedDate || ''} onValueChange={setSelectedDate} data-testid="select-day">
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueDates.map(date => (
                              <SelectItem key={date} value={date} data-testid={`select-day-${date}`}>
                                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { 
                                  weekday: 'short', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">Game Duration:</Label>
                      <Select value={String(gameDuration)} onValueChange={(value) => setGameDuration(Number(value))} data-testid="select-game-duration">
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60" data-testid="duration-60">60 min</SelectItem>
                          <SelectItem value="75" data-testid="duration-75">75 min</SelectItem>
                          <SelectItem value="90" data-testid="duration-90">90 min</SelectItem>
                          <SelectItem value="105" data-testid="duration-105">105 min</SelectItem>
                          <SelectItem value="120" data-testid="duration-120">120 min</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">Time Interval:</Label>
                      <RadioGroup
                        value={String(timeInterval)}
                        onValueChange={(value) => setTimeInterval(Number(value))}
                        className="flex gap-3"
                        data-testid="radio-time-interval"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="15" id="interval-15" data-testid="radio-interval-15" />
                          <Label htmlFor="interval-15" className="text-xs cursor-pointer">15 min</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="30" id="interval-30" data-testid="radio-interval-30" />
                          <Label htmlFor="interval-30" className="text-xs cursor-pointer">30 min</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem value="60" id="interval-60" data-testid="radio-interval-60" />
                          <Label htmlFor="interval-60" className="text-xs cursor-pointer">60 min</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  {/* Two-column layout: fixed time column + scrollable grid */}
                  <div className="flex">
                    {/* Fixed Time Column */}
                    <div className="flex-shrink-0 w-[120px]">
                      {/* Time header */}
                      <div className="border p-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium flex items-center h-[40px]">
                        Time
                      </div>
                      {/* Time labels */}
                      {timeSlots.map((slot) => (
                        <div 
                          key={`time-${slot.date}-${slot.time}`}
                          className="border border-t-0 p-2 text-xs font-medium bg-gray-50 dark:bg-gray-800/50 flex flex-col justify-center h-[70px]"
                        >
                          <div>{slot.date}</div>
                          <div className="text-gray-500">{slot.time}</div>
                        </div>
                      ))}
                    </div>

                    {/* Scrollable Diamond Grid */}
                    <div className="flex-1 relative">
                      <div 
                        className="grid gap-0 relative"
                        style={{
                          gridTemplateColumns: `repeat(${selectedDiamonds.length}, 1fr)`,
                          gridTemplateRows: `40px repeat(${timeSlots.length}, 70px)`,
                        }}
                      >
                        {/* Diamond headers */}
                        {selectedDiamonds.map((diamond: Diamond) => (
                          <div key={diamond.id} className="border border-l-0 p-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {diamond.name}
                          </div>
                        ))}

                        {/* Empty drop zones grid */}
                        {timeSlots.map((slot) => (
                          <React.Fragment key={`slot-${slot.date}-${slot.time}`}>
                            {selectedDiamonds.map((diamond: Diamond) => (
                              <div 
                                key={`empty-${diamond.id}-${slot.date}-${slot.time}`} 
                                className="border border-t-0 border-l-0 relative"
                              >
                                <DropZone 
                                  slot={slot} 
                                  diamond={diamond}
                                  activeMatchup={activeMatchup}
                                  allGames={existingGames}
                                  timeInterval={timeInterval}
                                  newGameDuration={gameDuration}
                                />
                              </div>
                            ))}
                          </React.Fragment>
                        ))}

                        {/* Placed games as positioned overlays */}
                        {existingGames.map((game) => {
                          const slotIndex = timeSlots.findIndex(s => s.date === game.date && s.time === game.time);
                          const diamondIndex = selectedDiamonds.findIndex(d => d.id === game.diamondId);
                          
                          if (slotIndex === -1 || diamondIndex === -1) return null;
                          
                          const rowSpan = Math.ceil((game.durationMinutes || 90) / timeInterval);
                          const gridRowStart = slotIndex + 2; // +2 for header row
                          const gridColumnStart = diamondIndex + 1; // +1 (no time column here)
                          
                          return (
                            <div
                              key={`game-${game.id}`}
                              className="border-2 border-[var(--field-green)] bg-[var(--field-green)]/5 p-2 rounded-lg"
                              style={{
                                gridRow: `${gridRowStart} / span ${rowSpan}`,
                                gridColumn: gridColumnStart,
                                zIndex: 10,
                              }}
                            >
                              <GameCard 
                                game={game}
                                teams={teams}
                                pools={pools}
                                allGames={existingGames}
                                timeInterval={timeInterval}
                                onRemove={(gameId) => removeMutation.mutate(gameId)}
                                onResize={(gameId, newDuration) => resizeMutation.mutate({ gameId, durationMinutes: newDuration })}
                                showToast={toast}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeMatchup && (
          <DraggableMatchup matchup={activeMatchup} teams={teams} pools={pools} />
        )}
      </DragOverlay>
    </DndContext>
  );
}
