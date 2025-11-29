import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Loader2, Home, CalendarDays, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import type { Diamond } from '@shared/schema';

interface BookingRequest {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  bookingType: string;
  diamondId: string | null;
  requestedDiamondName: string | null;
  notes: string | null;
  team?: {
    name: string;
    division: string;
  };
  diamond?: {
    name: string;
  };
}

interface ExternalEvent {
  id: string;
  startDate: string;
  startTime: string;
  endTime: string;
  title: string;
  rawLocation: string | null;
  diamondId: string | null;
  division: string | null;
  teamName: string | null;
}

interface TournamentGame {
  id: string;
  date: string;
  time: string;
  durationMinutes: number;
  location: string;
  subVenue: string | null;
  diamondId: string | null;
  homeTeamId: string | null;
  awayTeamId: string | null;
  poolId: string;
  pool?: {
    name: string;
  };
  homeTeam?: {
    name: string;
  };
  awayTeam?: {
    name: string;
  };
  diamond?: {
    name: string;
  };
}

type CalendarEvent = 
  | { type: 'house_league'; id: string; date: string; startTime: string; title: string; location: string; diamondId: string | null }
  | { type: 'booking'; id: string; date: string; startTime: string; endTime: string; status: string; bookingType: string; diamondId: string | null; requestedDiamondName: string | null; notes: string | null; team?: { name: string; division: string }; diamond?: { name: string } }
  | { type: 'tournament'; id: string; date: string; startTime: string; title: string; poolName: string; diamondName: string; diamondId: string | null };

interface BookingCalendarProps {
  organizationId: string;
  isCoachView?: boolean;
}

const statusColors = {
  draft: 'bg-gray-200 text-gray-700 border-gray-300',
  submitted: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  select_coordinator_approved: 'bg-blue-100 text-blue-800 border-blue-300',
  diamond_coordinator_approved: 'bg-purple-100 text-purple-800 border-purple-300',
  confirmed: 'bg-green-100 text-green-800 border-green-300',
  declined: 'bg-red-100 text-red-800 border-red-300',
  cancelled: 'bg-gray-300 text-gray-800 border-gray-400',
};

