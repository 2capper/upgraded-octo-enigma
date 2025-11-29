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
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
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
  ChevronUp,
  ChevronDown,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
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

function TeamLogo({ team, size = "sm" }: { team?: Team; size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-5 h-5 text-[9px]" : "w-8 h-8 text-xs";

  if (!team) {
    return (
      <div
        className={cn(
          "rounded-full bg-muted flex-shrink-0 border border-border",
          sizeClasses
        )}
      />
    );
  }

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 40%)`;
  };

  const bgColor = stringToColor(team.name);
  const initials = team.name.substring(0, 2).toUpperCase();

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 border border-white/20",
        sizeClasses
      )}
      style={{ backgroundColor: bgColor }}
      title={team.name}
    >
      {initials}
    </div>
  );
}

function DraggableMatchup({
  matchup,
  teams,
  pools,
  isCompact = false,
}: {
  matchup: UnplacedMatchup;
  teams: Team[];
  pools: Pool[];
  isCompact?: boolean;
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
        zIndex: isDragging ? 999 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "group bg-card border-2 rounded-lg cursor-grab active:cursor-grabbing hover:border-primary hover:shadow-md transition-all touch-manipulation select-none",
        isCompact
          ? "w-[200px] flex-shrink-0 p-2 border-l-4 border-l-primary hover:translate-y-[-2px]"
          : "p-3 border-gray-300 dark:border-gray-600"
      )}
      data-testid={`matchup-${matchup.id}`}
      role="button"
      aria-label={`Drag to schedule ${homeTeam?.name || "Unknown"} vs ${awayTeam?.name || "Unknown"}`}
    >
      <div className="flex items-center gap-1 mb-1">
        <GripVertical className="w-3 h-3 text-muted-foreground flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
        <div className="flex-1 flex items-center justify-between min-w-0 gap-1">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <TeamLogo team={awayTeam} size="sm" />
            <span className="text-xs font-semibold truncate">
              {awayTeam?.name || "TBD"}
            </span>
          </div>
          <div className="text-[10px] text-muted-foreground font-bold px-0.5">
            vs
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <span className="text-xs font-semibold truncate text-right">
              {homeTeam?.name || "TBD"}
            </span>
            <TeamLogo team={homeTeam} size="sm" />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-[10px] pl-4">
        <Badge
          variant="secondary"
          className="text-[9px] h-4 px-1 rounded-[2px] font-normal bg-muted/50 border-0"
        >
          {pool?.name || matchup.poolName}
        </Badge>
        {homeTeam?.division && (
          <span className="text-muted-foreground">{homeTeam.division}</span>
        )}
      </div>
    </div>
  );
}

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
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: game.id,
      data: {
        type: "game",
        game: game,
      },
    });

  const style = transform
    ? {
        gridRow: `${gridRowStart} / span ${rowSpan}`,
        gridColumn: gridColumnStart,
        zIndex: isDragging ? 12 : 10,
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : {
        gridRow: `${gridRowStart} / span ${rowSpan}`,
        gridColumn: gridColumnStart,
        zIndex: 10,
      };

  return (
    <div
      ref={setNodeRef}
      className="border-2 border-primary bg-primary/5 p-1 rounded-lg cursor-grab active:cursor-grabbing"
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
        if (target.closest(".remove-button")) {
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
              Math.min(480, startDuration + deltaMinutes)
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
              Math.min(480, startDuration + deltaMinutes)
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
        className="remove-button absolute -top-1 -right-1 p-0.5 bg-destructive text-white rounded-full hover:bg-red-700 z-10"
        data-testid={`remove-game-${game.id}`}
      >
        <X className="w-3 h-3" />
      </button>
      <div className="flex items-center gap-1 mb-0.5">
        <TeamLogo team={awayTeam} size="sm" />
        <span className="text-[10px] font-semibold truncate flex-1">
          {awayTeam?.name || "TBD"}
        </span>
      </div>
      <div className="flex items-center gap-1 mb-1">
        <TeamLogo team={homeTeam} size="sm" />
        <span className="text-[10px] font-semibold truncate flex-1">
          {homeTeam?.name || "TBD"}
        </span>
      </div>
      <div className="flex items-center justify-between text-[9px] mb-1">
        <Badge
          variant="secondary"
          className="text-[8px] bg-muted/50 px-1 py-0 h-3"
        >
          {pool?.name || "Pool"}
        </Badge>
        <span className="text-muted-foreground font-mono">
          {game.durationMinutes || 90}m
        </span>
      </div>
      {diamond && diamond.status !== "open" && (
        <div className="mb-1">
          <Badge
            className={`text-[8px] px-1 py-0 h-3 ${
              diamond.status === "closed"
                ? "bg-red-500 text-white"
                : diamond.status === "delayed"
                  ? "bg-yellow-500 text-white"
                  : "bg-gray-500 text-white"
            }`}
            data-testid={`diamond-status-${diamond.status}`}
          >
            {diamond.status === "closed"
              ? "Closed"
              : diamond.status === "delayed"
                ? "Delayed"
                : "TBD"}
          </Badge>
        </div>
      )}
      <div
        className="resize-handle text-center py-0.5 bg-muted rounded cursor-ns-resize text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        data-testid={`resize-handle-${game.id}`}
      >
        {game.durationMinutes || 90}m → {getEndTime(game.time, game.durationMinutes || 90)}
      </div>
    </div>
  );
}

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
    y: number
  ) => {
    timeSlot: TimeSlot;
    diamond: Diamond;
    timeIndex: number;
    diamondIndex: number;
  } | null;
  setHoveredCell: (
    cell: { timeIndex: number; diamondIndex: number } | null
  ) => void;
  timeSlots: TimeSlot[];
  selectedDiamonds: Diamond[];
}) {
  const { setNodeRef } = useDroppable({
    id: "calendar-grid",
  });

  React.useEffect(() => {
    if (!activeMatchup) {
      setHoveredCell(null);
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

function isTimeAvailable(time: string, diamond: Diamond): boolean {
  const [hours, minutes] = time.split(":").map(Number);
  const timeMinutes = hours * 60 + minutes;

  const [startHours, startMinutes] = diamond.availableStartTime
    .split(":")
    .map(Number);
  const startTimeMinutes = startHours * 60 + startMinutes;

  const [endHours, endMinutes] = diamond.availableEndTime.split(":").map(Number);
  const endTimeMinutes = endHours * 60 + endMinutes;

  return timeMinutes >= startTimeMinutes && timeMinutes < endTimeMinutes;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function getEndTime(startTime: string, durationMinutes: number): string {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  const hours = Math.floor(endMinutes / 60);
  const mins = endMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

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
  return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
}

export function DragScheduleBuilder({
  tournamentId,
  divisionId,
}: DragScheduleBuilderProps) {
  const { toast } = useToast();
  const gridRef = useRef<HTMLDivElement>(null);
  const bullpenRef = useRef<HTMLDivElement>(null);
  const [activeMatchup, setActiveMatchup] = useState<UnplacedMatchup | null>(null);
  const [activeGame, setActiveGame] = useState<Game | null>(null);
  const [placedMatchupIds, setPlacedMatchupIds] = useState<Set<string>>(new Set());
  const [timeInterval, setTimeInterval] = useState<number>(60);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    timeIndex: number;
    diamondIndex: number;
  } | null>(null);
  const [isDeckExpanded, setIsDeckExpanded] = useState(true);
  const [bullpenSearch, setBullpenSearch] = useState("");
  const [zoomLevel, setZoomLevel] = useState(70);
  
  useEffect(() => {
    if (isDeckExpanded && bullpenRef.current) {
      bullpenRef.current.focus();
    }
  }, [isDeckExpanded]);

  const {
    data: allMatchups = [],
    isLoading: matchupsLoading,
    refetch: refetchMatchups,
  } = useQuery<UnplacedMatchup[]>({
    queryKey: ["/api/tournaments", tournamentId, "matchups"],
  });

  const { data: teams = [] } = useQuery<Team[]>({
    queryKey: ["/api/tournaments", tournamentId, "teams"],
  });

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["/api/tournaments", tournamentId, "pools"],
  });

  const { data: tournament } = useQuery<Tournament>({
    queryKey: ["/api/tournaments", tournamentId],
  });

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

  const currentDivision = ageDivisions.find((d) => d.id === divisionId);
  const defaultDuration = currentDivision?.defaultGameDuration || 90;

  const [gameDuration, setGameDuration] = useState<number>(defaultDuration);

  useEffect(() => {
    setGameDuration(defaultDuration);
  }, [defaultDuration]);

  const { data: diamonds = [] } = useQuery<Diamond[]>({
    queryKey: [
      "/api/organizations",
      tournament?.organizationId || "",
      "diamonds",
    ],
    enabled: !!tournament?.organizationId,
  });

  const selectedDiamonds = diamonds.filter((d: Diamond) =>
    tournament?.selectedDiamondIds?.includes(d.id)
  );

  const { data: allGames = [] } = useQuery<Game[]>({
    queryKey: ["/api/tournaments", tournamentId, "games"],
  });

  const { data: allocations = [] } = useQuery<TournamentDiamondAllocation[]>({
    queryKey: ["/api/tournaments", tournamentId, "allocations"],
  });

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

  const existingGames = useMemo(() => {
    const divisionPools = pools.filter(
      (p) => !divisionId || p.ageDivisionId === divisionId
    );
    const divisionPoolIds = new Set(divisionPools.map((p) => p.id));
    return allGames.filter((g) => divisionPoolIds.has(g.poolId));
  }, [allGames, pools, divisionId]);

  const matchups = useMemo(() => {
    if (!divisionId) return allMatchups;
    const divisionPools = pools.filter((p) => p.ageDivisionId === divisionId);
    const divisionPoolIds = new Set(divisionPools.map((p) => p.id));
    return allMatchups.filter((m) => divisionPoolIds.has(m.poolId));
  }, [allMatchups, pools, divisionId]);

  useEffect(() => {
    const idsFromGames = new Set(
      existingGames.map((game) => game.matchupId).filter(Boolean) as string[]
    );
    setPlacedMatchupIds(idsFromGames);
  }, [existingGames]);

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
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "games"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "matchups"],
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

  const removeMutation = useMutation({
    mutationFn: async (gameId: string) => {
      await apiRequest("DELETE", `/api/games/${gameId}`);
      return gameId;
    },
    onSuccess: (gameId) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "games"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "matchups"],
      });

      toast({
        title: "Game Removed",
        description: "Matchup returned to the unplaced list.",
      });
    },
  });

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
      queryClient.setQueryData<Game[]>(
        ["/api/tournaments", tournamentId, "games"],
        (oldGames = []) =>
          oldGames.map((g) =>
            g.id === updatedGame.game.id ? updatedGame.game : g
          )
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

  const autoPlaceMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(
        "POST",
        `/api/tournaments/${tournamentId}/auto-place`,
        {
          selectedDate,
          diamondIds: selectedDiamonds.map((d) => d.id),
        }
      );
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "games"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "matchups"],
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

  type ConflictDetails = {
    errors: string[];
    warnings: string[];
    conflictTypes: string[];
  };

  type MoveGameResult =
    | {
        conflict: true;
        conflicts: ConflictDetails;
        pendingMove: {
          gameId: string;
          date: string;
          time: string;
          diamondId: string;
        };
      }
    | {
        conflict: false;
        game: Game;
        warnings: string[];
        wasOverridden: boolean;
        conflicts: ConflictDetails | null;
      };

  const moveGameMutation = useMutation({
    mutationFn: async (gameData: {
      gameId: string;
      date: string;
      time: string;
      diamondId: string;
      forceOverride?: boolean;
    }): Promise<MoveGameResult> => {
      const { gameId, forceOverride, ...movePayload } = gameData;

      const response = await fetch(`/api/games/${gameId}/move`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...movePayload,
          forceOverride: forceOverride || false,
        }),
      });

      const data = await response.json();

      if (response.status === 409 && data.canOverride) {
        return {
          conflict: true,
          conflicts: data.conflicts || {
            errors: [data.error || "Conflict detected"],
            warnings: [],
            conflictTypes: [],
          },
          pendingMove: {
            gameId,
            date: movePayload.date,
            time: movePayload.time,
            diamondId: movePayload.diamondId,
          },
        };
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to move game");
      }

      return {
        conflict: false,
        game: data.game as Game,
        warnings: data.warnings || [],
        wasOverridden: data.wasOverridden === true,
        conflicts: data.conflicts || null,
      };
    },
    onSuccess: (result) => {
      if (result.conflict) {
        setConflictDialog({
          open: true,
          conflicts: result.conflicts,
          pendingMove: result.pendingMove,
        });
        return;
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/tournaments", tournamentId, "games"],
      });

      if (result.wasOverridden) {
        const conflictSummary = result.conflicts?.errors?.length
          ? `Overridden: ${result.conflicts.errors[0]}`
          : "Game placement was forced despite conflicts.";
        toast({
          title: "Game Moved (Override Applied)",
          description: conflictSummary,
          variant: "default",
        });
      } else if (result.warnings && result.warnings.length > 0) {
        toast({
          title: "Game Moved (with notes)",
          description: result.warnings.join(". "),
          variant: "default",
        });
      } else {
        toast({
          title: "Game Moved",
          description: "Game successfully rescheduled",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Cannot Move Game",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleForceOverride = () => {
    if (!conflictDialog.pendingMove) return;

    setConflictDialog((prev) => ({ ...prev, open: false }));

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

  const getSlotFromCoordinates = (x: number, y: number) => {
    if (!gridRef.current) return null;

    const gridRect = gridRef.current.getBoundingClientRect();
    
    const y_offset = y - gridRect.top + gridRef.current.scrollTop;

    const HEADER_ROW_HEIGHT = 48;
    const TIME_SLOT_HEIGHT = zoomLevel;

    const adjustedY = y_offset - HEADER_ROW_HEIGHT;
    if (adjustedY < 0) return null;

    const timeIndex = Math.floor(adjustedY / TIME_SLOT_HEIGHT);
    
    const headerCells = gridRef.current.querySelectorAll('[data-diamond-header]');
    let diamondIndex = -1;
    
    if (headerCells.length > 0) {
      for (let i = 0; i < headerCells.length; i++) {
        const cellRect = headerCells[i].getBoundingClientRect();
        if (x >= cellRect.left && x < cellRect.right) {
          diamondIndex = i;
          break;
        }
      }
      if (diamondIndex === -1) {
        const lastCellRect = headerCells[headerCells.length - 1].getBoundingClientRect();
        if (x >= lastCellRect.right) {
          diamondIndex = headerCells.length - 1;
        }
        const firstCellRect = headerCells[0].getBoundingClientRect();
        if (x < firstCellRect.left) {
          diamondIndex = 0;
        }
      }
    } else {
      const x_offset = x - gridRect.left + gridRef.current.scrollLeft;
      const contentWidth = gridRef.current.scrollWidth;
      const columnWidth = contentWidth / selectedDiamonds.length;
      diamondIndex = Math.floor(x_offset / columnWidth);
    }

    const clampedTimeIndex = Math.max(
      0,
      Math.min(timeIndex, timeSlots.length - 1)
    );
    const clampedDiamondIndex = Math.max(
      0,
      Math.min(diamondIndex, selectedDiamonds.length - 1)
    );

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
    setActiveMatchup(null);
    setActiveGame(null);

    const { data } = event.active;

    if (data.current?.type === "game") {
      setActiveGame(data.current.game as Game);
    } else {
      setActiveMatchup(data.current as UnplacedMatchup);
    }
  };

  const parseTimeToMinutes = (t: string): number => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };

  const validatePlacement = (params: {
    date: string;
    time: string;
    diamondId: string;
    homeTeamId: string;
    awayTeamId: string;
    durationMinutes: number;
    ignoreGameId?: string;
  }): { error: string | null; warning: string | null } => {
    const {
      date,
      time,
      diamondId,
      homeTeamId,
      awayTeamId,
      durationMinutes,
      ignoreGameId,
    } = params;
    let warning: string | null = null;

    const targetDiamond = diamonds.find((d) => d.id === diamondId);
    if (targetDiamond && !isTimeAvailable(time, targetDiamond)) {
      return {
        error: `${targetDiamond.name} is not available at ${time}. Operating hours: ${targetDiamond.availableStartTime} - ${targetDiamond.availableEndTime}`,
        warning: null,
      };
    }

    if (targetDiamond?.status === "closed") {
      return {
        error: `${targetDiamond.name} is marked as CLOSED`,
        warning: null,
      };
    }

    const gameStartMin = parseTimeToMinutes(time);
    const gameEndMin = gameStartMin + durationMinutes;

    const matchingAllocation = allocations.find(
      (a) =>
        a.diamondId === diamondId &&
        a.date === date &&
        parseTimeToMinutes(a.startTime) <= gameStartMin &&
        parseTimeToMinutes(a.endTime) >= gameEndMin
    );

    if (allocations.length > 0 && !matchingAllocation) {
      return {
        error: `No reserved time block for ${targetDiamond?.name || "this diamond"} at ${time}. Use Field Allocations to reserve time.`,
        warning: null,
      };
    }

    if (matchingAllocation?.divisionId) {
      const homeTeam = teams.find((t) => t.id === homeTeamId);
      const awayTeam = teams.find((t) => t.id === awayTeamId);
      const teamDivisionId = homeTeam?.ageDivisionId || awayTeam?.ageDivisionId;

      if (teamDivisionId && matchingAllocation.divisionId !== teamDivisionId) {
        return {
          error: `This time block is reserved for a different division`,
          warning: null,
        };
      }
    }

    const gamesOnSameDate = existingGames.filter((g) => g.date === date);

    for (const existingGame of gamesOnSameDate) {
      if (ignoreGameId && existingGame.id === ignoreGameId) {
        continue;
      }

      const existingDuration = existingGame.durationMinutes || 90;

      if (
        existingGame.diamondId === diamondId &&
        timeRangesOverlap(time, durationMinutes, existingGame.time, existingDuration)
      ) {
        const endTime = getEndTime(time, durationMinutes);
        const existingEndTime = getEndTime(existingGame.time, existingDuration);
        return {
          error: `This ${durationMinutes}-minute game (${time}-${endTime}) would overlap with an existing game at ${existingGame.time}-${existingEndTime} on ${targetDiamond?.name}`,
          warning: null,
        };
      }

      if (
        (existingGame.homeTeamId === homeTeamId ||
          existingGame.awayTeamId === homeTeamId ||
          existingGame.homeTeamId === awayTeamId ||
          existingGame.awayTeamId === awayTeamId) &&
        timeRangesOverlap(time, durationMinutes, existingGame.time, existingDuration)
      ) {
        const conflictingTeamIds = new Set<string>();
        if (
          existingGame.homeTeamId === homeTeamId ||
          existingGame.awayTeamId === homeTeamId
        ) {
          conflictingTeamIds.add(homeTeamId);
        }
        if (
          existingGame.homeTeamId === awayTeamId ||
          existingGame.awayTeamId === awayTeamId
        ) {
          conflictingTeamIds.add(awayTeamId);
        }

        const conflictingTeamNames = Array.from(conflictingTeamIds)
          .map((id) => teams.find((t) => t.id === id)?.name)
          .filter(Boolean)
          .join(" and ");

        return {
          error: `${conflictingTeamNames || "A team"} already has a game that overlaps with this time slot`,
          warning: null,
        };
      }
    }

    const checkTeamRequests = (teamId: string) => {
      const team = teams.find((t) => t.id === teamId);
      if (!team?.schedulingRequests) return;
      const req = team.schedulingRequests.toLowerCase();

      const dayName = new Date(date)
        .toLocaleDateString("en-US", { weekday: "long" })
        .toLowerCase();

      if (req.includes(`no ${dayName}`)) {
        warning = `${team.name}: Requested to avoid ${dayName}s`;
      }
      if (req.includes("no morning") && gameStartMin < 720) {
        warning = `${team.name}: Requested to avoid mornings`;
      }
      if (
        req.includes("no afternoon") &&
        gameStartMin >= 720 &&
        gameStartMin < 1020
      ) {
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
      const dragData = event.active.data.current;
      const dragType = dragData?.type;
      const isMovingGame = dragType === "game";

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
        if (
          activeGame.date === targetDate &&
          activeGame.time === targetTime &&
          activeGame.diamondId === targetDiamondId
        ) {
          return;
        }

        const validation = validatePlacement({
          date: targetDate,
          time: targetTime,
          diamondId: targetDiamondId,
          homeTeamId: activeGame.homeTeamId,
          awayTeamId: activeGame.awayTeamId,
          durationMinutes: activeGame.durationMinutes || 90,
          ignoreGameId: activeGame.id,
        });

        if (validation.warning && !validation.error) {
          toast({
            title: "Scheduling Note",
            description: validation.warning,
          });
        }

        moveGameMutation.mutate({
          gameId: activeGame.id,
          date: targetDate,
          time: targetTime,
          diamondId: targetDiamondId,
        });
      } else if (activeMatchup) {
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

        if (validation.warning) {
          toast({
            title: "Scheduling Note",
            description: validation.warning,
          });
        }

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
      setActiveMatchup(null);
      setActiveGame(null);
    }
  };

  const generateTimeSlots = (): TimeSlot[] => {
    if (!tournament) return [];

    const slots: TimeSlot[] = [];
    const start = new Date(tournament.startDate);
    const end = new Date(tournament.endDate);

    const localSelectedDiamonds = diamonds.filter((d) =>
      tournament.selectedDiamondIds?.includes(d.id)
    );

    let earliestStartMinutes = 9 * 60;
    let latestEndMinutes = 17 * 60;

    if (localSelectedDiamonds.length > 0) {
      earliestStartMinutes = Math.min(
        ...localSelectedDiamonds.map((d) => {
          const [hours, minutes] = d.availableStartTime.split(":").map(Number);
          return hours * 60 + minutes;
        })
      );

      latestEndMinutes = Math.max(
        ...localSelectedDiamonds.map((d) => {
          const [hours, minutes] = d.availableEndTime.split(":").map(Number);
          return hours * 60 + minutes;
        })
      );
    }

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];

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

  const uniqueDates = Array.from(
    new Set(allTimeSlots.map((slot) => slot.date))
  ).sort();

  if (selectedDate === null && uniqueDates.length > 0 && tournament) {
    setSelectedDate(uniqueDates[0]);
  }

  const timeSlots = selectedDate
    ? allTimeSlots.filter((slot) => slot.date === selectedDate)
    : allTimeSlots;

  const unplacedMatchups = useMemo(() => {
    return matchups
      .filter((m) => !placedMatchupIds.has(m.id))
      .filter((m) => {
        if (!bullpenSearch) return true;
        const home =
          teams.find((t) => t.id === m.homeTeamId)?.name.toLowerCase() || "";
        const away =
          teams.find((t) => t.id === m.awayTeamId)?.name.toLowerCase() || "";
        const q = bullpenSearch.toLowerCase();
        return home.includes(q) || away.includes(q);
      });
  }, [matchups, placedMatchupIds, bullpenSearch, teams]);

  const placedCount = placedMatchupIds.size;
  const progress =
    matchups.length > 0 ? Math.round((placedCount / matchups.length) * 100) : 0;

  if (matchupsLoading || !tournament) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              <p className="text-lg font-medium">No matchups found.</p>
              <p className="text-muted-foreground mt-2">
                Please go to the "Pool Assignment" tab to lock pools and generate
                matchups.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-[calc(100vh-160px)] bg-background">
        {/* TOP BAR: Controls */}
        <div className="flex flex-wrap justify-between items-center p-3 border-b bg-card shadow-sm z-10 gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                Day
              </span>
              <Select value={selectedDate || ""} onValueChange={setSelectedDate}>
                <SelectTrigger
                  className="w-[180px] bg-background h-8 text-sm"
                  data-testid="select-day"
                >
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueDates.map((date) => (
                    <SelectItem
                      key={date}
                      value={date}
                      data-testid={`select-day-${date}`}
                    >
                      {new Date(date + "T12:00:00").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="hidden md:flex flex-col border-l pl-4">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Zoom
              </span>
              <div className="flex items-center gap-2">
                <ZoomOut className="h-3 w-3 text-muted-foreground" />
                <Slider
                  value={[zoomLevel]}
                  onValueChange={(v) => setZoomLevel(v[0])}
                  min={40}
                  max={120}
                  step={10}
                  className="w-[80px]"
                />
                <ZoomIn className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>

            <div className="flex flex-col border-l pl-4">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Duration
              </span>
              <Select
                value={String(gameDuration)}
                onValueChange={(value) => setGameDuration(Number(value))}
                data-testid="select-game-duration"
              >
                <SelectTrigger className="w-[90px] h-8 text-xs">
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

            <div className="hidden lg:flex flex-col border-l pl-4">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1">
                Interval
              </span>
              <RadioGroup
                value={String(timeInterval)}
                onValueChange={(value) => setTimeInterval(Number(value))}
                className="flex gap-2"
                data-testid="radio-time-interval"
              >
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="15" id="interval-15" />
                  <Label htmlFor="interval-15" className="text-xs cursor-pointer">
                    15m
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="30" id="interval-30" />
                  <Label htmlFor="interval-30" className="text-xs cursor-pointer">
                    30m
                  </Label>
                </div>
                <div className="flex items-center gap-1">
                  <RadioGroupItem value="60" id="interval-60" />
                  <Label htmlFor="interval-60" className="text-xs cursor-pointer">
                    60m
                  </Label>
                </div>
              </RadioGroup>
            </div>
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
                {autoPlaceMutation.isPending ? "Placing..." : "Auto Place"}
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
                Export
              </Button>
            )}
            {placedCount === matchups.length && matchups.length > 0 && (
              <Badge className="bg-green-500">
                <Check className="w-3 h-3 mr-1" />
                Complete
              </Badge>
            )}
          </div>
        </div>

        {/* MAIN: Schedule Grid */}
        <div className="flex-1 overflow-hidden relative flex">
          {/* Y-Axis: Time Labels */}
          <div className="w-16 flex-shrink-0 border-r bg-card z-20 overflow-hidden">
            <div
              className="border-b bg-muted/50 flex items-center justify-center text-xs font-medium"
              style={{ height: "48px" }}
            >
              Time
            </div>
            <div className="overflow-y-auto" style={{ height: `calc(100% - 48px)` }}>
              {timeSlots.map((slot) => (
                <div
                  key={`time-${slot.date}-${slot.time}`}
                  className="border-b flex items-center justify-center text-xs font-mono text-muted-foreground"
                  style={{ height: `${zoomLevel}px` }}
                >
                  {slot.time}
                </div>
              ))}
            </div>
          </div>

          {/* Main Grid Area */}
          <div className="flex-1 overflow-auto">
            <div
              ref={gridRef}
              className="grid gap-0 relative min-w-max"
              style={{
                gridTemplateColumns: `repeat(${selectedDiamonds.length}, minmax(180px, 1fr))`,
                gridTemplateRows: `48px repeat(${timeSlots.length}, ${zoomLevel}px)`,
              }}
            >
              {/* Diamond headers */}
              {selectedDiamonds.map((diamond: Diamond) => (
                <div
                  key={diamond.id}
                  data-diamond-header
                  className="border-b border-r p-2 bg-muted/50 text-xs font-medium flex items-center gap-1.5 sticky top-0 z-10"
                >
                  <MapPin className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{diamond.name}</span>
                  {diamond.status !== "open" && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[9px] h-4 px-1",
                        diamond.status === "closed" && "bg-red-100 text-red-700",
                        diamond.status === "delayed" && "bg-yellow-100 text-yellow-700"
                      )}
                    >
                      {diamond.status}
                    </Badge>
                  )}
                </div>
              ))}

              {/* Empty cells */}
              {timeSlots.map((slot, timeIndex) => (
                <React.Fragment key={`slot-${slot.date}-${slot.time}`}>
                  {selectedDiamonds.map((diamond: Diamond, diamondIndex) => {
                    const isAvailable = isTimeAvailable(slot.time, diamond);
                    const isHovered =
                      hoveredCell?.timeIndex === timeIndex &&
                      hoveredCell?.diamondIndex === diamondIndex;

                    return (
                      <div
                        key={`empty-${diamond.id}-${slot.date}-${slot.time}`}
                        className={cn(
                          "border-b border-r relative transition-colors",
                          !isAvailable
                            ? "bg-muted/30"
                            : isHovered
                              ? "bg-primary/10 ring-2 ring-primary ring-inset"
                              : "bg-card/30 hover:bg-accent/5"
                        )}
                      >
                        {!isAvailable && (
                          <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_5px,currentColor_5px,currentColor_6px)]" />
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}

              {/* Drop zone overlay */}
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

              {/* Placed games */}
              {existingGames.map((game) => {
                const slotIndex = timeSlots.findIndex(
                  (s) => s.date === game.date && s.time === game.time
                );
                const diamondIndex = selectedDiamonds.findIndex(
                  (d) => d.id === game.diamondId
                );

                if (slotIndex === -1 || diamondIndex === -1) return null;

                const rowSpan = Math.ceil(
                  (game.durationMinutes || 90) / timeInterval
                );
                const gridRowStart = slotIndex + 2;
                const gridColumnStart = diamondIndex + 1;

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
                    onRemove={(gameId) => removeMutation.mutate(gameId)}
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

        {/* BOTTOM DECK: Unscheduled Games */}
        <div
          className={cn(
            "border-t bg-card transition-all",
            isDeckExpanded ? "h-[180px]" : "h-12"
          )}
        >
          {/* Deck Header */}
          <button
            type="button"
            className="w-full h-12 px-4 flex items-center justify-between border-b cursor-pointer hover:bg-accent/5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset"
            onClick={() => setIsDeckExpanded(!isDeckExpanded)}
            aria-expanded={isDeckExpanded}
            aria-controls="bullpen-content"
            data-testid="button-toggle-deck"
          >
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary font-semibold"
              >
                {unplacedMatchups.length}
              </Badge>
              <span className="text-sm font-medium">Games Remaining</span>
              <span className="text-xs text-muted-foreground">
                {placedCount} of {matchups.length} placed ({progress}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isDeckExpanded && (
                <div
                  className="relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    value={bullpenSearch}
                    onChange={(e) => setBullpenSearch(e.target.value)}
                    placeholder="Search teams..."
                    className="h-8 w-48 pl-8 text-xs"
                    data-testid="input-bullpen-search"
                  />
                </div>
              )}
              {isDeckExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </button>

          {/* Deck Content */}
          <div
            ref={bullpenRef}
            id="bullpen-content"
            role="region"
            aria-label="Unscheduled games"
            className={cn(
              "overflow-x-auto p-3 outline-none",
              isDeckExpanded ? "h-[calc(100%-48px)]" : "h-0 p-0 overflow-hidden"
            )}
            tabIndex={isDeckExpanded ? 0 : -1}
          >
            <div className="flex gap-3 h-full">
              {unplacedMatchups.length === 0 ? (
                <div className="flex items-center justify-center w-full text-sm text-muted-foreground">
                  <Check className="w-4 h-4 mr-2 text-green-500" aria-hidden="true" />
                  All games placed!
                </div>
              ) : (
                unplacedMatchups.map((matchup) => (
                  <DraggableMatchup
                    key={matchup.id}
                    matchup={matchup}
                    teams={teams}
                    pools={pools}
                    isCompact
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeMatchup && (
          <DraggableMatchup
            matchup={activeMatchup}
            teams={teams}
            pools={pools}
            isCompact
          />
        )}
        {activeGame && (
          <div className="border-2 border-primary bg-primary/5 p-2 rounded-lg opacity-90 rotate-2 scale-105 shadow-xl">
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
      <AlertDialog
        open={conflictDialog.open}
        onOpenChange={(open) => !open && handleCancelOverride()}
      >
        <AlertDialogContent data-testid="dialog-conflict-override">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
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
                    {conflictDialog.conflicts.conflictTypes.includes(
                      "diamond_closed"
                    ) && <Badge variant="destructive">Diamond Closed</Badge>}
                    {conflictDialog.conflicts.conflictTypes.includes(
                      "allocation_conflict"
                    ) && <Badge variant="destructive">No Time Block</Badge>}
                    {conflictDialog.conflicts.conflictTypes.includes(
                      "game_overlap"
                    ) && <Badge variant="destructive">Game Overlap</Badge>}
                    {conflictDialog.conflicts.conflictTypes.includes(
                      "team_conflict"
                    ) && <Badge variant="destructive">Team Conflict</Badge>}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-3">
                  As an admin, you can override this conflict if you're sure about
                  the placement.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-override">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceOverride}
              className="bg-destructive hover:bg-destructive/90"
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
