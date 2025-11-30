import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  DndContext, 
  DragOverlay, 
  useDraggable, 
  useDroppable, 
  DragEndEvent, 
  DragStartEvent, 
  MouseSensor, 
  TouchSensor, 
  KeyboardSensor,
  useSensor, 
  useSensors,
  Announcements
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { GripVertical, ChevronUp, ChevronDown, Search, ZoomIn, ZoomOut, MapPin, Calendar } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { Game, Diamond, Team, TournamentDiamondAllocation } from "@shared/schema";

const DEFAULT_DURATION = 90;

interface ScheduleBuilderProps {
  tournamentId: string;
  startDate: string;
  endDate: string;
  diamonds: Diamond[];
  teams: Team[];
}

function TeamLogo({ team, size = "sm" }: { team?: Team, size?: "sm" | "md" }) {
  const sizeClasses = size === "sm" ? "w-5 h-5 text-[10px]" : "w-8 h-8 text-xs";
  
  if (!team) return <div className={cn("rounded-full bg-muted flex-shrink-0 border border-border", sizeClasses)} />;

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 35%)`; 
  };

  const bgColor = stringToColor(team.name);
  const initials = team.name.substring(0, 2).toUpperCase();

  return (
    <div 
      className={cn("rounded-full flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 border border-white/20", sizeClasses)}
      style={{ backgroundColor: bgColor }}
      title={team.name}
    >
      {initials}
    </div>
  );
}

function GameCardUI({ 
  game, 
  teamMap,
  isCompact = false, 
  isOverlay = false 
}: { 
  game: Game, 
  teamMap: Map<string, Team>,
  isCompact?: boolean, 
  isOverlay?: boolean 
}) {
  const homeTeam = teamMap.get(game.homeTeamId || "");
  const awayTeam = teamMap.get(game.awayTeamId || "");
  const duration = game.durationMinutes ?? DEFAULT_DURATION;

  return (
    <div
      className={cn(
        "relative rounded-md shadow-sm transition-all group overflow-hidden select-none flex flex-col h-full",
        "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700",
        isCompact 
            ? "border-l-4 border-l-slate-400 p-2 justify-center hover:shadow-md" 
            : "p-1.5 border-l-[3px] border-l-primary hover:border-l-[5px] hover:bg-accent/5",
        isOverlay ? "shadow-2xl ring-2 ring-primary scale-105 opacity-90" : "",
        game.status === 'completed' ? "opacity-60 grayscale bg-slate-50" : ""
      )}
      data-testid={`game-card-${game.id}`}
    >
      <div className="flex items-center justify-between gap-1 mb-auto">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
             <TeamLogo team={awayTeam} size="sm" />
             <span className="truncate font-bold text-xs text-foreground/90">{awayTeam?.name || "TBD"}</span>
        </div>
        
        <div className="text-[10px] text-muted-foreground font-black px-0.5 opacity-50">@</div>
        
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
             <span className="truncate font-bold text-xs text-foreground/90 text-right">{homeTeam?.name || "TBD"}</span>
             <TeamLogo team={homeTeam} size="sm" />
        </div>
      </div>

      <div className={cn(
          "flex justify-between items-center mt-1 pt-1 border-t border-border/30",
          isCompact ? "text-[10px]" : "text-[9px]"
      )}>
        <div className="flex items-center gap-1 text-muted-foreground">
            <GripVertical className="h-3 w-3 opacity-30 group-hover:opacity-100 transition-opacity" />
            <Badge variant="secondary" className="text-[9px] h-3.5 px-1 rounded-[2px] font-normal bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-0">
                {game.poolId ? "Pool" : "Bracket"}
            </Badge>
        </div>
        <span className="font-mono text-slate-400 text-[9px]">
            {duration}m
        </span>
      </div>
    </div>
  );
}

function DraggableBullpenGame({ game, teamMap }: { game: Game, teamMap: Map<string, Team> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: game.id,
    data: { game, type: 'bullpen' },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.0 : 1,
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...listeners} 
      {...attributes} 
      className="w-[220px] h-full cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-md"
      tabIndex={0}
      role="button"
      aria-label={`Drag ${teamMap.get(game.awayTeamId || "")?.name || "TBD"} vs ${teamMap.get(game.homeTeamId || "")?.name || "TBD"} to schedule`}
    >
      <GameCardUI game={game} teamMap={teamMap} isCompact={true} />
    </div>
  );
}

function DraggableGridGame({ game, teamMap }: { game: Game, teamMap: Map<string, Team> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: game.id,
    data: { game, type: 'grid' },
  });

  const style = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1, 
    zIndex: 50,
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={{ ...style, height: "100%" }} 
      {...listeners} 
      {...attributes} 
      className="h-full w-full cursor-grab active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-md"
      tabIndex={0}
      role="button"
      aria-label={`Reschedule ${teamMap.get(game.awayTeamId || "")?.name || "TBD"} vs ${teamMap.get(game.homeTeamId || "")?.name || "TBD"}`}
    >
      <GameCardUI game={game} teamMap={teamMap} isCompact={false} />
    </div>
  );
}

function TimeSlot({ 
  diamondId, 
  time, 
  game, 
  teamMap, 
  allocation,
  height
}: { 
  diamondId: string, 
  time: string, 
  game?: Game, 
  teamMap: Map<string, Team>,
  allocation?: TournamentDiamondAllocation,
  height: number
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${diamondId}::${time}`,
    data: { diamondId, time }
  });

  let bgClass = "bg-slate-50/50 dark:bg-slate-900/20"; 
  
  if (!allocation) {
    bgClass = "bg-slate-100/80 dark:bg-slate-900/80";
  } else {
    bgClass = "bg-white dark:bg-slate-950"; 
  }

  if (isOver) {
      bgClass = "bg-primary/10 ring-inset ring-2 ring-primary z-20"; 
  }

  return (
    <div
      ref={setNodeRef}
      style={{ height: `${height}px` }}
      className={cn(
        "border-b border-r relative p-0.5 transition-all box-border",
        bgClass,
        game ? "overflow-visible z-10" : ""
      )}
      data-testid={`slot-${diamondId}-${time}`}
    >
      {!game && allocation && (
        <span className="absolute top-0.5 left-1 text-[8px] text-slate-300 dark:text-slate-700 select-none pointer-events-none font-mono group-hover:text-slate-400">
          {time}
        </span>
      )}

      {game && (
        <DraggableGridGame game={game} teamMap={teamMap} />
      )}
    </div>
  );
}

