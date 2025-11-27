import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Grid3X3, 
  Plus, 
  Clock, 
  Calendar, 
  MapPin, 
  Trash2, 
  Edit, 
  Save,
  X,
  Info,
  Layers
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { TournamentDiamondAllocation, Diamond, AgeDivision, Tournament } from '@shared/schema';

interface DiamondAllocationsTabProps {
  tournament: Tournament;
  diamonds: Diamond[];
  ageDivisions: AgeDivision[];
  isAdmin?: boolean;
}

interface AllocationFormData {
  diamondId: string;
  date: string;
  startTime: string;
  endTime: string;
  divisionId: string | null;
}

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'
];

const DIVISION_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-100', border: 'border-blue-300' },
  { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-100', border: 'border-green-300' },
  { bg: 'bg-purple-500', text: 'text-purple-700', light: 'bg-purple-100', border: 'border-purple-300' },
  { bg: 'bg-orange-500', text: 'text-orange-700', light: 'bg-orange-100', border: 'border-orange-300' },
  { bg: 'bg-pink-500', text: 'text-pink-700', light: 'bg-pink-100', border: 'border-pink-300' },
  { bg: 'bg-cyan-500', text: 'text-cyan-700', light: 'bg-cyan-100', border: 'border-cyan-300' },
];

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function DiamondAllocationsTab({ 
  tournament, 
  diamonds, 
  ageDivisions, 
  isAdmin = false 
}: DiamondAllocationsTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<TournamentDiamondAllocation | null>(null);
  const [formData, setFormData] = useState<AllocationFormData>({
    diamondId: '',
    date: '',
    startTime: '08:00',
    endTime: '12:00',
    divisionId: null,
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tournamentDates = useMemo(() => {
    return getDatesInRange(tournament.startDate, tournament.endDate);
  }, [tournament.startDate, tournament.endDate]);

  const activeDate = selectedDate || tournamentDates[0] || '';

  const { data: allocations = [], isLoading } = useQuery<TournamentDiamondAllocation[]>({
    queryKey: ['/api/tournaments', tournament.id, 'allocations'],
  });

  const divisionColorMap = useMemo(() => {
    const map = new Map<string, typeof DIVISION_COLORS[0]>();
    ageDivisions.forEach((div, index) => {
      map.set(div.id, DIVISION_COLORS[index % DIVISION_COLORS.length]);
    });
    return map;
  }, [ageDivisions]);

  const createMutation = useMutation({
    mutationFn: async (data: AllocationFormData) => {
      return apiRequest('POST', `/api/tournaments/${tournament.id}/allocations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournament.id, 'allocations'] });
      toast({ title: 'Allocation created', description: 'The time block has been reserved.' });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to create allocation', 
        variant: 'destructive' 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AllocationFormData> }) => {
      return apiRequest('PUT', `/api/tournaments/${tournament.id}/allocations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournament.id, 'allocations'] });
      toast({ title: 'Allocation updated', description: 'The time block has been updated.' });
      setEditingAllocation(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to update allocation', 
        variant: 'destructive' 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (allocationId: string) => {
      return apiRequest('DELETE', `/api/tournaments/${tournament.id}/allocations/${allocationId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournament.id, 'allocations'] });
      toast({ title: 'Allocation deleted', description: 'The time block has been removed.' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to delete allocation', 
        variant: 'destructive' 
      });
    },
  });

  const resetForm = () => {
    setFormData({
      diamondId: diamonds[0]?.id || '',
      date: activeDate,
      startTime: '08:00',
      endTime: '12:00',
      divisionId: null,
    });
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setFormData(prev => ({ ...prev, date: activeDate, diamondId: diamonds[0]?.id || '' }));
    setShowAddDialog(true);
  };

  const handleEdit = (allocation: TournamentDiamondAllocation) => {
    setEditingAllocation(allocation);
    setFormData({
      diamondId: allocation.diamondId,
      date: allocation.date,
      startTime: allocation.startTime,
      endTime: allocation.endTime,
      divisionId: allocation.divisionId,
    });
  };

  const handleSaveEdit = () => {
    if (!editingAllocation) return;
    updateMutation.mutate({ id: editingAllocation.id, data: formData });
  };

  const handleSubmit = () => {
    if (editingAllocation) {
      handleSaveEdit();
    } else {
      createMutation.mutate(formData);
    }
  };

  const allocationsForDate = useMemo(() => {
    return allocations.filter(a => a.date === activeDate);
  }, [allocations, activeDate]);

  const getGridAllocationStyle = (allocation: TournamentDiamondAllocation) => {
    const startMinutes = parseTimeToMinutes(allocation.startTime);
    const endMinutes = parseTimeToMinutes(allocation.endTime);
    const gridStart = parseTimeToMinutes('08:00');
    
    const startCol = Math.floor((startMinutes - gridStart) / 30) + 2;
    const endCol = Math.floor((endMinutes - gridStart) / 30) + 2;
    
    return {
      gridColumnStart: startCol,
      gridColumnEnd: endCol,
    };
  };

  const getDiamondRow = (diamondId: string): number => {
    const index = diamonds.findIndex(d => d.id === diamondId);
    return index + 2;
  };

  if (diamonds.length === 0) {
    return (
      <Card className="mx-6 my-4">
        <CardContent className="py-12 text-center">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No Diamonds Configured</h3>
          <p className="text-gray-500 mb-4">
            This tournament doesn't have any diamonds assigned yet.
          </p>
          <p className="text-sm text-gray-400">
            Go to the tournament settings to select diamonds for this event.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Grid3X3 className="w-6 h-6 text-primary" />
          <div>
            <h3 className="text-2xl font-bold text-gray-900">Diamond Allocations</h3>
            <p className="text-sm text-gray-500">
              Assign field time blocks to specific age divisions
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Select value={activeDate} onValueChange={setSelectedDate} data-testid="select-date">
            <SelectTrigger className="w-48" data-testid="select-date-trigger">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Select date" />
            </SelectTrigger>
            <SelectContent>
              {tournamentDates.map(date => (
                <SelectItem key={date} value={date}>
                  {formatDateShort(date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {isAdmin && (
            <Button onClick={handleOpenAddDialog} data-testid="button-add-allocation">
              <Plus className="w-4 h-4 mr-2" />
              Add Time Block
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="bg-gray-100 border-gray-300">
          <div className="w-3 h-3 bg-gray-300 rounded mr-2" />
          Open to All Divisions
        </Badge>
        {ageDivisions.map((div, index) => {
          const colors = DIVISION_COLORS[index % DIVISION_COLORS.length];
          return (
            <Badge key={div.id} variant="outline" className={`${colors.light} ${colors.border}`}>
              <div className={`w-3 h-3 ${colors.bg} rounded mr-2`} />
              {div.name}
            </Badge>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-4 overflow-x-auto">
          {isLoading ? (
            <div className="py-12 text-center text-gray-500">Loading allocations...</div>
          ) : (
            <div 
              className="grid gap-px bg-gray-200 rounded-lg overflow-hidden min-w-[800px]"
              style={{
                gridTemplateColumns: `150px repeat(${TIME_SLOTS.length - 1}, minmax(60px, 1fr))`,
                gridTemplateRows: `auto repeat(${diamonds.length}, 60px)`,
              }}
            >
              <div className="bg-gray-100 p-2 font-semibold text-gray-700 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Diamond
              </div>
              {TIME_SLOTS.slice(0, -1).map((time, i) => (
                <div key={time} className="bg-gray-100 p-2 text-center text-xs font-medium text-gray-600">
                  {formatTime(time)}
                </div>
              ))}

              {diamonds.map((diamond, diamondIndex) => (
                <>
                  <div 
                    key={`label-${diamond.id}`}
                    className="bg-white p-2 font-medium text-sm flex items-center border-r border-gray-200"
                    style={{ gridRow: diamondIndex + 2 }}
                  >
                    <div className="truncate">{diamond.name}</div>
                  </div>

                  {Array.from({ length: TIME_SLOTS.length - 1 }).map((_, colIndex) => {
                    const hasAllocation = allocationsForDate.some(a => {
                      if (a.diamondId !== diamond.id) return false;
                      const allocStart = parseTimeToMinutes(a.startTime);
                      const allocEnd = parseTimeToMinutes(a.endTime);
                      const slotStart = parseTimeToMinutes(TIME_SLOTS[colIndex]);
                      const slotEnd = slotStart + 30;
                      return slotStart >= allocStart && slotEnd <= allocEnd;
                    });

                    return (
                      <div 
                        key={`cell-${diamond.id}-${colIndex}`}
                        className={`bg-white ${hasAllocation ? 'opacity-0' : 'hover:bg-gray-50'} transition-colors`}
                        style={{ gridRow: diamondIndex + 2, gridColumn: colIndex + 2 }}
                      />
                    );
                  })}

                  {allocationsForDate
                    .filter(a => a.diamondId === diamond.id)
                    .map(allocation => {
                      const divisionColors = allocation.divisionId 
                        ? divisionColorMap.get(allocation.divisionId) 
                        : null;
                      const division = allocation.divisionId 
                        ? ageDivisions.find(d => d.id === allocation.divisionId) 
                        : null;
                      
                      const style = getGridAllocationStyle(allocation);
                      
                      return (
                        <div
                          key={allocation.id}
                          className={`
                            ${divisionColors ? divisionColors.light : 'bg-gray-100'} 
                            ${divisionColors ? divisionColors.border : 'border-gray-300'}
                            border-2 rounded-md m-1 p-2 flex items-center justify-between
                            cursor-pointer hover:shadow-md transition-shadow
                            relative group
                          `}
                          style={{
                            gridRow: diamondIndex + 2,
                            ...style,
                          }}
                          data-testid={`allocation-${allocation.id}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-semibold ${divisionColors?.text || 'text-gray-700'}`}>
                              {division?.name || 'Open'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTime(allocation.startTime)} - {formatTime(allocation.endTime)}
                            </div>
                          </div>
                          
                          {isAdmin && (
                            <div className="hidden group-hover:flex items-center gap-1 absolute right-1 top-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6"
                                onClick={() => handleEdit(allocation)}
                                data-testid={`button-edit-allocation-${allocation.id}`}
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-6 w-6 text-red-500 hover:text-red-700"
                                onClick={() => deleteMutation.mutate(allocation.id)}
                                data-testid={`button-delete-allocation-${allocation.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5" />
            How Allocations Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>Division-Specific:</strong> When a time block is assigned to a specific division (e.g., 11U), 
            only games from that division can be scheduled in that slot.
          </p>
          <p>
            <strong>Open Blocks:</strong> If no division is assigned, any division can use the time block.
          </p>
          <p>
            <strong>Schedule Generation:</strong> The schedule generator will respect these allocations when 
            placing games, preventing cross-division conflicts.
          </p>
        </CardContent>
      </Card>

      <Dialog open={showAddDialog || !!editingAllocation} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingAllocation(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAllocation ? 'Edit Time Block' : 'Add Time Block'}
            </DialogTitle>
            <DialogDescription>
              Reserve a diamond for a specific time range. Optionally restrict to a single division.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="diamond">Diamond</Label>
              <Select 
                value={formData.diamondId} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, diamondId: v }))}
                data-testid="select-allocation-diamond"
              >
                <SelectTrigger data-testid="select-allocation-diamond-trigger">
                  <SelectValue placeholder="Select diamond" />
                </SelectTrigger>
                <SelectContent>
                  {diamonds.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Select 
                value={formData.date} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, date: v }))}
                data-testid="select-allocation-date"
              >
                <SelectTrigger data-testid="select-allocation-date-trigger">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentDates.map(date => (
                    <SelectItem key={date} value={date}>{formatDateShort(date)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Select 
                  value={formData.startTime} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, startTime: v }))}
                  data-testid="select-allocation-start-time"
                >
                  <SelectTrigger data-testid="select-allocation-start-time-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.slice(0, -1).map(time => (
                      <SelectItem key={time} value={time}>{formatTime(time)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Select 
                  value={formData.endTime} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, endTime: v }))}
                  data-testid="select-allocation-end-time"
                >
                  <SelectTrigger data-testid="select-allocation-end-time-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.slice(1).map(time => (
                      <SelectItem 
                        key={time} 
                        value={time}
                        disabled={parseTimeToMinutes(time) <= parseTimeToMinutes(formData.startTime)}
                      >
                        {formatTime(time)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="division">Restrict to Division (Optional)</Label>
              <Select 
                value={formData.divisionId || 'open'} 
                onValueChange={(v) => setFormData(prev => ({ ...prev, divisionId: v === 'open' ? null : v }))}
                data-testid="select-allocation-division"
              >
                <SelectTrigger data-testid="select-allocation-division-trigger">
                  <SelectValue placeholder="Open to all divisions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open to All Divisions</SelectItem>
                  {ageDivisions.map(div => (
                    <SelectItem key={div.id} value={div.id}>{div.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Leave as "Open" to allow any division to use this time block.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowAddDialog(false);
                setEditingAllocation(null);
                resetForm();
              }}
              data-testid="button-cancel-allocation"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.diamondId || !formData.date || createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-allocation"
            >
              {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
