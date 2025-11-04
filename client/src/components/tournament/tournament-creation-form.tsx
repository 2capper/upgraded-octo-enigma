import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Calendar, Type, Loader2, Users, Trophy, Palette, Image, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { tournamentCreationSchema, type Organization } from '@shared/schema';
import { getAvailablePlayoffFormats, getDefaultPlayoffFormat, type PlayoffFormat } from '@shared/playoffFormats';
import { getAvailableSeedingPatterns, getDefaultSeedingPattern, type SeedingPattern } from '@shared/seedingPatterns';

interface TournamentCreationFormProps {
  onSuccess?: (tournament: any) => void;
  showForm?: boolean;
}

export const TournamentCreationForm = ({ onSuccess, showForm = false }: TournamentCreationFormProps) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    organizationId: '',
    startDate: '',
    endDate: '',
    type: 'pool_play' as const,
    numberOfTeams: 8,
    numberOfPools: 2,
    numberOfPlayoffTeams: 6, // DEPRECATED - for backwards compatibility
    playoffFormat: null as PlayoffFormat | null,
    seedingPattern: null as SeedingPattern | null,
    showTiebreakers: true,
    customName: '',
    primaryColor: '#22c55e',
    secondaryColor: '#ffffff',
    logoUrl: '',
  });
  const [isOpen, setIsOpen] = useState(showForm);
  const lastPopulatedOrgIdRef = useRef<string | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch organizations for selection
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });
  
  // Update form visibility when showForm prop changes
  useEffect(() => {
    setIsOpen(showForm);
  }, [showForm]);

  // Auto-populate form fields with organization defaults when organization is selected for the first time
  useEffect(() => {
    // Only populate if a new organization is selected (not already populated)
    if (formData.organizationId && 
        formData.organizationId !== lastPopulatedOrgIdRef.current && 
        organizations) {
      const selectedOrg = organizations.find(org => org.id === formData.organizationId);
      if (selectedOrg) {
        setFormData(prev => ({
          ...prev,
          playoffFormat: (selectedOrg.defaultPlayoffFormat as PlayoffFormat) || prev.playoffFormat,
          seedingPattern: (selectedOrg.defaultSeedingPattern as SeedingPattern) || prev.seedingPattern,
          primaryColor: selectedOrg.defaultPrimaryColor || selectedOrg.primaryColor || prev.primaryColor,
          secondaryColor: selectedOrg.defaultSecondaryColor || selectedOrg.secondaryColor || prev.secondaryColor,
          logoUrl: selectedOrg.logoUrl || prev.logoUrl,
        }));
        // Track that we've populated for this organization
        lastPopulatedOrgIdRef.current = formData.organizationId;
      }
    }
    // Reset tracking when organization is cleared
    if (!formData.organizationId) {
      lastPopulatedOrgIdRef.current = null;
    }
  }, [formData.organizationId, organizations]);

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
      setFormData({ 
        id: '', 
        name: '',
        organizationId: '',
        startDate: '', 
        endDate: '', 
        type: 'pool_play' as const,
        numberOfTeams: 8,
        numberOfPools: 2,
        numberOfPlayoffTeams: 6,
        playoffFormat: null,
        seedingPattern: null,
        showTiebreakers: true,
        customName: '',
        primaryColor: '#22c55e',
        secondaryColor: '#ffffff',
        logoUrl: '',
      });
      lastPopulatedOrgIdRef.current = null; // Reset tracking for next tournament
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
      const validatedData = tournamentCreationSchema.parse(formData);
      createTournamentMutation.mutate(validatedData);
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly.",
        variant: "destructive",
      });
    }
  };



  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-generate ID when name or startDate changes
    if (field === 'name' || field === 'startDate') {
      const updatedData = { ...formData, [field]: value };
      const name = updatedData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const date = updatedData.startDate ? new Date(updatedData.startDate).toISOString().slice(0, 7) : '';
      const generatedId = `${name}-${date}`.replace(/--+/g, '-');
      setFormData(prev => ({ ...prev, id: generatedId }));
    }
    
    // Auto-select default playoff format when tournament type or team count changes
    if (field === 'type' || field === 'numberOfTeams') {
      const updatedData = { ...formData, [field]: value };
      const defaultFormat = getDefaultPlayoffFormat(
        updatedData.type,
        updatedData.numberOfTeams
      );
      const defaultSeeding = getDefaultSeedingPattern(
        defaultFormat,
        updatedData.numberOfPools
      );
      setFormData(prev => ({ ...prev, playoffFormat: defaultFormat, seedingPattern: defaultSeeding }));
    }
    
    // Auto-select default seeding pattern when playoff format or pool count changes
    if (field === 'playoffFormat' || field === 'numberOfPools') {
      const updatedData = { ...formData, [field]: value };
      const defaultSeeding = getDefaultSeedingPattern(
        updatedData.playoffFormat,
        updatedData.numberOfPools
      );
      setFormData(prev => ({ ...prev, seedingPattern: defaultSeeding }));
    }
  };
  
  // Calculate available playoff formats based on current settings
  const availablePlayoffFormats = useMemo(() => {
    return getAvailablePlayoffFormats(formData.type, formData.numberOfTeams);
  }, [formData.type, formData.numberOfTeams]);
  
  // Calculate available seeding patterns based on playoff format and pool count
  const availableSeedingPatterns = useMemo(() => {
    return getAvailableSeedingPatterns(formData.playoffFormat, formData.numberOfPools);
  }, [formData.playoffFormat, formData.numberOfPools]);



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
              data-testid="input-tournament-name"
            />
          </div>

          <div>
            <Label htmlFor="organization">
              <Building2 className="w-4 h-4 inline mr-1" />
              Organization
            </Label>
            {orgsLoading ? (
              <div className="mt-1 p-2 border rounded-md bg-gray-50 text-gray-500 text-sm">
                Loading organizations...
              </div>
            ) : organizations && organizations.length > 0 ? (
              <Select 
                value={formData.organizationId} 
                onValueChange={(value) => handleInputChange('organizationId', value)}
                required
              >
                <SelectTrigger className="mt-1" data-testid="select-organization">
                  <SelectValue placeholder="Select an organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id} data-testid={`option-org-${org.slug}`}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-1 p-3 border border-yellow-300 rounded-md bg-yellow-50 text-yellow-800 text-sm">
                <p className="font-medium mb-1">No organizations available</p>
                <p className="text-xs">Please contact a super admin to create an organization first.</p>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                required
                className="mt-1"
                min={formData.startDate}
              />
            </div>
          </div>
          
          {/* Tournament Configuration */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Trophy className="w-4 h-4 mr-2" />
              Tournament Configuration
            </h3>
            
            <div>
              <Label htmlFor="tournamentType">Tournament Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select tournament type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pool_play">Pool Play with Playoffs</SelectItem>
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="numberOfTeams">Number of Teams</Label>
              <Input
                id="numberOfTeams"
                type="number"
                min="4"
                max="64"
                value={formData.numberOfTeams}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    handleInputChange('numberOfTeams', '' as any);
                  } else {
                    handleInputChange('numberOfTeams', parseInt(val) || 8);
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                    handleInputChange('numberOfTeams', 8);
                  }
                }}
                className="mt-1"
                data-testid="input-number-of-teams"
              />
            </div>
            
            {formData.type === 'pool_play' && (
              <>
                <div>
                  <Label htmlFor="numberOfPools">Number of Pools</Label>
                  <Input
                    id="numberOfPools"
                    type="number"
                    min="1"
                    max="8"
                    value={formData.numberOfPools}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        handleInputChange('numberOfPools', '' as any);
                      } else {
                        handleInputChange('numberOfPools', parseInt(val) || 2);
                      }
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '' || isNaN(parseInt(e.target.value))) {
                        handleInputChange('numberOfPools', 2);
                      }
                    }}
                    className="mt-1"
                    data-testid="input-number-of-pools"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="showTiebreakers"
                    checked={formData.showTiebreakers}
                    onCheckedChange={(checked) => handleInputChange('showTiebreakers', checked)}
                  />
                  <Label htmlFor="showTiebreakers" className="text-sm">
                    Show detailed tiebreaker information in standings
                  </Label>
                </div>
              </>
            )}
            
            <div>
              <Label htmlFor="playoffFormat">Playoff Format</Label>
              <Select 
                value={formData.playoffFormat || ''} 
                onValueChange={(value) => handleInputChange('playoffFormat', value)}
              >
                <SelectTrigger className="mt-1" data-testid="select-playoff-format">
                  <SelectValue placeholder="Select playoff format" />
                </SelectTrigger>
                <SelectContent>
                  {availablePlayoffFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.playoffFormat && (
                <p className="text-xs text-gray-500 mt-1">
                  {availablePlayoffFormats.find(f => f.value === formData.playoffFormat)?.description}
                </p>
              )}
            </div>
            
            {formData.type === 'pool_play' && formData.playoffFormat && availableSeedingPatterns.length > 0 && (
              <div>
                <Label htmlFor="seedingPattern">Seeding Pattern</Label>
                <Select 
                  value={formData.seedingPattern || ''} 
                  onValueChange={(value) => handleInputChange('seedingPattern', value)}
                >
                  <SelectTrigger className="mt-1" data-testid="select-seeding-pattern">
                    <SelectValue placeholder="Select seeding pattern" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSeedingPatterns.map((pattern) => (
                      <SelectItem key={pattern.value} value={pattern.value}>
                        {pattern.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.seedingPattern && (
                  <p className="text-xs text-gray-500 mt-1">
                    {availableSeedingPatterns.find(p => p.value === formData.seedingPattern)?.description}
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Branding & Appearance Section */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-900 flex items-center">
              <Palette className="w-4 h-4 mr-2" />
              Branding & Appearance
            </h3>
            
            <div>
              <Label htmlFor="customName">Custom Tournament Display Name</Label>
              <Input
                id="customName"
                type="text"
                value={formData.customName}
                onChange={(e) => handleInputChange('customName', e.target.value)}
                placeholder="e.g., Forest Glade Falcons Championship"
                className="mt-1"
                data-testid="input-custom-name"
              />
              <p className="text-xs text-gray-500 mt-1">
                Optional display name that will appear throughout the tournament interface
              </p>
            </div>
            
            <div>
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center space-x-3 mt-1">
                <Input
                  id="primaryColor"
                  type="color"
                  value={formData.primaryColor}
                  onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  className="w-16 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                  data-testid="input-primary-color"
                />
                <Input
                  type="text"
                  value={formData.primaryColor}
                  onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                  placeholder="#22c55e"
                  className="flex-1 font-mono text-sm"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  data-testid="input-primary-color-text"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Main color for backgrounds, buttons, and tabs
              </p>
            </div>
            
            <div>
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex items-center space-x-3 mt-1">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={formData.secondaryColor}
                  onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                  className="w-16 h-10 p-1 border border-gray-300 rounded cursor-pointer"
                  data-testid="input-secondary-color"
                />
                <Input
                  type="text"
                  value={formData.secondaryColor}
                  onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                  placeholder="#ffffff"
                  className="flex-1 font-mono text-sm"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  data-testid="input-secondary-color-text"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Text color on primary backgrounds (typically white or contrasting color)
              </p>
            </div>
            
            <div>
              <Label htmlFor="logoUrl">Tournament Logo URL</Label>
              <Input
                id="logoUrl"
                type="url"
                value={formData.logoUrl}
                onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                placeholder="https://example.com/logo.png"
                className="mt-1"
                data-testid="input-logo-url"
              />
              <p className="text-xs text-gray-500 mt-1">
                URL to a logo image that will be displayed in the tournament header
              </p>
            </div>
            
            {/* Logo Preview */}
            {formData.logoUrl && (
              <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md">
                <p className="text-xs text-gray-600 mb-2">Logo Preview:</p>
                <img 
                  src={formData.logoUrl} 
                  alt="Tournament Logo Preview" 
                  className="max-h-16 max-w-32 object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  data-testid="img-logo-preview"
                />
              </div>
            )}
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
              className="min-h-[48px] font-semibold"
              style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
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