export function ScheduleBuilder({ tournamentId, startDate, endDate, diamonds, teams }: ScheduleBuilderProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedDate, setSelectedDate] = useState(startDate);
  const [activeDragGame, setActiveDragGame] = useState<Game | null>(null);
  const [isDeckExpanded, setIsDeckExpanded] = useState(true);
  const [bullpenSearch, setBullpenSearch] = useState("");
  const [zoomLevel, setZoomLevel] = useState(80);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: [`/api/tournaments/${tournamentId}/games`],
  });
  const { data: allocations = [] } = useQuery<TournamentDiamondAllocation[]>({
    queryKey: [`/api/tournaments/${tournamentId}/allocations`],
  });

  const teamMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const team of teams) {
      map.set(team.id, team);
    }
    return map;
  }, [teams]);

  const moveGameMutation = useMutation({
    mutationFn: async (data: { gameId: string, date: string, time: string, diamondId: string }) => {
      return apiRequest("PUT", `/api/games/${data.gameId}/move`, {
        date: data.date,
        time: data.time,
        diamondId: data.diamondId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/games`] });
    },
    onError: (err: Error) => {
      toast({ title: "Conflict", description: err.message, variant: "destructive" });
    }
  });

  const unscheduledGames = useMemo(() => 
    games.filter(g => !g.diamondId || !g.time || !g.date)
         .filter(g => {
            if (!bullpenSearch) return true;
            const home = teamMap.get(g.homeTeamId || "")?.name.toLowerCase() || "";
            const away = teamMap.get(g.awayTeamId || "")?.name.toLowerCase() || "";
            return home.includes(bullpenSearch.toLowerCase()) || away.includes(bullpenSearch.toLowerCase());
         }), 
  [games, bullpenSearch, teamMap]);

  const scheduledGames = useMemo(() => 
    games.filter(g => g.diamondId && g.time && g.date === selectedDate), 
  [games, selectedDate]);

  const dayAllocations = useMemo(() => 
    allocations.filter(a => a.date === selectedDate),
  [allocations, selectedDate]);

  const dateOptions = useMemo(() => {
    const dates = [];
    let curr = new Date(startDate + "T00:00:00");
    const end = new Date(endDate + "T00:00:00");
    while (curr <= end) {
      dates.push(format(curr, "yyyy-MM-dd"));
      curr.setDate(curr.getDate() + 1);
    }
    return dates;
  }, [startDate, endDate]);

  const timeSlots = useMemo(() => {
    const times = [];
    for (let h = 8; h < 23; h++) {
      times.push(`${h.toString().padStart(2, '0')}:00`);
      times.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return times;
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    const game = event.active.data.current?.game as Game;
    if (game) setActiveDragGame(game);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const [diamondId, time] = (over.id as string).split("::");
      if (diamondId && time) {
        moveGameMutation.mutate({
          gameId: active.id as string,
          date: selectedDate,
          time,
          diamondId
        });
      }
    }
    setActiveDragGame(null);
  };

  const getOverlayHeight = () => {
      if (!activeDragGame) return undefined;
      const duration = activeDragGame.durationMinutes ?? DEFAULT_DURATION;
      const slotsNeeded = Math.ceil(duration / 30);
      return slotsNeeded * zoomLevel;
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      const game = active.data.current?.game as Game | undefined;
      if (!game) return "";
      const home = teamMap.get(game.homeTeamId || "")?.name || "TBD";
      const away = teamMap.get(game.awayTeamId || "")?.name || "TBD";
      return `Picked up ${away} vs ${home}. Use arrow keys to navigate to a time slot.`;
    },
    onDragOver({ active, over }) {
      if (!over) return "";
      const [diamondId, time] = (over.id as string).split("::");
      const diamond = diamonds.find(d => d.id === diamondId);
      if (diamond && time) {
        return `Over ${diamond.name} at ${time}`;
      }
      return "";
    },
    onDragEnd({ active, over }) {
      if (!over) return "Cancelled drop";
      const [diamondId, time] = (over.id as string).split("::");
      const diamond = diamonds.find(d => d.id === diamondId);
      if (diamond && time) {
        return `Dropped on ${diamond.name} at ${time}`;
      }
      return "Dropped";
    },
    onDragCancel() {
      return "Drag cancelled";
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
      accessibility={{ announcements }}
    >
      <div className="flex flex-col h-[calc(100vh-140px)] bg-slate-50 dark:bg-slate-950">
        
        <div className="flex justify-between items-center px-4 py-3 border-b bg-white dark:bg-slate-900 shadow-sm z-20 h-16">
            <div className="flex items-center gap-4">
                <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Viewing Date</span>
                    <Select value={selectedDate} onValueChange={setSelectedDate}>
                        <SelectTrigger className="w-[220px] bg-slate-50 h-8 border-slate-200 dark:border-slate-700 text-sm font-medium" data-testid="date-selector">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {dateOptions.map(d => (
                                <SelectItem key={d} value={d}>{format(new Date(d + "T00:00:00"), "EEEE, MMM d")}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="hidden md:flex flex-col border-l pl-4 h-full justify-center">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Grid Zoom</span>
                    <div className="flex items-center gap-2">
                        <ZoomOut className="h-3 w-3 text-muted-foreground" />
                        <Slider 
                            value={[zoomLevel]} 
                            onValueChange={(v) => setZoomLevel(v[0])} 
                            min={60} 
                            max={140} 
                            step={10} 
                            className="w-[100px]" 
                            data-testid="zoom-slider"
                        />
                        <ZoomIn className="h-3 w-3 text-muted-foreground" />
                    </div>
                </div>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground items-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-white dark:bg-slate-950 border rounded-sm"/> Open</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-slate-200 dark:bg-slate-800 border rounded-sm"/> Locked</div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 bg-primary rounded-sm"/> Game</div>
            </div>
        </div>

        <div className="flex-1 overflow-hidden relative flex bg-slate-100 dark:bg-slate-950/50">
            <div className="w-16 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-20 overflow-hidden shadow-lg">
                <div className="h-10 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900" /> 
                <ScrollArea className="h-full">
                    {timeSlots.map(t => (
                        <div key={t} style={{ height: `${zoomLevel}px` }} className="border-b border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 flex items-center justify-center font-mono font-medium select-none">
                            {t}
                        </div>
                    ))}
                    <div className="h-32" />
                </ScrollArea>
            </div>

            <ScrollArea className="flex-1" type="always">
                <div className="flex min-w-max">
                   {diamonds.map(diamond => (
                       <div key={diamond.id} className="flex flex-col w-[260px] border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                           <div className="h-10 sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center px-2 shadow-sm">
                               <MapPin className="w-3 h-3 mr-1 text-primary/70" />
                               <span className="text-xs font-bold truncate text-slate-700 dark:text-slate-200">
                                 {diamond.name}
                               </span>
                           </div>
                           
                           {timeSlots.map(time => {
                               const alloc = dayAllocations.find(a => a.diamondId === diamond.id && a.startTime <= time && a.endTime > time);
                               const game = scheduledGames.find(g => g.diamondId === diamond.id && g.time === time);
                               
                               return (
                                   <TimeSlot 
                                       key={`${diamond.id}-${time}`}
                                       diamondId={diamond.id}
                                       time={time}
                                       game={game}
                                       teamMap={teamMap}
                                       allocation={alloc}
                                       height={zoomLevel}
                                   />
                               );
                           })}
                           <div className="h-32 bg-slate-50/30" /> 
                       </div>
                   ))}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>

        <div className={cn(
            "border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 flex flex-col shadow-[0_-5px_25px_-5px_rgba(0,0,0,0.1)] z-30 relative",
            isDeckExpanded ? "h-56" : "h-12"
        )}>
            <div 
                className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-b-0 border-slate-200 dark:border-slate-800 rounded-t-xl px-8 py-1 cursor-pointer shadow-sm hover:text-primary group"
                onClick={() => setIsDeckExpanded(!isDeckExpanded)}
                role="button"
                aria-expanded={isDeckExpanded}
                aria-label={isDeckExpanded ? "Collapse bullpen" : "Expand bullpen"}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDeckExpanded(!isDeckExpanded); }}
                data-testid="bullpen-toggle"
            >
                {isDeckExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>

            <div className="h-12 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 bg-slate-50/50 dark:bg-slate-900">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span>Bullpen</span>
                    <Badge variant="secondary" className="ml-2 bg-primary/10 text-primary border-primary/20">{unscheduledGames.length}</Badge>
                </div>
                
                <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                        className="h-8 pl-8 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700" 
                        placeholder="Search teams..." 
                        value={bullpenSearch}
                        onChange={(e) => setBullpenSearch(e.target.value)}
                        data-testid="bullpen-search"
                    />
                </div>
            </div>

            {isDeckExpanded && (
                <ScrollArea className="flex-1 p-4 bg-slate-100/50 dark:bg-slate-950/50">
                    <div className="flex gap-3 pb-2 min-w-max" role="list" aria-label="Unscheduled games">
                        {unscheduledGames.length === 0 ? (
                             <div className="w-full flex flex-col items-center justify-center text-sm text-slate-400 italic h-24">
                                 All games scheduled!
                             </div>
                        ) : (
                            unscheduledGames.map(game => (
                                <div key={game.id} className="h-32 w-[240px]" role="listitem">
                                    <DraggableBullpenGame game={game} teamMap={teamMap} />
                                </div>
                            ))
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            )}
        </div>

      </div>

      <DragOverlay>
        {activeDragGame ? (
           <div style={{ height: getOverlayHeight() || "auto", width: 220 }}>
              <GameCardUI game={activeDragGame} teamMap={teamMap} isOverlay={true} />
           </div>
        ) : null}
      </DragOverlay>
      
      <div aria-live="polite" aria-atomic="true" className="sr-only" data-testid="drag-announcements" />
    </DndContext>
  );
}
