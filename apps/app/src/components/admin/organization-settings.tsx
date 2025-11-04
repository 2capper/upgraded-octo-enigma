import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Edit, Building2, Loader2, Palette, Clock, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import type { Organization } from '@shared/schema';
import { poolPlayFormats, type PlayoffFormatOption } from '@shared/playoffFormats';
import { seedingPatternOptions, type SeedingPattern } from '@shared/seedingPatterns';

interface EditOrganizationDialogProps {
  organization: Organization;
  onSuccess: () => void;
}

function EditOrganizationDialog({ organization, onSuccess }: EditOrganizationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    timezone: organization.timezone || 'America/Toronto',
    defaultPrimaryColor: organization.defaultPrimaryColor || '#22c55e',
    defaultSecondaryColor: organization.defaultSecondaryColor || '#ffffff',
    defaultPlayoffFormat: organization.defaultPlayoffFormat || 'top_6',
    defaultSeedingPattern: organization.defaultSeedingPattern || 'standard',
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('PUT', `/api/organizations/${organization.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({
        title: "Organization Updated",
        description: "Settings have been saved successfully.",
      });
      setIsOpen(false);
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update organization settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const timezones = [
    { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
    { value: 'America/New_York', label: 'Eastern Time (New York)' },
    { value: 'America/Chicago', label: 'Central Time' },
    { value: 'America/Denver', label: 'Mountain Time' },
    { value: 'America/Los_Angeles', label: 'Pacific Time' },
    { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
    { value: 'America/Edmonton', label: 'Mountain Time (Edmonton)' },
    { value: 'America/Winnipeg', label: 'Central Time (Winnipeg)' },
    { value: 'America/Halifax', label: 'Atlantic Time' },
    { value: 'America/St_Johns', label: 'Newfoundland Time' },
  ];

  // Use pool play formats as default options for organization settings
  const playoffFormats = poolPlayFormats;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-edit-org-${organization.slug}`}>
          <Edit className="w-4 h-4 mr-2" />
          Edit Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Organization Settings</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Timezone */}
          <div className="space-y-2">
            <Label htmlFor="timezone" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Default Timezone
            </Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger id="timezone" data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timezones.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Used for displaying game times in tournament schedules
            </p>
          </div>

          {/* Default Colors */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Default Tournament Colors
            </Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.defaultPrimaryColor}
                    onChange={(e) => setFormData({ ...formData, defaultPrimaryColor: e.target.value })}
                    className="w-20 h-10"
                    data-testid="input-primary-color"
                  />
                  <Input
                    type="text"
                    value={formData.defaultPrimaryColor}
                    onChange={(e) => setFormData({ ...formData, defaultPrimaryColor: e.target.value })}
                    className="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#22c55e"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.defaultSecondaryColor}
                    onChange={(e) => setFormData({ ...formData, defaultSecondaryColor: e.target.value })}
                    className="w-20 h-10"
                    data-testid="input-secondary-color"
                  />
                  <Input
                    type="text"
                    value={formData.defaultSecondaryColor}
                    onChange={(e) => setFormData({ ...formData, defaultSecondaryColor: e.target.value })}
                    className="flex-1"
                    pattern="^#[0-9A-Fa-f]{6}$"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              New tournaments will use these colors by default
            </p>
          </div>

          {/* Default Playoff Format */}
          <div className="space-y-2">
            <Label htmlFor="playoffFormat" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Default Playoff Format
            </Label>
            <Select
              value={formData.defaultPlayoffFormat}
              onValueChange={(value) => setFormData({ ...formData, defaultPlayoffFormat: value })}
            >
              <SelectTrigger id="playoffFormat" data-testid="select-playoff-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {playoffFormats.map((format) => (
                  <SelectItem key={format.value} value={format.value}>
                    {format.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {playoffFormats.find(f => f.value === formData.defaultPlayoffFormat)?.description || 'Select a playoff format'}
            </p>
          </div>
          
          {/* Default Seeding Pattern */}
          <div className="space-y-2">
            <Label htmlFor="seedingPattern" className="flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Default Seeding Pattern
            </Label>
            <Select
              value={formData.defaultSeedingPattern}
              onValueChange={(value) => setFormData({ ...formData, defaultSeedingPattern: value })}
            >
              <SelectTrigger id="seedingPattern" data-testid="select-seeding-pattern">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seedingPatternOptions.map((pattern) => (
                  <SelectItem key={pattern.value} value={pattern.value}>
                    {pattern.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {seedingPatternOptions.find(p => p.value === formData.defaultSeedingPattern)?.description || 'Select a seeding pattern'}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={updateMutation.isPending}
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="min-h-[48px] font-semibold"
              style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
              data-testid="button-save-settings"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationSettings() {
  const { toast } = useToast();

  const { data: organizations, isLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!organizations || organizations.length === 0) {
    return (
      <div className="text-center py-12">
        <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Organizations</h3>
        <p className="text-muted-foreground">
          Create an organization first to manage its settings.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Settings className="w-4 h-4" />
        <AlertDescription>
          Configure default settings for each organization. These settings will be applied to new tournaments created within the organization.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {organizations.map((org) => (
          <Card key={org.id} className="border-2" data-testid={`card-org-${org.slug}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    {org.name}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {org.description || 'No description provided'}
                  </CardDescription>
                </div>
                <EditOrganizationDialog
                  organization={org}
                  onSuccess={() => {
                    // Callback after successful update
                  }}
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Timezone Display */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Timezone
                  </div>
                  <p className="text-sm font-mono" data-testid={`text-timezone-${org.slug}`}>
                    {org.timezone || 'America/Toronto'}
                  </p>
                </div>

                {/* Colors Display */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Palette className="w-4 h-4" />
                    Default Colors
                  </div>
                  <div className="flex gap-2 items-center">
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: org.defaultPrimaryColor || '#22c55e' }}
                      title="Primary"
                      data-testid={`color-primary-${org.slug}`}
                    />
                    <div
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: org.defaultSecondaryColor || '#ffffff' }}
                      title="Secondary"
                      data-testid={`color-secondary-${org.slug}`}
                    />
                  </div>
                </div>

                {/* Playoff Format Display */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Trophy className="w-4 h-4" />
                    Default Playoff Format
                  </div>
                  <p className="text-sm" data-testid={`text-playoff-format-${org.slug}`}>
                    {poolPlayFormats.find(f => f.value === org.defaultPlayoffFormat)?.label || 'Top 6 Teams'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
