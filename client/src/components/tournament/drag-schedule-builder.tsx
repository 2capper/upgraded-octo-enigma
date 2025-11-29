import React, { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Calendar,
  MapPin,
  X,
  Check,
  Download,
  AlertTriangle,
  GripVertical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Team, Diamond, Pool, Game, Tournament, TournamentDiamondAllocation } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

function DraggableMatchup({
  matchup,
  teams,
  pools,
}: {
  matchup: UnplacedMatchup;
  teams: Team[];
  pools: Pool[];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: matchup.id,
      data: matchup,
    });

  const homeTeam = teams.find((t) => t.id === matchup.homeTeamId);
  const awayTeam = teams.find((t) => t.id === matchup.awayTeamId);
  const pool = pools.find((p) => p.id === matchup.poolId);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group p-3 bg-card dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg cursor-grab active:cursor-grabbing hover:border-[var(--field-green)] hover:shadow-md transition-all touch-manipulation"
      data-testid={`matchup-${matchup.id}`}
      role="button"
      aria-label={`Drag to schedule ${homeTeam?.name || "Unknown"} vs ${awayTeam?.name || "Unknown"}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <GripVertical className="w-4 h-4 text-gray-400 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 flex items-center justify-between min-w-0">
          <div className="text-sm font-bold text-[var(--deep-navy)] dark:text-white truncate">
            {homeTeam?.name || "Unknown"}
          </div>
          <div className="text-xs text-gray-500 px-1 flex-shrink-0">vs</div>
          <div className="text-sm font-bold text-[var(--deep-navy)] dark:text-white truncate">
            {awayTeam?.name || "Unknown"}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs pl-6">
        <Badge
          variant="outline"
          className="bg-[var(--field-green)]/10 text-[var(--field-green)] border-[var(--field-green)]/30"
        >
          {pool?.name || matchup.poolName}
        </Badge>
        {homeTeam?.division && (
          <span className="text-gray-600 dark:text-gray-400">
            {homeTeam.division}
          </span>
        )}
      </div>
    </div>
  );
}

// Draggable wrapper for placed games
// This component encapsulates the useDraggable hook to comply with Rules of Hooks
function DraggableGameCard({
  game,
  gridRowStart,
  gridColumnStart,
  rowSpan,
  teams,
  pools,
  allGames,
  timeInterval,
  onRemove,
  onResize,
  showToast,
  diamonds = [],
}: {
  game: Game;
  gridRowStart: number;
  gridColumnStart: number;
  rowSpan: number;
  teams: Team[];
  pools: Pool[];
  allGames: Game[];
  timeInterval: number;
  onRemove: (gameId: string) => void;
  onResize: (gameId: string, newDuration: number) => void;
  showToast: (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
  diamonds?: Diamond[];
}) {
  // useDraggable hook at component top level (not in loop)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: game.id,
    data: {
      type: 'game',
      game: game,
    },
  });

  const style = transform ? {
    gridRow: `${gridRowStart} / span ${rowSpan}`,
    gridColumn: gridColumnStart,
    zIndex: isDragging ? 12 : 10,
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : {
    gridRow: `${gridRowStart} / span ${rowSpan}`,
    gridColumn: gridColumnStart,
    zIndex: 10,
  };

  return (
    <div
      ref={setNodeRef}
      className="border-2 border-[var(--field-green)] bg-[var(--field-green)]/5 p-2 rounded-lg cursor-grab active:cursor-grabbing"
      style={style}
      {...listeners}
      {...attributes}
    >
      <GameCard
        game={game}
        teams={teams}
        pools={pools}
        allGames={allGames}
        timeInterval={timeInterval}
        onRemove={onRemove}
        onResize={onResize}
        showToast={showToast}
        diamonds={diamonds}
      />
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
  diamonds = [],
}: {
  game: Game;
  teams: Team[];
  pools: Pool[];
  allGames: Game[];
  timeInterval: number;
  onRemove: (gameId: string) => void;
  onResize: (gameId: string, newDuration: number) => void;
  showToast: (options: {
    title: string;
    description: string;
    variant?: "default" | "destructive";
  }) => void;
  diamonds?: Diamond[];
}) {
  const homeTeam = teams.find((t) => t.id === game.homeTeamId);
  const awayTeam = teams.find((t) => t.id === game.awayTeamId);
  const pool = pools.find((p) => p.id === game.poolId);
  const diamond = diamonds.find((d) => d.id === game.diamondId);

  return (
    <div
      className="relative group h-full"
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;

        // Check if the click was on the remove button. If so, DO NOTHING.
        // This lets the button's own onClick event fire.
        if (target.closest('.remove-button')) {
          return;
        }

        const resizeHandle = target.closest(".resize-handle");

        if (resizeHandle) {
          e.preventDefault();
          e.stopPropagation();
          const startY = e.clientY;
          const startDuration = game.durationMinutes || 90;
          const pixelsPerMinute = 1.5;

          const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaMinutes =
              Math.round(deltaY / pixelsPerMinute / timeInterval) *
              timeInterval;
            const newDuration = Math.max(
              timeInterval,
              Math.min(480, startDuration + deltaMinutes),
            );

            if (resizeHandle) {
              const newEndTime = getEndTime(game.time, newDuration);
              resizeHandle.textContent = `${newDuration} min → ${newEndTime}`;
            }
          };

          const handleMouseUp = (upEvent: MouseEvent) => {
            const deltaY = upEvent.clientY - startY;
            const deltaMinutes =
              Math.round(deltaY / pixelsPerMinute / timeInterval) *
              timeInterval;
            const newDuration = Math.max(
              timeInterval,
              Math.min(480, startDuration + deltaMinutes),
            );

            if (resizeHandle && newDuration !== startDuration) {
              const newEndTime = getEndTime(game.time, newDuration);
              resizeHandle.textContent = `${newDuration} min → ${newEndTime}`;
            }

            if (newDuration !== startDuration) {
              const gameStartMinutes =
                parseInt(game.time.split(":")[0]) * 60 +
                parseInt(game.time.split(":")[1]);
              const gameEndMinutes = gameStartMinutes + newDuration;

              const hasOverlap = allGames.some((otherGame) => {
                if (
                  otherGame.id === game.id ||
                  otherGame.diamondId !== game.diamondId ||
                  otherGame.date !== game.date
                ) {
                  return false;
                }

                const otherStartMinutes =
                  parseInt(otherGame.time.split(":")[0]) * 60 +
                  parseInt(otherGame.time.split(":")[1]);
                const otherEndMinutes =
                  otherStartMinutes + (otherGame.durationMinutes || 90);

                return (
                  gameEndMinutes > otherStartMinutes &&
                  gameStartMinutes < otherEndMinutes
                );
              });

              if (hasOverlap) {
                showToast({
                  title: "Cannot Resize",
                  description:
                    "Game would overlap with another game on the same diamond",
                  variant: "destructive",
                });
              } else {
                onResize(game.id, newDuration);
              }
            }

            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
          };

          document.addEventListener("mousemove", handleMouseMove);
          document.addEventListener("mouseup", handleMouseUp);
        }
      }}
    >
      <button
        onClick={() => onRemove(game.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className="remove-button absolute -top-1 -right-1 p-0.5 bg-[var(--clay-red)] text-white rounded-full hover:bg-red-700 z-10"
        data-testid={`remove-game-${game.id}`}
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex items-center justify-between text-xs font-semibold text-[var(--deep-navy)] dark:text-white mb-0.5">
        <span className="truncate">{homeTeam?.name || "TBD"}</span>
        <span className="text-[10px] text-gray-500 mx-1">vs</span>
        <span className="truncate">{awayTeam?.name || "TBD"}</span>
      </div>
      <div className="flex items-center justify-between text-xs mb-1">
        <Badge
          variant="outline"
          className="text-[10px] bg-[var(--field-green)]/20 text-[var(--field-green)] border-[var(--field-green)]/30 px-1 py-0"
        >
          {pool?.name || "Pool"}
        </Badge>
        {homeTeam?.division && (
          <span className="text-[10px] text-gray-600 dark:text-gray-400">
            {homeTeam.division}
          </span>
        )}
      </div>
      {diamond && diamond.status !== 'open' && (
        <div className="mb-1">
          <Badge 
            className={`text-[9px] px-1 py-0 ${
              diamond.status === 'closed' ? 'bg-red-500 text-white' :
              diamond.status === 'delayed' ? 'bg-yellow-500 text-white' :
              'bg-gray-500 text-white'
            }`}
            data-testid={`diamond-status-${diamond.status}`}
          >
            {diamond.status === 'closed' ? '🔴 Closed' :
             diamond.status === 'delayed' ? '⚠️ Delayed' :
             '❓ TBD'}
          </Badge>
          {diamond.statusMessage && (
            <div className="text-[9px] text-gray-600 dark:text-gray-400 italic mt-0.5">
              {diamond.statusMessage}
            </div>
          )}
        </div>
      )}
      <div
        className="resize-handle text-center py-0.5 bg-gray-200 dark:bg-gray-700 rounded cursor-ns-resize text-[10px] text-gray-600 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`resize-handle-${game.id}`}
      >
        {game.durationMinutes || 90} min →{" "}
        {getEndTime(game.time, game.durationMinutes || 90)}
      </div>
    </div>
  );
}

// Single droppable zone component that covers the entire grid
function GridDropZone({
  activeMatchup,
  allGames,
  timeInterval,
  newGameDuration,
  getSlotFromCoordinates,
  setHoveredCell,
  timeSlots,
  selectedDiamonds,
}: {
  activeMatchup: UnplacedMatchup | null;
  allGames: Game[];
  timeInterval: number;
  newGameDuration: number;
  getSlotFromCoordinates: (
    x: number,
    y: number,
  ) => {
    timeSlot: TimeSlot;
    diamond: Diamond;
    timeIndex: number;
    diamondIndex: number;
  } | null;
  setHoveredCell: (
    cell: { timeIndex: number; diamondIndex: number } | null,
  ) => void;
  timeSlots: TimeSlot[];
  selectedDiamonds: Diamond[];
}) {
  const { setNodeRef } = useDroppable({
    id: "calendar-grid",
  });

  const [dragPosition, setDragPosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);

  React.useEffect(() => {
    if (!activeMatchup) {
      setHoveredCell(null);
      setDragPosition(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const cellInfo = getSlotFromCoordinates(e.clientX, e.clientY);
      if (cellInfo) {
        setHoveredCell({
          timeIndex: cellInfo.timeIndex,
          diamondIndex: cellInfo.diamondIndex,
        });
      } else {
        setHoveredCell(null);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [activeMatchup, getSlotFromCoordinates, setHoveredCell]);

  if (!activeMatchup) return null;

  return (
    <div
      ref={setNodeRef}
      className="absolute inset-0 pointer-events-auto"
      style={{
        gridRow: `1 / -1`,
        gridColumn: `1 / -1`,
        zIndex: 5,
      }}
    />
  );
}

// Helper function to check if a time is within diamond availability
function isTimeAvailable(time: string, diamond: Diamond): boolean {
  const [hours, minutes] = time.split(":").map(Number);
  const timeMinutes = hours * 60 + minutes;

  const [startHours, startMinutes] = diamond.availableStartTime
    .split(":")
    .map(Number);
  const startTimeMinutes = startHours * 60 + startMinutes;

  const [endHours, endMinutes] = diamond.availableEndTime
    .split(":")
    .map(Number);
  const endTimeMinutes = endHours * 60 + endMinutes;

  return timeMinutes >= startTimeMinutes && timeMinutes < endTimeMinutes;
}

// Helper function to convert time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Helper function to calculate end time given start time and duration
function getEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const hours = Math.floor(endMinutes / 60);
  const mins = endMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

// Helper function to check if two time ranges overlap
function timeRangesOverlap(
  start1: string,
  duration1: number,
  start2: string,
  duration2: number,
): boolean {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = start1Minutes + duration1;
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = start2Minutes + duration2;

  // Ranges overlap if one starts before the other ends
  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
}

export function DragScheduleBuilder({
  tournamentId,
  divisionId,
}: DragScheduleBuilderProps) {
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  const [activeMatchup, setActiveMatchup] = useState<UnplacedMatchup | null>(
    null,
  );
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [placedMatchupIds, setPlacedMatchupIds] = useState<Set<string>>(
    new Set(),
  );
  const [timeInterval, setTimeInterval] = useState<number>(60); // 15, 30, or 60 minutes
  const [selectedDate, setSelectedDate] = useState<string | null>(null); // Selected date for day filter
  const [hoveredCell, setHoveredCell] = useState<{
    timeIndex: number;
    diamondIndex: number;
  } | null>(null);

  // Fetch unplaced matchups from database
  const {
    data: allMatchups = [],
    isLoading: matchupsLoading,
    refetch: refetchMatchups,
  } = useQuery<UnplacedMatchup[]>({
    queryKey: ["/api/tournaments", tournamentId, "matchups"],
  });

  // Fetch teams
  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/tournaments", tournamentId, "teams"],
  });

  // Fetch pools
  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["/api/tournaments", tournamentId, "pools"],
  });

  // Fetch tournament
  const { data: tournament } = useQuery<Tournament>({
    queryKey: ["/api/tournaments", tournamentId],
  });

  // Fetch age divisions to get defaultGameDuration
  const { data: ageDivisions = [] } = useQuery<
    Array<{
      id: string;
      name: string;
      tournamentId: string;
      defaultGameDuration: number;
    }>
  >({
    queryKey: [`/api/tournaments/${tournamentId}/age-divisions`],
  });

  // Get current division's default game duration
  const currentDivision = ageDivisions.find((d) => d.id === divisionId);
  const defaultDuration = currentDivision?.defaultGameDuration || 90;

  // Game duration state (can be overridden)
  const [gameDuration, setGameDuration] = useState<number>(defaultDuration);

  // Update gameDuration when division or defaultDuration changes
  useEffect(() => {
    setGameDuration(defaultDuration);
  }, [defaultDuration]);

  // Fetch diamonds
  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: [
      "/api/organizations",
      tournament?.organizationId || "",
      "diamonds",
    ],
    enabled: !!tournament?.organizationId,
  });

  // Get selected diamonds for this tournament
  const selectedDiamonds = diamonds.filter((d: Diamond) =>
    tournament?.selectedDiamondIds?.includes(d.id),
  );

  // Fetch existing games
  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/tournaments", tournamentId, "games"],
  });

  // Fetch allocations for the tournament
  const { data: allocations = [] } = useQuery<TournamentDiamondAllocation[]>({
    queryKey: ["/api/tournaments", tournamentId, "allocations"],
  });

  // State for conflict override dialog
  const [conflictDialog, setConflictDialog] = useState<{
    open: boolean;
    conflicts: {
      errors: string[];
      warnings: string[];
      conflictTypes: string[];
    };
    pendingMove: {
      gameId: string;
      date: string;
      time: string;
      diamondId: string;
    } | null;
  }>({
    open: false,
    conflicts: { errors: [], warnings: [], conflictTypes: [] },
    pendingMove: null,
  });

  // Filter games to only those in the selected division's pools (memoized to prevent re-renders)
  const existingGames = useMemo(() => {
    const divisionPools = pools.filter(
      (p) => !divisionId || p.ageDivisionId === divisionId,
    );
    const divisionPoolIds = new Set(divisionPools.map((p) => p.id));
    return allGames.filter((g) => divisionPoolIds.has(g.poolId));
  }, [allGames, pools, divisionId]);

  // Filter matchups by division (client-side)
  const matchups = useMemo(() => {
    if (!divisionId) return allMatchups;
    const divisionPools = pools.filter((p) => p.ageDivisionId === divisionId);
    const divisionPoolIds = new Set(divisionPools.map((p) => p.id));
    return allMatchups.filter((m) => divisionPoolIds.has(m.poolId));
  }, [allMatchups, pools, divisionId]);

  // Initialize placedMatchupIds from existing games (runs only when games actually change)
  useEffect(() => {
    // Extract matchup IDs from existing games
    const idsFromGames = new Set(
      existingGames.map((game) => game.matchupId).filter(Boolean) as string[],
    );

    // Update the state to reflect the games that are already placed
    // Because existingGames is memoized, this only runs when game data actually changes
    setPlacedMatchupIds(idsFromGames);
  }, [existingGames]);

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
      const response = await apiRequest("POST", "/api/games/place", gameData);
      const data = await response.json();
      return data.game;
    },
    onSuccess: (newGame) => {
      // Invalidate BOTH queries to refetch from database
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'games'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'matchups'] 
      });

      toast({
        title: "Game Placed",
        description: "Game successfully scheduled",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Place Game",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Remove game mutation
  const removeMutation = useMutation({
    mutationFn: async (gameId: string) => {
      await apiRequest("DELETE", `/api/games/${gameId}`);
      return gameId;
    },
    onSuccess: (gameId) => {
      // Invalidate BOTH queries to refetch from database
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'games'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'matchups'] 
      });

      toast({
        title: "Game Removed",
        description: "Matchup returned to the unplaced list.",
      });
    },
  });

  // Resize game mutation
  const resizeMutation = useMutation({
    mutationFn: async ({
      gameId,
      durationMinutes,
    }: {
      gameId: string;
      durationMinutes: number;
    }) => {
      const response = await apiRequest("PUT", `/api/games/${gameId}`, {
        durationMinutes,
      });
      return response.json();
    },
    onSuccess: (updatedGame) => {
      // Optimistically update game in cache
      queryClient.setQueryData<Game[]>(
        ["/api/tournaments", tournamentId, "games"],
        (oldGames = []) =>
          oldGames.map((g) =>
            g.id === updatedGame.game.id ? updatedGame.game : g,
          ),
      );

      toast({
        title: "Duration Updated",
        description: "Game duration successfully changed",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-place mutation
  const autoPlaceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/tournaments/${tournamentId}/auto-place`, {
        selectedDate,
        diamondIds: selectedDiamonds.map(d => d.id)
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'games'] 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'matchups'] 
      });
      
      if (data.placedCount > 0) {
        toast({
          title: "Auto-Place Complete",
          description: data.message || `Placed ${data.placedCount} games`,
        });
      } else {
        toast({
          title: "No Games Placed",
          description: "All games are already placed or no valid slots found",
          variant: "default",
        });
      }

      if (data.failedCount > 0) {
        toast({
          title: "Some Games Could Not Be Placed",
          description: `${data.failedCount} games need manual placement`,
          variant: "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Auto-Place Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Type for conflict details
  type ConflictDetails = { errors: string[]; warnings: string[]; conflictTypes: string[] };
  
  // Type for move game mutation result with discriminated union
  type MoveGameResult = 
    | { conflict: true; conflicts: ConflictDetails; pendingMove: { gameId: string; date: string; time: string; diamondId: string } }
    | { conflict: false; game: Game; warnings: string[]; wasOverridden: boolean; conflicts: ConflictDetails | null };

  // Move game mutation with conflict handling (uses fetch directly to handle 409)
  const moveGameMutation = useMutation({
    mutationFn: async (gameData: {
      gameId: string;
      date: string;
      time: string;
      diamondId: string;
      forceOverride?: boolean;
    }): Promise<MoveGameResult> => {
      const { gameId, forceOverride, ...movePayload } = gameData;
      
      // Use fetch directly to properly handle 409 responses
      const response = await fetch(`/api/games/${gameId}/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...movePayload,
          forceOverride: forceOverride || false
        }),
      });
      
      const data = await response.json();
      
      // Handle 409 conflict response
      if (response.status === 409 && data.canOverride) {
        return { 
          conflict: true, 
          conflicts: data.conflicts || { errors: [data.error || 'Conflict detected'], warnings: [], conflictTypes: [] },
          pendingMove: { gameId, date: movePayload.date, time: movePayload.time, diamondId: movePayload.diamondId }
        };
      }
      
      // Handle other errors
      if (!response.ok) {
        throw new Error(data.error || 'Failed to move game');
      }
      
      // Backend returns { game, warnings, wasOverridden, conflicts }
      return { 
        conflict: false, 
        game: data.game as Game,
        warnings: data.warnings || [],
        wasOverridden: data.wasOverridden === true,
        conflicts: data.conflicts || null
      };
    },
    onSuccess: (result) => {
      if (result.conflict) {
        // Show conflict override dialog
        setConflictDialog({
          open: true,
          conflicts: result.conflicts,
          pendingMove: result.pendingMove,
        });
        return;
      }
      
      // Invalidate the games query to force a refetch
      queryClient.invalidateQueries({ 
        queryKey: ['/api/tournaments', tournamentId, 'games'] 
      });
      
      // Show appropriate message based on whether override was used
      if (result.wasOverridden) {
        // Include conflict details for audit trail
        const conflictSummary = result.conflicts?.errors?.length 
          ? `Overridden: ${result.conflicts.errors[0]}` 
          : 'Game placement was forced despite conflicts.';
        toast({
          title: 'Game Moved (Override Applied)',
          description: conflictSummary,
          variant: 'default',
        });
      } else if (result.warnings && result.warnings.length > 0) {
        toast({
          title: 'Game Moved (with notes)',
          description: result.warnings.join('. '),
          variant: 'default',
        });
      } else {
        toast({
          title: 'Game Moved',
          description: 'Game successfully rescheduled',
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Cannot Move Game',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Handle force override
  const handleForceOverride = () => {
    if (!conflictDialog.pendingMove) return;
    
    setConflictDialog(prev => ({ ...prev, open: false }));
    
    moveGameMutation.mutate({
      ...conflictDialog.pendingMove,
      forceOverride: true,
    });
  };

  const handleCancelOverride = () => {
    setConflictDialog({
      open: false,
      conflicts: { errors: [], warnings: [], conflictTypes: [] },
      pendingMove: null,
    });
  };

  // Coordinate-based cell detection (accounts for scroll offsets)
  const getSlotFromCoordinates = (x: number, y: number) => {
    if (!gridRef.current) return null;

    const gridRect = gridRef.current.getBoundingClientRect();

    // Add scroll offsets to account for horizontal/vertical scrolling
    const x_offset = x - gridRect.left + gridRef.current.scrollLeft;
    const y_offset = y - gridRect.top + gridRef.current.scrollTop;

    const HEADER_ROW_HEIGHT = 40;
    const TIME_SLOT_HEIGHT = 70;

    // Adjust for header row
    const adjustedY = y_offset - HEADER_ROW_HEIGHT;
    if (adjustedY < 0) return null; // Dropped on header

    const timeIndex = Math.floor(adjustedY / TIME_SLOT_HEIGHT);
    const columnWidth = gridRect.width / selectedDiamonds.length;
    const diamondIndex = Math.floor(x_offset / columnWidth);

    // Clamp indices to valid ranges
    const clampedTimeIndex = Math.max(
      0,
      Math.min(timeIndex, timeSlots.length - 1),
    );
    const clampedDiamondIndex = Math.max(
      0,
      Math.min(diamondIndex, selectedDiamonds.length - 1),
    );

    // Validate indices are within bounds
    if (timeIndex < 0 || timeIndex >= timeSlots.length) return null;
    if (diamondIndex < 0 || diamondIndex >= selectedDiamonds.length)
      return null;

    return {
      timeSlot: timeSlots[clampedTimeIndex],
      diamond: selectedDiamonds[clampedDiamondIndex],
      timeIndex: clampedTimeIndex,
      diamondIndex: clampedDiamondIndex,
    };
  };

  const handleDragStart = (event: DragStartEvent) => {
    // Reset both active states
    setActiveMatchup(null);
    setActiveGame(null);

    const { data } = event.active;
    
    // Check if 'type' is 'game'
    if (data.current?.type === 'game') {
      setActiveGame(data.current.game as Game);
    } else {
      // Assume it's a matchup
      setActiveMatchup(data.current as UnplacedMatchup);
    }
  };

  // Helper to parse time to minutes
  const parseTimeToMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Shared validation helper: checks diamond availability, allocations, and overlaps
  // Returns { error, warning } - error blocks the move, warning is informational
  const validatePlacement = (params: {
    date: string;
    time: string;
    diamondId: string;
    homeTeamId: string;
    awayTeamId: string;
    durationMinutes: number;
    ignoreGameId?: string; // Skip checking this game (for moves)
  }): { error: string | null; warning: string | null } => {
    const { date, time, diamondId, homeTeamId, awayTeamId, durationMinutes, ignoreGameId } = params;
    let warning: string | null = null;

    // Check diamond availability
    const targetDiamond = diamonds.find((d) => d.id === diamondId);
    if (targetDiamond && !isTimeAvailable(time, targetDiamond)) {
      return { 
        error: `${targetDiamond.name} is not available at ${time}. Operating hours: ${targetDiamond.availableStartTime} - ${targetDiamond.availableEndTime}`,
        warning: null 
      };
    }

    // Check diamond status (closed globally)
    if (targetDiamond?.status === 'closed') {
      return { 
        error: `${targetDiamond.name} is marked as CLOSED`,
        warning: null 
      };
    }

    // Check allocations - does this diamond have a reserved time block for this tournament?
    const gameStartMin = parseTimeToMinutes(time);
    const gameEndMin = gameStartMin + durationMinutes;
    
    const matchingAllocation = allocations.find(a => 
      a.diamondId === diamondId && 
      a.date === date &&
      parseTimeToMinutes(a.startTime) <= gameStartMin &&
      parseTimeToMinutes(a.endTime) >= gameEndMin
    );

    if (allocations.length > 0 && !matchingAllocation) {
      // No allocation covers this slot - this is an error
      return { 
        error: `No reserved time block for ${targetDiamond?.name || 'this diamond'} at ${time}. Use Field Allocations to reserve time.`,
        warning: null 
      };
    }

    // Check division restriction on allocation
    if (matchingAllocation?.divisionId) {
      const homeTeam = teams.find(t => t.id === homeTeamId);
      const awayTeam = teams.find(t => t.id === awayTeamId);
      const teamDivisionId = homeTeam?.ageDivisionId || awayTeam?.ageDivisionId;
      
      if (teamDivisionId && matchingAllocation.divisionId !== teamDivisionId) {
        return { 
          error: `This time block is reserved for a different division`,
          warning: null 
        };
      }
    }

    // Check for overlapping games
    const gamesOnSameDate = existingGames.filter((g) => g.date === date);
    
    for (const existingGame of gamesOnSameDate) {
      // Skip self-check when moving a game
      if (ignoreGameId && existingGame.id === ignoreGameId) {
        continue;
      }

      const existingDuration = existingGame.durationMinutes || 90;

      // Check diamond conflicts
      if (
        existingGame.diamondId === diamondId &&
        timeRangesOverlap(time, durationMinutes, existingGame.time, existingDuration)
      ) {
        const endTime = getEndTime(time, durationMinutes);
        const existingEndTime = getEndTime(existingGame.time, existingDuration);
        return { 
          error: `This ${durationMinutes}-minute game (${time}-${endTime}) would overlap with an existing game at ${existingGame.time}-${existingEndTime} on ${targetDiamond?.name}`,
          warning: null 
        };
      }

      // Check team conflicts
      if (
        (existingGame.homeTeamId === homeTeamId ||
          existingGame.awayTeamId === homeTeamId ||
          existingGame.homeTeamId === awayTeamId ||
          existingGame.awayTeamId === awayTeamId) &&
        timeRangesOverlap(time, durationMinutes, existingGame.time, existingDuration)
      ) {
        const conflictingTeamIds = new Set<string>();
        if (existingGame.homeTeamId === homeTeamId || existingGame.awayTeamId === homeTeamId) {
          conflictingTeamIds.add(homeTeamId);
        }
        if (existingGame.homeTeamId === awayTeamId || existingGame.awayTeamId === awayTeamId) {
          conflictingTeamIds.add(awayTeamId);
        }

        const conflictingTeamNames = Array.from(conflictingTeamIds)
          .map((id) => teams.find((t) => t.id === id)?.name)
          .filter(Boolean)
          .join(" and ");

        return { 
          error: `${conflictingTeamNames || "A team"} already has a game that overlaps with this time slot`,
          warning: null 
        };
      }
    }

    // Check scheduling requests (warnings only)
    const checkTeamRequests = (teamId: string) => {
      const team = teams.find(t => t.id === teamId);
      if (!team?.schedulingRequests) return;
      const req = team.schedulingRequests.toLowerCase();
      
      const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      
      if (req.includes(`no ${dayName}`)) {
        warning = `${team.name}: Requested to avoid ${dayName}s`;
      }
      if (req.includes("no morning") && gameStartMin < 720) {
        warning = `${team.name}: Requested to avoid mornings`;
      }
      if (req.includes("no afternoon") && gameStartMin >= 720 && gameStartMin < 1020) {
        warning = `${team.name}: Requested to avoid afternoons`;
      }
      if (req.includes("no evening") && gameStartMin >= 1020) {
        warning = `${team.name}: Requested to avoid evenings`;
      }
    };

    checkTeamRequests(homeTeamId);
    checkTeamRequests(awayTeamId);

    return { error: null, warning };
  };

  const handleDragEnd = (event: DragEndEvent) => {
    try {
      // Determine what's being dragged
      const dragData = event.active.data.current;
      const dragType = dragData?.type;
      const isMovingGame = dragType === 'game';

      // Get drop location using coordinate math
      const rect = event.active.rect.current.translated;
      if (!rect) {
        return;
      }

      const dropX = rect.left + rect.width / 2;
      const dropY = rect.top + rect.height / 2;
      const cellInfo = getSlotFromCoordinates(dropX, dropY);

      if (!cellInfo) {
        return;
      }

      const { timeSlot, diamond } = cellInfo;
      const targetDate = timeSlot.date;
      const targetTime = timeSlot.time;
      const targetDiamondId = diamond.id;

      if (isMovingGame && activeGame) {
        // Moving an existing game
        // Skip if dropping in same location
        if (
          activeGame.date === targetDate &&
          activeGame.time === targetTime &&
          activeGame.diamondId === targetDiamondId
        ) {
          return; // No change needed
        }

        // Validate placement using game's own duration
        const validation = validatePlacement({
          date: targetDate,
          time: targetTime,
          diamondId: targetDiamondId,
          homeTeamId: activeGame.homeTeamId,
          awayTeamId: activeGame.awayTeamId,
          durationMinutes: activeGame.durationMinutes || 90,
          ignoreGameId: activeGame.id, // Skip self-collision
        });

        // Show warning if there's one (but still allow the move)
        if (validation.warning && !validation.error) {
          toast({
            title: "Scheduling Note",
            description: validation.warning,
          });
        }

        // For moves, let the backend do the final validation with override support
        // Execute move mutation - backend will return 409 with conflict details if needed
        moveGameMutation.mutate({
          gameId: activeGame.id,
          date: targetDate,
          time: targetTime,
          diamondId: targetDiamondId,
        });
      } else if (activeMatchup) {
        // Placing a new matchup
        const validation = validatePlacement({
          date: targetDate,
          time: targetTime,
          diamondId: targetDiamondId,
          homeTeamId: activeMatchup.homeTeamId,
          awayTeamId: activeMatchup.awayTeamId,
          durationMinutes: gameDuration,
        });

        if (validation.error) {
          toast({
            title: "Cannot Place Game",
            description: validation.error,
            variant: "destructive",
          });
          return;
        }

        // Show warning if there's one
        if (validation.warning) {
          toast({
            title: "Scheduling Note",
            description: validation.warning,
          });
        }

        // Execute place mutation
        placeMutation.mutate({
          tournamentId,
          poolId: activeMatchup.poolId,
          homeTeamId: activeMatchup.homeTeamId,
          awayTeamId: activeMatchup.awayTeamId,
          date: targetDate,
          time: targetTime,
          diamondId: targetDiamondId,
          matchupId: activeMatchup.id,
          durationMinutes: gameDuration,
        });
      }
    } finally {
      // Always reset both states
      setActiveMatchup(null);
      setActiveGame(null);
    }
  };

  // Generate time slots based on tournament dates, selected interval, and diamond availability
  const generateTimeSlots = (): TimeSlot[] => {
    if (!tournament) return [];

    const slots: TimeSlot[] = [];
    const start = new Date(tournament.startDate);
    const end = new Date(tournament.endDate);

    // Get selected diamonds for this tournament
    const selectedDiamonds = diamonds.filter((d) =>
      tournament.selectedDiamondIds?.includes(d.id),
    );

    // Calculate earliest start time and latest end time across all diamonds
    let earliestStartMinutes = 9 * 60; // Default 9 AM
    let latestEndMinutes = 17 * 60; // Default 5 PM

    if (selectedDiamonds.length > 0) {
      earliestStartMinutes = Math.min(
        ...selectedDiamonds.map((d) => {
          const [hours, minutes] = d.availableStartTime.split(":").map(Number);
          return hours * 60 + minutes;
        }),
      );

      latestEndMinutes = Math.max(
        ...selectedDiamonds.map((d) => {
          const [hours, minutes] = d.availableEndTime.split(":").map(Number);
          return hours * 60 + minutes;
        }),
      );
    }

    // Generate slots for each day
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];

      // Generate time slots from earliest to latest based on selected interval
      for (
        let minuteOffset = earliestStartMinutes;
        minuteOffset < latestEndMinutes;
        minuteOffset += timeInterval
      ) {
        const h = Math.floor(minuteOffset / 60);
        const m = minuteOffset % 60;
        const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        slots.push({ date: dateStr, time: timeStr });
      }
    }

    return slots;
  };

  const allTimeSlots = generateTimeSlots();

  // Get unique dates from time slots
  const uniqueDates = Array.from(
    new Set(allTimeSlots.map((slot) => slot.date)),
  ).sort();

  // Initialize selected date to first date if not set
  if (selectedDate === null && uniqueDates.length > 0 && tournament) {
    setSelectedDate(uniqueDates[0]);
  }

  // Filter time slots by selected date (or show all if no date selected)
  const timeSlots = selectedDate
    ? allTimeSlots.filter((slot) => slot.date === selectedDate)
    : allTimeSlots;

  // Filter out matchups that have already been placed by their unique matchup IDs
  const unplacedMatchups = matchups.filter((m) => !placedMatchupIds.has(m.id));

  // Calculate progress based on placed matchup IDs
  const placedCount = placedMatchupIds.size;
  const progress =
    matchups.length > 0 ? Math.round((placedCount / matchups.length) * 100) : 0;

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
      params.set("divisionId", divisionId);
    }
    if (selectedDate) {
      params.set("date", selectedDate);
    }
    const url = `/api/tournaments/${tournamentId}/schedule-export${params.toString() ? "?" + params.toString() : ""}`;
    window.open(url, "_blank");
  };

  if (matchups.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Schedule Grid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-lg font-medium text-gray-700">No matchups found.</p>
              <p className="text-gray-500 mt-2">
                Please go to the "Pool Assignment" tab to lock pools and generate matchups.
              </p>
            </div>
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
                {unplacedMatchups.length > 0 && (
                  <Button
                    onClick={() => autoPlaceMutation.mutate()}
                    disabled={autoPlaceMutation.isPending}
                    variant="default"
                    size="sm"
                    className="gap-1.5"
                    data-testid="button-auto-place"
                  >
                    {autoPlaceMutation.isPending ? 'Placing...' : 'Auto Place'}
                  </Button>
                )}
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
                <Badge variant="outline">
                  {unplacedMatchups.length} unplaced
                </Badge>
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
                  <p className="text-sm text-gray-500 text-center py-4">
                    All games placed!
                  </p>
                ) : (
                  unplacedMatchups.map((matchup) => (
                    <DraggableMatchup
                      key={matchup.id}
                      matchup={matchup}
                      teams={teams}
                      pools={pools}
                    />
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
                        <Label className="text-xs text-gray-600 dark:text-gray-400">
                          Day:
                        </Label>
                        <Select
                          value={selectedDate || ""}
                          onValueChange={setSelectedDate}
                          data-testid="select-day"
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Select day" />
                          </SelectTrigger>
                          <SelectContent>
                            {uniqueDates.map((date) => (
                              <SelectItem
                                key={date}
                                value={date}
                                data-testid={`select-day-${date}`}
                              >
                                {new Date(
                                  date + "T12:00:00",
                                ).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">
                        Game Duration:
                      </Label>
                      <Select
                        value={String(gameDuration)}
                        onValueChange={(value) =>
                          setGameDuration(Number(value))
                        }
                        data-testid="select-game-duration"
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="60" data-testid="duration-60">
                            60 min
                          </SelectItem>
                          <SelectItem value="75" data-testid="duration-75">
                            75 min
                          </SelectItem>
                          <SelectItem value="90" data-testid="duration-90">
                            90 min
                          </SelectItem>
                          <SelectItem value="105" data-testid="duration-105">
                            105 min
                          </SelectItem>
                          <SelectItem value="120" data-testid="duration-120">
                            120 min
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">
                        Time Interval:
                      </Label>
                      <RadioGroup
                        value={String(timeInterval)}
                        onValueChange={(value) =>
                          setTimeInterval(Number(value))
                        }
                        className="flex gap-3"
                        data-testid="radio-time-interval"
                      >
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem
                            value="15"
                            id="interval-15"
                            data-testid="radio-interval-15"
                          />
                          <Label
                            htmlFor="interval-15"
                            className="text-xs cursor-pointer"
                          >
                            15 min
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem
                            value="30"
                            id="interval-30"
                            data-testid="radio-interval-30"
                          />
                          <Label
                            htmlFor="interval-30"
                            className="text-xs cursor-pointer"
                          >
                            30 min
                          </Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <RadioGroupItem
                            value="60"
                            id="interval-60"
                            data-testid="radio-interval-60"
                          />
                          <Label
                            htmlFor="interval-60"
                            className="text-xs cursor-pointer"
                          >
                            60 min
                          </Label>
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
                        ref={gridRef}
                        className="grid gap-0 relative"
                        style={{
                          gridTemplateColumns: `repeat(${selectedDiamonds.length}, 1fr)`,
                          gridTemplateRows: `40px repeat(${timeSlots.length}, 70px)`,
                        }}
                      >
                        {/* Diamond headers */}
                        {selectedDiamonds.map((diamond: Diamond) => (
                          <div
                            key={diamond.id}
                            className="border border-l-0 p-2 bg-gray-100 dark:bg-gray-800 text-left text-xs font-medium flex items-center gap-1"
                          >
                            <MapPin className="w-3 h-3" />
                            {diamond.name}
                          </div>
                        ))}

                        {/* Empty cells (just visual grid, no individual drop zones) */}
                        {timeSlots.map((slot, timeIndex) => (
                          <React.Fragment
                            key={`slot-${slot.date}-${slot.time}`}
                          >
                            {selectedDiamonds.map(
                              (diamond: Diamond, diamondIndex) => {
                                const isAvailable = isTimeAvailable(
                                  slot.time,
                                  diamond,
                                );
                                const isHovered =
                                  hoveredCell?.timeIndex === timeIndex &&
                                  hoveredCell?.diamondIndex === diamondIndex;

                                return (
                                  <div
                                    key={`empty-${diamond.id}-${slot.date}-${slot.time}`}
                                    className={`border border-t-0 border-l-0 relative transition-colors ${
                                      !isAvailable
                                        ? "bg-gray-100 dark:bg-gray-800/50"
                                        : isHovered
                                          ? "bg-[var(--field-green)]/10"
                                          : ""
                                    }`}
                                  />
                                );
                              },
                            )}
                          </React.Fragment>
                        ))}

                        {/* Single droppable zone overlay for coordinate-based drops */}
                        <GridDropZone
                          activeMatchup={activeMatchup}
                          allGames={existingGames}
                          timeInterval={timeInterval}
                          newGameDuration={gameDuration}
                          getSlotFromCoordinates={getSlotFromCoordinates}
                          setHoveredCell={setHoveredCell}
                          timeSlots={timeSlots}
                          selectedDiamonds={selectedDiamonds}
                        />

                        {/* Placed games as positioned overlays */}
                        {existingGames.map((game) => {
                          const slotIndex = timeSlots.findIndex(
                            (s) => s.date === game.date && s.time === game.time,
                          );
                          const diamondIndex = selectedDiamonds.findIndex(
                            (d) => d.id === game.diamondId,
                          );

                          if (slotIndex === -1 || diamondIndex === -1)
                            return null;

                          const rowSpan = Math.ceil(
                            (game.durationMinutes || 90) / timeInterval,
                          );
                          const gridRowStart = slotIndex + 2; // +2 for header row
                          const gridColumnStart = diamondIndex + 1; // +1 (no time column here)

                          return (
                            <DraggableGameCard
                              key={game.id}
                              game={game}
                              gridRowStart={gridRowStart}
                              gridColumnStart={gridColumnStart}
                              rowSpan={rowSpan}
                              teams={teams}
                              pools={pools}
                              allGames={existingGames}
                              timeInterval={timeInterval}
                              onRemove={(gameId) =>
                                removeMutation.mutate(gameId)
                              }
                              onResize={(gameId, newDuration) =>
                                resizeMutation.mutate({
                                  gameId,
                                  durationMinutes: newDuration,
                                })
                              }
                              showToast={toast}
                              diamonds={diamonds}
                            />
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
          <DraggableMatchup
            matchup={activeMatchup}
            teams={teams}
            pools={pools}
          />
        )}
        {activeGame && (
          <div className="border-2 border-[var(--field-green)] bg-[var(--field-green)]/5 p-2 rounded-lg opacity-75">
            <GameCard 
              game={activeGame}
              teams={teams}
              pools={pools}
              allGames={existingGames}
              timeInterval={timeInterval}
              onRemove={() => {}}
              onResize={() => {}}
              showToast={toast}
              diamonds={diamonds}
            />
          </div>
        )}
      </DragOverlay>

      {/* Conflict Override Dialog */}
      <AlertDialog open={conflictDialog.open} onOpenChange={(open) => !open && handleCancelOverride()}>
        <AlertDialogContent data-testid="dialog-conflict-override">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[var(--clay-red)]">
              <AlertTriangle className="w-5 h-5" />
              Scheduling Conflict Detected
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This game placement has the following issues:</p>
                <ul className="list-disc list-inside space-y-1">
                  {conflictDialog.conflicts.errors.map((error, i) => (
                    <li key={i} className="text-red-600 dark:text-red-400 font-medium">
                      {error}
                    </li>
                  ))}
                </ul>
                {conflictDialog.conflicts.conflictTypes.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {conflictDialog.conflicts.conflictTypes.includes('diamond_closed') && (
                      <Badge variant="destructive">Diamond Closed</Badge>
                    )}
                    {conflictDialog.conflicts.conflictTypes.includes('allocation_conflict') && (
                      <Badge variant="destructive">No Time Block</Badge>
                    )}
                    {conflictDialog.conflicts.conflictTypes.includes('game_overlap') && (
                      <Badge variant="destructive">Game Overlap</Badge>
                    )}
                    {conflictDialog.conflicts.conflictTypes.includes('team_conflict') && (
                      <Badge variant="destructive">Team Conflict</Badge>
                    )}
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                  As an admin, you can override this conflict if you're sure about the placement.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-override">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleForceOverride}
              className="bg-[var(--clay-red)] hover:bg-[var(--clay-red)]/90"
              data-testid="button-force-override"
            >
              Override & Place Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  );
}
