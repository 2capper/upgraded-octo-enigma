import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Edit, MoreVertical, Eye } from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { insertTournamentSchema } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';

const updateTournamentSchema = insertTournamentSchema.partial();
type UpdateTournamentData = z.infer<typeof updateTournamentSchema>;

interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface TournamentManagerProps {
  tournaments: Tournament[];
}

export function TournamentManager({ tournaments }: TournamentManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);

  // Update tournament mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTournamentData }) => {
      const response = await apiRequest('PUT', `/api/tournaments/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      toast({
        title: 'Tournament Updated',
        description: 'Tournament details have been updated successfully.',
      });
      setEditingTournament(null);
    },
    onError: (error) => {
      toast({
        title: 'Update Failed',
        description: 'Failed to update tournament. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Delete tournament mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/tournaments/${id}`);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      toast({
        title: 'Tournament Deleted',
        description: 'Tournament has been deleted successfully.',
      });
      setDeletingTournament(null);
    },
    onError: (error) => {
      toast({
        title: 'Delete Failed',
        description: 'Failed to delete tournament. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const form = useForm<UpdateTournamentData>({
    resolver: zodResolver(updateTournamentSchema),
    defaultValues: {
      name: '',
      startDate: '',
      endDate: '',
    },
  });

  const handleEdit = (tournament: Tournament) => {
    setEditingTournament(tournament);
    form.reset({
      name: tournament.name,
      startDate: tournament.startDate,
      endDate: tournament.endDate,
    });
  };

  const handleUpdate = (data: UpdateTournamentData) => {
    if (editingTournament) {
      updateMutation.mutate({ id: editingTournament.id, data });
    }
  };

  const handleDelete = () => {
    if (deletingTournament) {
      deleteMutation.mutate(deletingTournament.id);
    }
  };

  return (
    <>
      <div className="space-y-3">
        {tournaments.map((tournament) => (
          <div key={tournament.id} className="flex items-center justify-between p-4 border rounded-lg bg-white hover:shadow-sm transition-shadow">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{tournament.name}</h4>
              <p className="text-sm text-gray-600 mt-1">
                {new Date(tournament.startDate).toLocaleDateString()} - {new Date(tournament.endDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-500 mt-1">ID: {tournament.id}</p>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocation(`/tournament/${tournament.id}`)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Tournament
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleEdit(tournament)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeletingTournament(tournament)}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingTournament} onOpenChange={(open) => !open && setEditingTournament(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tournament</DialogTitle>
            <DialogDescription>
              Update the tournament details below.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tournament Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTournament(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]/90"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Updating...' : 'Update'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingTournament} onOpenChange={(open) => !open && setDeletingTournament(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tournament</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingTournament?.name}"? This action cannot be undone.
              All associated data (teams, games, etc.) will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingTournament(null)}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Tournament'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}