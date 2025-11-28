import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Grid3X3, 
  Plus, 
  Clock, 
  Calendar, 
  MapPin, 
  Trash2, 
  Edit, 
  Copy,
  ChevronLeft,
  ChevronRight,
  Zap,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';
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
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'
];

const DIVISION_COLORS = [
  { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50', lightHover: 'hover:bg-blue-100', border: 'border-blue-200', gradient: 'from-blue-500 to-blue-600' },
  { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50', lightHover: 'hover:bg-emerald-100', border: 'border-emerald-200', gradient: 'from-emerald-500 to-emerald-600' },
  { bg: 'bg-violet-500', text: 'text-violet-700', light: 'bg-violet-50', lightHover: 'hover:bg-violet-100', border: 'border-violet-200', gradient: 'from-violet-500 to-violet-600' },
  { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-50', lightHover: 'hover:bg-amber-100', border: 'border-amber-200', gradient: 'from-amber-500 to-amber-600' },
  { bg: 'bg-rose-500', text: 'text-rose-700', light: 'bg-rose-50', lightHover: 'hover:bg-rose-100', border: 'border-rose-200', gradient: 'from-rose-500 to-rose-600' },
  { bg: 'bg-cyan-500', text: 'text-cyan-700', light: 'bg-cyan-50', lightHover: 'hover:bg-cyan-100', border: 'border-cyan-200', gradient: 'from-cyan-500 to-cyan-600' },
  { bg: 'bg-fuchsia-500', text: 'text-fuchsia-700', light: 'bg-fuchsia-50', lightHover: 'hover:bg-fuchsia-100', border: 'border-fuchsia-200', gradient: 'from-fuchsia-500 to-fuchsia-600' },
  { bg: 'bg-lime-500', text: 'text-lime-700', light: 'bg-lime-50', lightHover: 'hover:bg-lime-100', border: 'border-lime-200', gradient: 'from-lime-500 to-lime-600' },
];

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatTimeShort(time24: string): string {
  const [hours] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'p' : 'a';
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hour12}${period}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function DiamondAllocationsTab({ 
  tournament, 
  diamonds, 
  ageDivisions, 
  isAdmin = false 
}: DiamondAllocationsTabProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQuickFillDialog, setShowQuickFillDialog] = useState(false);
  const [showCopyDayDialog, setShowCopyDayDialog] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<TournamentDiamondAllocation | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ diamondId: string; timeSlot: string } | null>(null);
  const [formData, setFormData] = useState<AllocationFormData>({
    diamondId: '',
    date: '',
    startTime: '08:00',
    endTime: '12:00',
    divisionId: null,
  });
  const [quickFillData, setQuickFillData] = useState({
    startTime: '08:00',
    endTime: '14:00',
    divisionId: null as string | null,
    selectedDiamonds: [] as string[],
  });
  const [copyDayData, setCopyDayData] = useState({
    targetDate: '',
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const tournamentDates = useMemo(() => {
    return getDatesInRange(tournament.startDate, tournament.endDate);
  }, [tournament.startDate, tournament.endDate]);

  const activeDate = selectedDate || tournamentDates[0] || '';
  const activeDateIndex = tournamentDates.indexOf(activeDate);

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
      toast({ title: 'Block Reserved', description: 'Time block has been added to the schedule.' });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Conflict Detected', 
        description: error.message || 'This time slot overlaps with an existing block.', 
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
      toast({ title: 'Block Updated', description: 'Changes saved successfully.' });
      setEditingAllocation(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: 'Update Failed', 
        description: error.message || 'Could not update the time block.', 
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
      toast({ title: 'Block Removed', description: 'Time slot is now available.' });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to remove block.', 
        variant: 'destructive' 
      });
    },
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (allocationsData: AllocationFormData[]) => {
      return apiRequest('POST', `/api/tournaments/${tournament.id}/allocations/bulk`, { allocations: allocationsData });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', tournament.id, 'allocations'] });
      toast({ title: 'Quick Fill Complete', description: `Added ${variables.length} time blocks.` });
      setShowQuickFillDialog(false);
      setQuickFillData({ startTime: '08:00', endTime: '14:00', divisionId: null, selectedDiamonds: [] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Quick Fill Failed', 
        description: error.message || 'Some blocks could not be created.', 
        variant: 'destructive' 
      });
    },
  });

  const allocationsForDate = useMemo(() => {
    return allocations.filter(a => a.date === activeDate);
  }, [allocations, activeDate]);

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

  const handleEdit = useCallback((allocation: TournamentDiamondAllocation) => {
    setEditingAllocation(allocation);
    setFormData({
      diamondId: allocation.diamondId,
      date: allocation.date,
      startTime: allocation.startTime,
      endTime: allocation.endTime,
      divisionId: allocation.divisionId,
    });
  }, []);

  const handleCellClick = useCallback((diamondId: string, timeSlot: string) => {
    if (!isAdmin) return;
    
    const existingAllocation = allocationsForDate.find(a => {
      if (a.diamondId !== diamondId) return false;
      const allocStart = parseTimeToMinutes(a.startTime);
      const allocEnd = parseTimeToMinutes(a.endTime);
      const slotStart = parseTimeToMinutes(timeSlot);
      return slotStart >= allocStart && slotStart < allocEnd;
    });
    
    if (existingAllocation) {
      handleEdit(existingAllocation);
      return;
    }
    
    const slotMinutes = parseTimeToMinutes(timeSlot);
    let proposedEndMinutes = slotMinutes + 120;
    
    const sortedAllocations = [...allocationsForDate]
      .filter(a => a.diamondId === diamondId)
      .sort((a, b) => parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime));
    
    const nextAllocation = sortedAllocations.find(a => {
      const allocStart = parseTimeToMinutes(a.startTime);
      return allocStart > slotMinutes && allocStart < proposedEndMinutes;
    });
    
    if (nextAllocation) {
      proposedEndMinutes = parseTimeToMinutes(nextAllocation.startTime);
    }
    
    proposedEndMinutes = Math.min(proposedEndMinutes, parseTimeToMinutes('21:00'));
    
    const endHours = Math.floor(proposedEndMinutes / 60);
    const endMins = proposedEndMinutes % 60;
    const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
    
    setFormData({
      diamondId,
      date: activeDate,
      startTime: timeSlot,
      endTime,
      divisionId: null,
    });
    setShowAddDialog(true);
  }, [isAdmin, activeDate, allocationsForDate, handleEdit]);

  const handleSubmit = () => {
    if (editingAllocation) {
      updateMutation.mutate({ id: editingAllocation.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleQuickFill = () => {
    if (quickFillData.selectedDiamonds.length === 0) {
      toast({ title: 'Select Diamonds', description: 'Please select at least one diamond.', variant: 'destructive' });
      return;
    }
    
    const allocationsToCreate: AllocationFormData[] = quickFillData.selectedDiamonds.map(diamondId => ({
      diamondId,
      date: activeDate,
      startTime: quickFillData.startTime,
      endTime: quickFillData.endTime,
      divisionId: quickFillData.divisionId,
    }));
    
    bulkCreateMutation.mutate(allocationsToCreate);
  };

  const handleCopyDay = async () => {
    if (!copyDayData.targetDate) {
      toast({ title: 'Select Target Date', description: 'Please choose a date to copy to.', variant: 'destructive' });
      return;
    }
    
    const allocationsToCreate: AllocationFormData[] = allocationsForDate.map(alloc => ({
      diamondId: alloc.diamondId,
      date: copyDayData.targetDate,
      startTime: alloc.startTime,
      endTime: alloc.endTime,
      divisionId: alloc.divisionId,
    }));
    
    if (allocationsToCreate.length === 0) {
      toast({ title: 'Nothing to Copy', description: 'No allocations exist on this day.', variant: 'destructive' });
      return;
    }
    
    bulkCreateMutation.mutate(allocationsToCreate);
    setShowCopyDayDialog(false);
    setCopyDayData({ targetDate: '' });
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' ? activeDateIndex - 1 : activeDateIndex + 1;
    if (newIndex >= 0 && newIndex < tournamentDates.length) {
      setSelectedDate(tournamentDates[newIndex]);
    }
  };

  const stats = useMemo(() => {
    const totalSlots = diamonds.length * (TIME_SLOTS.length - 1);
    let coveredSlots = 0;
    const divisionHours: Record<string, number> = {};
    
    allocationsForDate.forEach(alloc => {
      const startMin = parseTimeToMinutes(alloc.startTime);
      const endMin = parseTimeToMinutes(alloc.endTime);
      const durationSlots = (endMin - startMin) / 30;
      coveredSlots += durationSlots;
      
      const divKey = alloc.divisionId || 'open';
      divisionHours[divKey] = (divisionHours[divKey] || 0) + (endMin - startMin) / 60;
    });
    
    return {
      totalSlots,
      coveredSlots,
      coveragePercent: totalSlots > 0 ? Math.round((coveredSlots / totalSlots) * 100) : 0,
      totalHours: allocationsForDate.reduce((sum, a) => {
        return sum + (parseTimeToMinutes(a.endTime) - parseTimeToMinutes(a.startTime)) / 60;
      }, 0),
      divisionHours,
      blockCount: allocationsForDate.length,
    };
  }, [allocationsForDate, diamonds.length]);

  const getCellAllocation = useCallback((diamondId: string, timeSlot: string) => {
    const slotStart = parseTimeToMinutes(timeSlot);
    return allocationsForDate.find(a => {
      if (a.diamondId !== diamondId) return false;
      const allocStart = parseTimeToMinutes(a.startTime);
      const allocEnd = parseTimeToMinutes(a.endTime);
      return slotStart >= allocStart && slotStart < allocEnd;
    });
  }, [allocationsForDate]);

  const isSlotStart = useCallback((allocation: TournamentDiamondAllocation, timeSlot: string) => {
    return allocation.startTime === timeSlot;
  }, []);

  const getSlotSpan = useCallback((allocation: TournamentDiamondAllocation) => {
    const startMin = parseTimeToMinutes(allocation.startTime);
    const endMin = parseTimeToMinutes(allocation.endTime);
    return (endMin - startMin) / 30;
  }, []);

  if (diamonds.length === 0) {
    return (
      <Card className="mx-4 my-6 border-dashed border-2">
        <CardContent className="py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-3">No Diamonds Available</h3>
          <p className="text-gray-500 max-w-md mx-auto mb-6">
            Before you can allocate field time, you need to configure diamonds for this tournament.
          </p>
          <Button variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Configure Diamonds
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-900 dark:to-gray-900 rounded-xl border p-4 md:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                <Grid3X3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Field Allocation Manager</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Reserve diamond time blocks for your tournament divisions
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {isAdmin && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setQuickFillData({ ...quickFillData, selectedDiamonds: diamonds.map(d => d.id) });
                          setShowQuickFillDialog(true);
                        }}
                        data-testid="button-quick-fill"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Quick Fill
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Reserve multiple diamonds at once</TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowCopyDayDialog(true)}
                        disabled={allocationsForDate.length === 0}
                        data-testid="button-copy-day"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Day
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clone today's allocations to another day</TooltipContent>
                  </Tooltip>
                  
                  <Button onClick={handleOpenAddDialog} size="sm" data-testid="button-add-allocation">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Block
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigateDate('prev')}
              disabled={activeDateIndex <= 0}
              data-testid="button-prev-day"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <Select value={activeDate} onValueChange={setSelectedDate} data-testid="select-date">
                <SelectTrigger className="w-auto min-w-[200px] font-semibold" data-testid="select-date-trigger">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {tournamentDates.map((date, idx) => (
                    <SelectItem key={date} value={date}>
                      <span className="font-medium">Day {idx + 1}:</span> {formatDateLong(date)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigateDate('next')}
              disabled={activeDateIndex >= tournamentDates.length - 1}
              data-testid="button-next-day"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-700">{stats.coveragePercent}%</p>
                  <p className="text-xs text-blue-600">Coverage</p>
                </div>
              </div>
              <Progress value={stats.coveragePercent} className="mt-3 h-1.5" />
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-700">{stats.totalHours}h</p>
                  <p className="text-xs text-emerald-600">Total Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500 flex items-center justify-center">
                  <Grid3X3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-violet-700">{stats.blockCount}</p>
                  <p className="text-xs text-violet-600">Time Blocks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-700">{diamonds.length}</p>
                  <p className="text-xs text-amber-600">Diamonds</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="bg-gray-50 border-gray-300 px-3 py-1.5">
            <div className="w-3 h-3 bg-gradient-to-br from-gray-400 to-gray-500 rounded-sm mr-2" />
            Open to All
          </Badge>
          {ageDivisions.map((div, index) => {
            const colors = DIVISION_COLORS[index % DIVISION_COLORS.length];
            const hours = stats.divisionHours[div.id] || 0;
            return (
              <Badge key={div.id} variant="outline" className={`${colors.light} ${colors.border} px-3 py-1.5`}>
                <div className={`w-3 h-3 bg-gradient-to-br ${colors.gradient} rounded-sm mr-2`} />
                {div.name}
                {hours > 0 && <span className="ml-2 text-xs opacity-70">({hours}h)</span>}
              </Badge>
            );
          })}
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-gray-500">Loading allocations...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800">
                      <th className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-700 p-3 text-left font-semibold text-gray-700 dark:text-gray-200 border-b border-r min-w-[140px]">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Diamond
                        </div>
                      </th>
                      {TIME_SLOTS.slice(0, -1).map((time, i) => {
                        const isHour = time.endsWith(':00');
                        const hour = parseInt(time.split(':')[0]);
                        const isAfternoon = hour >= 12;
                        return (
                          <th 
                            key={time} 
                            className={`p-1.5 text-center text-xs font-medium border-b min-w-[50px] ${
                              isHour 
                                ? 'bg-slate-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200' 
                                : 'bg-slate-50 dark:bg-slate-800 text-gray-400'
                            } ${isAfternoon ? 'border-l-amber-200' : ''}`}
                          >
                            {isHour ? formatTimeShort(time) : ''}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {diamonds.map((diamond, diamondIndex) => (
                      <tr key={diamond.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 p-3 font-medium text-sm border-b border-r">
                          <div className="flex flex-col">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">{diamond.name}</span>
                            {diamond.location && (
                              <span className="text-xs text-gray-400 truncate max-w-[120px]">{diamond.location}</span>
                            )}
                          </div>
                        </td>
                        {TIME_SLOTS.slice(0, -1).map((time, colIndex) => {
                          const allocation = getCellAllocation(diamond.id, time);
                          const isStart = allocation && isSlotStart(allocation, time);
                          const span = allocation ? getSlotSpan(allocation) : 1;
                          const isHour = time.endsWith(':00');
                          const isHovered = hoveredCell?.diamondId === diamond.id && hoveredCell?.timeSlot === time;
                          
                          if (allocation && !isStart) {
                            return null;
                          }
                          
                          if (allocation && isStart) {
                            const divisionColors = allocation.divisionId 
                              ? divisionColorMap.get(allocation.divisionId) 
                              : null;
                            const division = allocation.divisionId 
                              ? ageDivisions.find(d => d.id === allocation.divisionId) 
                              : null;
                            
                            return (
                              <td 
                                key={`${diamond.id}-${time}`}
                                colSpan={span}
                                className="p-0.5 border-b"
                              >
                                <div
                                  className={`
                                    h-14 rounded-lg p-2 flex flex-col justify-between cursor-pointer
                                    transition-all duration-200 group relative
                                    ${divisionColors 
                                      ? `${divisionColors.light} ${divisionColors.border} border-2 ${divisionColors.lightHover}` 
                                      : 'bg-gray-100 border-2 border-gray-300 hover:bg-gray-200'
                                    }
                                    hover:shadow-lg hover:scale-[1.02] hover:z-20
                                  `}
                                  onClick={() => isAdmin && handleEdit(allocation)}
                                  data-testid={`allocation-${allocation.id}`}
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <span className={`text-xs font-bold truncate ${divisionColors?.text || 'text-gray-700'}`}>
                                      {division?.name || 'Open'}
                                    </span>
                                    {isAdmin && (
                                      <div className="hidden group-hover:flex items-center gap-0.5">
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-5 w-5 hover:bg-white/50"
                                          onClick={(e) => { e.stopPropagation(); handleEdit(allocation); }}
                                          data-testid={`button-edit-allocation-${allocation.id}`}
                                        >
                                          <Edit className="w-3 h-3" />
                                        </Button>
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-5 w-5 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Remove this time block?')) {
                                              deleteMutation.mutate(allocation.id);
                                            }
                                          }}
                                          data-testid={`button-delete-allocation-${allocation.id}`}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-gray-500">
                                    {formatTimeShort(allocation.startTime)} - {formatTimeShort(allocation.endTime)}
                                  </span>
                                </div>
                              </td>
                            );
                          }
                          
                          return (
                            <td 
                              key={`${diamond.id}-${time}`}
                              className={`p-0.5 border-b ${isHour ? 'border-l border-l-slate-200' : ''}`}
                              onMouseEnter={() => isAdmin && setHoveredCell({ diamondId: diamond.id, timeSlot: time })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              <div
                                className={`
                                  h-14 rounded transition-all duration-150 flex items-center justify-center
                                  ${isAdmin 
                                    ? `cursor-pointer ${isHovered ? 'bg-primary/10 border-2 border-dashed border-primary/40' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}` 
                                    : 'bg-slate-50/50'
                                  }
                                `}
                                onClick={() => handleCellClick(diamond.id, time)}
                                data-testid={`cell-${diamond.id}-${time}`}
                              >
                                {isAdmin && isHovered && (
                                  <Plus className="w-4 h-4 text-primary/60" />
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {allocationsForDate.length === 0 && !isLoading && (
          <Card className="border-dashed border-2 bg-slate-50/50">
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Allocations Yet</h3>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                {isAdmin 
                  ? 'Click on any cell in the grid above to reserve a time block, or use Quick Fill to set up multiple diamonds at once.'
                  : 'No field time has been allocated for this day yet.'}
              </p>
              {isAdmin && (
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" onClick={() => setShowQuickFillDialog(true)}>
                    <Zap className="w-4 h-4 mr-2" />
                    Quick Fill All
                  </Button>
                  <Button onClick={handleOpenAddDialog}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Block
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-gray-500 hover:text-gray-700">
              <span className="flex items-center gap-2">
                <Info className="w-4 h-4" />
                How Allocations Work
              </span>
              <ChevronRight className="w-4 h-4 transition-transform ui-open:rotate-90" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="p-4 text-sm text-gray-600 space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Division-Specific Blocks:</strong> When assigned to a division (e.g., 11U), 
                    only games from that division can be scheduled in that slot.
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Open Blocks:</strong> Any division can use time blocks marked as "Open to All."
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>Schedule Enforcement:</strong> The schedule generator will respect these allocations 
                    and warn you if a game placement violates the division restriction.
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <Dialog open={showAddDialog || !!editingAllocation} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setEditingAllocation(null);
            resetForm();
          }
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {editingAllocation ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                {editingAllocation ? 'Edit Time Block' : 'Reserve Time Block'}
              </DialogTitle>
              <DialogDescription>
                {editingAllocation 
                  ? 'Modify the time range or division restriction for this block.'
                  : 'Reserve a diamond for a specific time range.'}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Diamond</Label>
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
                  <Label>Date</Label>
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
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
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
                  <Label>End Time</Label>
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
                <Label>Division Restriction</Label>
                <Select 
                  value={formData.divisionId || 'open'} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, divisionId: v === 'open' ? null : v }))}
                  data-testid="select-allocation-division"
                >
                  <SelectTrigger data-testid="select-allocation-division-trigger">
                    <SelectValue placeholder="Open to all divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-gray-400 rounded-sm" />
                        Open to All Divisions
                      </span>
                    </SelectItem>
                    {ageDivisions.map((div, idx) => {
                      const colors = DIVISION_COLORS[idx % DIVISION_COLORS.length];
                      return (
                        <SelectItem key={div.id} value={div.id}>
                          <span className="flex items-center gap-2">
                            <div className={`w-3 h-3 ${colors.bg} rounded-sm`} />
                            {div.name} Only
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Restricting to a division ensures only that age group uses this time slot.
                </p>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
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
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {editingAllocation ? 'Save Changes' : 'Reserve Block'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showQuickFillDialog} onOpenChange={setShowQuickFillDialog}>
          <DialogContent className="sm:max-w-lg" data-testid="dialog-quick-fill">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Quick Fill
              </DialogTitle>
              <DialogDescription>
                Reserve the same time block across multiple diamonds at once.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-1">
                  Selected Date: <span className="text-primary">{formatDateLong(activeDate)}</span>
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Select 
                    value={quickFillData.startTime} 
                    onValueChange={(v) => setQuickFillData(prev => ({ ...prev, startTime: v }))}
                  >
                    <SelectTrigger data-testid="select-quickfill-start-time">
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
                  <Label>End Time</Label>
                  <Select 
                    value={quickFillData.endTime} 
                    onValueChange={(v) => setQuickFillData(prev => ({ ...prev, endTime: v }))}
                  >
                    <SelectTrigger data-testid="select-quickfill-end-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.slice(1).map(time => (
                        <SelectItem 
                          key={time} 
                          value={time}
                          disabled={parseTimeToMinutes(time) <= parseTimeToMinutes(quickFillData.startTime)}
                        >
                          {formatTime(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Division Restriction</Label>
                <Select 
                  value={quickFillData.divisionId || 'open'} 
                  onValueChange={(v) => setQuickFillData(prev => ({ ...prev, divisionId: v === 'open' ? null : v }))}
                >
                  <SelectTrigger data-testid="select-quickfill-division">
                    <SelectValue placeholder="Open to all divisions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open to All Divisions</SelectItem>
                    {ageDivisions.map(div => (
                      <SelectItem key={div.id} value={div.id}>{div.name} Only</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Diamonds to Reserve</Label>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="h-auto p-0 text-xs"
                    onClick={() => {
                      const allSelected = quickFillData.selectedDiamonds.length === diamonds.length;
                      setQuickFillData(prev => ({
                        ...prev,
                        selectedDiamonds: allSelected ? [] : diamonds.map(d => d.id)
                      }));
                    }}
                    data-testid="button-quickfill-toggle-all"
                  >
                    {quickFillData.selectedDiamonds.length === diamonds.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg max-h-[150px] overflow-y-auto">
                  {diamonds.map(diamond => (
                    <label 
                      key={diamond.id} 
                      className="flex items-center gap-2 p-2 rounded hover:bg-white cursor-pointer"
                      data-testid={`checkbox-quickfill-diamond-${diamond.id}`}
                    >
                      <Checkbox 
                        checked={quickFillData.selectedDiamonds.includes(diamond.id)}
                        onCheckedChange={(checked) => {
                          setQuickFillData(prev => ({
                            ...prev,
                            selectedDiamonds: checked 
                              ? [...prev.selectedDiamonds, diamond.id]
                              : prev.selectedDiamonds.filter(id => id !== diamond.id)
                          }));
                        }}
                      />
                      <span className="text-sm">{diamond.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setShowQuickFillDialog(false)} data-testid="button-quickfill-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handleQuickFill}
                disabled={quickFillData.selectedDiamonds.length === 0 || bulkCreateMutation.isPending}
                data-testid="button-quickfill-submit"
              >
                {bulkCreateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Reserve {quickFillData.selectedDiamonds.length} Diamonds
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showCopyDayDialog} onOpenChange={setShowCopyDayDialog}>
          <DialogContent className="sm:max-w-md" data-testid="dialog-copy-day">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="w-5 h-5 text-blue-500" />
                Copy Day Allocations
              </DialogTitle>
              <DialogDescription>
                Clone all {allocationsForDate.length} time blocks from {formatDateShort(activeDate)} to another day.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">
                  <strong>Copying from:</strong> {formatDateLong(activeDate)}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {allocationsForDate.length} time blocks • {stats.totalHours} total hours
                </p>
              </div>
              
              <div className="space-y-2">
                <Label>Copy To</Label>
                <Select 
                  value={copyDayData.targetDate} 
                  onValueChange={(v) => setCopyDayData({ targetDate: v })}
                >
                  <SelectTrigger data-testid="select-copyday-target">
                    <SelectValue placeholder="Select target date" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournamentDates
                      .filter(date => date !== activeDate)
                      .map(date => (
                        <SelectItem key={date} value={date}>{formatDateLong(date)}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setShowCopyDayDialog(false)} data-testid="button-copyday-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handleCopyDay}
                disabled={!copyDayData.targetDate || bulkCreateMutation.isPending}
                data-testid="button-copyday-submit"
              >
                {bulkCreateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Copy Allocations
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
