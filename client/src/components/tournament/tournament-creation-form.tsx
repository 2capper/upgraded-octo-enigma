import { useState, useEffect } from 'react';
import { Plus, Calendar, Type, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insertTournamentSchema } from '@shared/schema';

interface TournamentCreationFormProps {
  onSuccess?: (tournament: any) => void;
  showForm?: boolean;
}

export const TournamentCreationForm = ({ onSuccess, showForm = false }: TournamentCreationFormProps) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    date: '',
  });
  const [isOpen, setIsOpen] = useState(showForm);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Update form visibility when showForm prop changes
  useEffect(() => {
    setIsOpen(showForm);
  }, [showForm]);

  const createTournamentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create tournament');
      return response.json();
    },
    onSuccess: (tournament) => {
      toast({
        title: "Tournament Created",
        description: `Tournament "${tournament.name}" has been successfully created.`,
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => window.open(`/tournament/${tournament.id}`, '_blank')}
          >
            View Tournament
          </Button>
        ),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      setFormData({ id: '', name: '', date: '' });
      setIsOpen(false);
      if (onSuccess) onSuccess(tournament);
    },
    onError: (error) => {
      toast({
        title: "Creation Failed",
        description: "Failed to create tournament. Please check your input and try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validatedData = insertTournamentSchema.parse(formData);
      createTournamentMutation.mutate(validatedData);
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
    }
  };

  const generateTournamentId = () => {
    const name = formData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const date = formData.date ? new Date(formData.date).toISOString().slice(0, 7) : '';
    return `${name}-${date}`.replace(/--+/g, '-');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-generate ID when name or date changes
    if (field === 'name' || field === 'date') {
      const updatedData = { ...formData, [field]: value };
      const name = updatedData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const date = updatedData.date ? new Date(updatedData.date).toISOString().slice(0, 7) : '';
      const generatedId = `${name}-${date}`.replace(/--+/g, '-');
      setFormData(prev => ({ ...prev, id: generatedId }));
    }
  };



  if (!isOpen) {
    return (
      <Button 
        onClick={() => setIsOpen(true)}
        className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Click Here to Create New Tournament
      </Button>
    );
  }

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Plus className="w-5 h-5 text-[var(--falcons-green)] mr-2" />
          Create New Tournament
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="tournamentName">Tournament Name</Label>
            <Input
              id="tournamentName"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="e.g., Spring Championship 2024"
              required
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="tournamentDate">Tournament Date</Label>
            <Input
              id="tournamentDate"
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              required
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="tournamentId">Tournament ID</Label>
            <Input
              id="tournamentId"
              value={formData.id}
              onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value }))}
              placeholder="Auto-generated from name and date"
              required
              className="mt-1 font-mono text-sm"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">
                This ID will be used in URLs and data references
              </p>
              {formData.id && (
                <p className="text-xs text-blue-600 font-mono">
                  URL: /tournament/{formData.id}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={createTournamentMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createTournamentMutation.isPending}
              className="bg-[var(--falcons-green)] text-white hover:bg-[var(--falcons-dark-green)]"
            >
              {createTournamentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};