import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, Loader2 } from 'lucide-react';
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: bookings, isLoading: bookingsLoading } = useQuery<BookingRequest[]>({
    queryKey: ['/api/organizations', organizationId, 'booking-requests', 'calendar', format(monthStart, 'yyyy-MM-dd'), format(monthEnd, 'yyyy-MM-dd')],
  });

  const { data: diamonds } = useQuery<Diamond[]>({
    queryKey: [`/api/organizations/${organizationId}/diamonds`],
  });

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getBookingsForDay = (day: Date) => {
    if (!bookings) return [];
    
    return bookings.filter(booking => {
      const bookingDate = parseISO(booking.date);
      const matchesDay = isSameDay(bookingDate, day);
      const matchesDiamond = selectedDiamond === 'all' || booking.diamondId === selectedDiamond;
      const matchesStatus = selectedStatus === 'all' || booking.status === selectedStatus;
      
      return matchesDay && matchesDiamond && matchesStatus;
    });
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

  if (bookingsLoading) {
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
              const dayBookings = getBookingsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[120px] border rounded-lg p-2 ${
                    isToday ? 'bg-blue-50 border-blue-300' : 'bg-white'
                  }`}
                  data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1 overflow-y-auto max-h-[90px]">
                    {dayBookings.slice(0, 3).map(booking => (
                      <button
                        key={booking.id}
                        onClick={() => handleBookingClick(booking.id)}
                        className={`w-full text-left text-xs px-2 py-1 rounded border cursor-pointer hover:opacity-80 transition-opacity ${
                          statusColors[booking.status as keyof typeof statusColors] || statusColors.draft
                        }`}
                        data-testid={`booking-event-${booking.id}`}
                      >
                        <div className="font-medium truncate">
                          {booking.startTime} - {booking.team?.name || 'Unknown Team'}
                        </div>
                        <div className="text-[10px] truncate opacity-75">
                          {booking.diamond?.name || booking.requestedDiamondName || 'No diamond'}
                        </div>
                      </button>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayBookings.length - 3} more
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
          <CardTitle className="text-sm">Status Legend</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