const statusLabels = {
  draft: 'Draft',
  submitted: 'Pending',
  select_coordinator_approved: 'Select Approved',
  diamond_coordinator_approved: 'Diamond Approved',
  confirmed: 'Confirmed',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

export function BookingCalendar({ organizationId, isCoachView = false }: BookingCalendarProps) {
  const [, setLocation] = useLocation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDiamond, setSelectedDiamond] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedEventType, setSelectedEventType] = useState<string>('all');

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingRequest[]>({
    queryKey: ['/api/organizations', organizationId, 'booking-requests', 'calendar', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
  });

  const { data: externalEvents, isLoading: externalEventsLoading } = useQuery<ExternalEvent[]>({
    queryKey: ['/api/organizations', organizationId, 'external-events', { startDate: format(monthStart, 'yyyy-MM-dd'), endDate: format(monthEnd, 'yyyy-MM-dd') }],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/external-events?startDate=${format(monthStart, 'yyyy-MM-dd')}&endDate=${format(monthEnd, 'yyyy-MM-dd')}`);
      if (!response.ok) throw new Error('Failed to fetch external events');
      return response.json();
    },
  });

  const { data: tournamentGames, isLoading: tournamentGamesLoading } = useQuery<TournamentGame[]>({
    queryKey: ['/api/tournaments/organization-settings/games', { organizationId, startDate: format(monthStart, 'yyyy-MM-dd'), endDate: format(monthEnd, 'yyyy-MM-dd') }],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/organization-settings/games?organizationId=${organizationId}&startDate=${format(monthStart, 'yyyy-MM-dd')}&endDate=${format(monthEnd, 'yyyy-MM-dd')}`);
      if (!response.ok) throw new Error('Failed to fetch tournament games');
      return response.json();
    },
  });

  const { data: diamonds } = useQuery<Diamond[]>({
    queryKey: [`/api/organizations/${organizationId}/diamonds`],
  });

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEventsForDay = (day: Date): CalendarEvent[] => {
    const allEvents: CalendarEvent[] = [];

    // Add house league events
    if (externalEvents) {
      externalEvents.forEach(event => {
        const eventDate = parseISO(event.startDate);
        if (isSameDay(eventDate, day)) {
          allEvents.push({
            type: 'house_league',
            id: event.id,
            date: event.startDate,
            startTime: event.startTime,
            title: event.title,
            location: event.rawLocation || 'Unknown Location',
            diamondId: event.diamondId,
          });
        }
      });
    }

    // Add booking events
    if (bookings) {
      bookings.forEach(booking => {
        const bookingDate = parseISO(booking.date);
        if (isSameDay(bookingDate, day)) {
          allEvents.push({
            type: 'booking',
            ...booking,
          });
        }
      });
    }

    // Add tournament events
    if (tournamentGames) {
      tournamentGames.forEach(game => {
        const gameDate = parseISO(game.date);
        if (isSameDay(gameDate, day)) {
          const homeTeam = game.homeTeam?.name || 'TBD';
          const awayTeam = game.awayTeam?.name || 'TBD';
          allEvents.push({
            type: 'tournament',
            id: game.id,
            date: game.date,
            startTime: game.time,
            title: `${homeTeam} vs ${awayTeam}`,
            poolName: game.pool?.name || 'Unknown Pool',
            diamondName: game.diamond?.name || game.location,
            diamondId: game.diamondId,
          });
        }
      });
    }

    // Apply filters
    const filteredEvents = allEvents.filter(event => {
      // Event type filter
      if (selectedEventType !== 'all') {
        if (selectedEventType === 'house_league' && event.type !== 'house_league') return false;
        if (selectedEventType === 'bookings' && event.type !== 'booking') return false;
        if (selectedEventType === 'tournaments' && event.type !== 'tournament') return false;
      }

      // Diamond filter
      if (selectedDiamond !== 'all' && event.diamondId !== selectedDiamond) return false;

      // Status filter (only applies to bookings)
      if (selectedStatus !== 'all' && event.type === 'booking' && event.status !== selectedStatus) return false;

      return true;
    });

    // Sort by start time
    filteredEvents.sort((a, b) => {
      const timeA = a.startTime;
      const timeB = b.startTime;
      return timeA.localeCompare(timeB);
    });

    return filteredEvents;
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleBookingClick = (bookingId: string) => {
    setLocation(`/booking/${organizationId}/request/${bookingId}`);
  };

  const getStartingDayOfWeek = () => {
    return monthStart.getDay();
  };

  const getEventColor = (event: CalendarEvent): string => {
    if (event.type === 'house_league') {
      return 'bg-orange-100 text-orange-800 border-orange-300';
    } else if (event.type === 'tournament') {
      return 'bg-indigo-100 text-indigo-800 border-indigo-300';
    } else {
      // Booking - use status-based colors
      return statusColors[event.status as keyof typeof statusColors] || statusColors.draft;
    }
  };

  const getEventIcon = (event: CalendarEvent) => {
    if (event.type === 'house_league') {
      return <Home className="w-3 h-3" />;
    } else if (event.type === 'tournament') {
      return <Trophy className="w-3 h-3" />;
    } else {
      return <CalendarDays className="w-3 h-3" />;
    }
  };

  if (bookingsLoading || externalEventsLoading || tournamentGamesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Navigation and Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Booking Calendar
              </CardTitle>
              <CardDescription>
                View and manage diamond bookings for {format(currentMonth, 'MMMM yyyy')}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousMonth}
                data-testid="button-previous-month"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                data-testid="button-next-month"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                <SelectTrigger data-testid="select-event-type-filter">
                  <SelectValue placeholder="All Events" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Events</SelectItem>
                  <SelectItem value="house_league">House League</SelectItem>
                  <SelectItem value="bookings">Bookings</SelectItem>
                  <SelectItem value="tournaments">Tournaments</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedDiamond} onValueChange={setSelectedDiamond}>
                <SelectTrigger data-testid="select-diamond-filter">
                  <SelectValue placeholder="All Diamonds" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Diamonds</SelectItem>
                  {diamonds?.map(diamond => (
                    <SelectItem key={diamond.id} value={diamond.id}>
                      {diamond.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Day Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {/* Empty cells for days before month starts */}
            {Array.from({ length: getStartingDayOfWeek() }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[120px] bg-muted/30 rounded-lg" />
            ))}

            {/* Calendar Days */}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[120px] border rounded-lg p-2 ${
                    isToday ? 'bg-blue-50 border-blue-300' : 'bg-card'
                  }`}
                  data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[90px]">
                    {dayEvents.slice(0, 3).map(event => {
                      if (event.type === 'booking') {
                        return (
                          <button
                            key={event.id}
                            onClick={() => handleBookingClick(event.id)}
                            className={`w-full text-left text-xs px-2 py-1 rounded border cursor-pointer hover:opacity-80 transition-opacity ${getEventColor(event)}`}
                            data-testid={`booking-event-${event.id}`}
                          >
                            <div className="flex items-center gap-1">
                              {getEventIcon(event)}
                              <div className="font-medium truncate flex-1">
                                {event.startTime} - {event.team?.name || 'Unknown Team'}
                              </div>
                            </div>
                            <div className="text-[10px] truncate opacity-75">
                              {event.diamond?.name || event.requestedDiamondName || 'No diamond'}
                            </div>
                          </button>
                        );
                      } else if (event.type === 'house_league') {
                        return (
                          <div
                            key={event.id}
                            className={`w-full text-xs px-2 py-1 rounded border ${getEventColor(event)}`}
                            data-testid={`house-league-event-${event.id}`}
                          >
                            <div className="flex items-center gap-1">
                              {getEventIcon(event)}
                              <div className="font-medium truncate flex-1">
                                {event.startTime} - {event.title}
                              </div>
                            </div>
                            <div className="text-[10px] truncate opacity-75">
                              {event.location}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div
                            key={event.id}
                            className={`w-full text-xs px-2 py-1 rounded border ${getEventColor(event)}`}
                            data-testid={`tournament-event-${event.id}`}
                          >
                            <div className="flex items-center gap-1">
                              {getEventIcon(event)}
                              <div className="font-medium truncate flex-1">
                                {event.startTime} - {event.title}
                              </div>
                            </div>
                            <div className="text-[10px] truncate opacity-75">
                              {event.poolName} • {event.diamondName}
                            </div>
                          </div>
                        );
                      }
                    })}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Legend</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Event Types */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Event Types</h4>
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="bg-orange-100 text-orange-800 border-orange-300"
              >
                <Home className="w-3 h-3 mr-1" />
                House League
              </Badge>
              <Badge
                variant="outline"
                className="bg-blue-100 text-blue-800 border-blue-300"
              >
                <CalendarDays className="w-3 h-3 mr-1" />
                Bookings
              </Badge>
              <Badge
                variant="outline"
                className="bg-indigo-100 text-indigo-800 border-indigo-300"
              >
                <Trophy className="w-3 h-3 mr-1" />
                Tournaments
              </Badge>
            </div>
          </div>

          {/* Booking Statuses */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">Booking Statuses</h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(statusLabels).map(([status, label]) => (
                <Badge
                  key={status}
                  variant="outline"
                  className={statusColors[status as keyof typeof statusColors]}
                >
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
