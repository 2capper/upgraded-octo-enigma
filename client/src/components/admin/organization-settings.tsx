import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Edit, Building2, Loader2, Palette, Clock, Trophy, Image, MapPin, Plus, Trash2, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import type { Organization, Diamond, InsertDiamond } from '@shared/schema';
import { insertDiamondSchema } from '@shared/schema';
import { poolPlayFormats, type PlayoffFormatOption } from '@shared/playoffFormats';
import { seedingPatternOptions, type SeedingPattern } from '@shared/seedingPatterns';

interface EditOrganizationDialogProps {
  organization: Organization;
  onSuccess: () => void;
}

function EditOrganizationDialog({ organization, onSuccess }: EditOrganizationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  
  const [formData, setFormData] = useState({
    logoUrl: organization.logoUrl || '',
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
          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logoUrl" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Organization Logo URL
            </Label>
            <Input
              id="logoUrl"
              type="url"
              value={formData.logoUrl}
              onChange={(e) => {
                setFormData({ ...formData, logoUrl: e.target.value });
                setLogoPreviewError(false);
              }}
              placeholder="https://example.com/logo.png"
              data-testid="input-logo-url"
            />
            <p className="text-sm text-muted-foreground">
              URL to your organization's logo image (displayed on tournament cards)
            </p>
            {formData.logoUrl && !logoPreviewError && (
              <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-2">Logo Preview:</p>
                <img 
                  key={formData.logoUrl}
                  src={formData.logoUrl} 
                  alt="Organization logo preview" 
                  className="h-16 object-contain"
                  onLoad={() => setLogoPreviewError(false)}
                  onError={() => setLogoPreviewError(true)}
                />
              </div>
            )}
            {formData.logoUrl && logoPreviewError && (
              <div className="mt-2 p-4 border rounded-lg bg-destructive/10 text-destructive">
                <p className="text-sm">Unable to load image from this URL</p>
              </div>
            )}
          </div>

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

interface DiamondFormDialogProps {
  organizationId: string;
  diamond?: Diamond;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function DiamondFormDialog({ organizationId, diamond, isOpen, onOpenChange }: DiamondFormDialogProps) {
  const { toast } = useToast();
  const isEdit = !!diamond;

  const form = useForm<InsertDiamond>({
    resolver: zodResolver(insertDiamondSchema),
    defaultValues: {
      organizationId,
      name: diamond?.name || '',
      location: diamond?.location || '',
      availableStartTime: diamond?.availableStartTime || '08:00',
      availableEndTime: diamond?.availableEndTime || '20:00',
      hasLights: diamond?.hasLights || false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertDiamond) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/diamonds`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'diamonds'] });
      toast({
        title: "Diamond Created",
        description: "The diamond has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create diamond. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertDiamond) => {
      return apiRequest('PUT', `/api/diamonds/${diamond?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'diamonds'] });
      toast({
        title: "Diamond Updated",
        description: "The diamond has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update diamond. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertDiamond) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Diamond' : 'Create Diamond'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the diamond information.' : 'Add a new diamond/field to your organization.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Diamond 1, Field A, etc."
                      data-testid="input-diamond-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      placeholder="Park name, address, or field location"
                      data-testid="input-diamond-location"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional location details for this diamond
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="availableStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available Start Time</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="time"
                        data-testid="input-diamond-start-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="availableEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Available End Time</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="time"
                        data-testid="input-diamond-end-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="hasLights"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-diamond-has-lights"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="flex items-center gap-2">
                      <Lightbulb className="w-4 h-4" />
                      Has Lights
                    </FormLabel>
                    <FormDescription>
                      This diamond has lights for evening games
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-diamond"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-diamond"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEdit ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>{isEdit ? 'Update Diamond' : 'Create Diamond'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface DiamondManagementProps {
  organizationId: string;
  organizationSlug: string;
}

function DiamondManagement({ organizationId, organizationSlug }: DiamondManagementProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDiamond, setEditingDiamond] = useState<Diamond | null>(null);

  const { data: diamonds, isLoading } = useQuery<Diamond[]>({
    queryKey: ['/api/organizations', organizationId, 'diamonds'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (diamondId: string) => {
      return apiRequest('DELETE', `/api/diamonds/${diamondId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'diamonds'] });
      toast({
        title: "Diamond Deleted",
        description: "The diamond has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete diamond. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (diamond: Diamond) => {
    if (confirm(`Are you sure you want to delete "${diamond.name}"?`)) {
      deleteMutation.mutate(diamond.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Diamonds</h3>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          size="sm"
          data-testid={`button-create-diamond-${organizationSlug}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Diamond
        </Button>
      </div>

      {!diamonds || diamonds.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <MapPin className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No diamonds configured yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Available Hours</TableHead>
                <TableHead className="text-center">Has Lights</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diamonds.map((diamond) => (
                <TableRow key={diamond.id} data-testid={`row-diamond-${diamond.id}`}>
                  <TableCell className="font-medium" data-testid={`text-diamond-name-${diamond.id}`}>
                    {diamond.name}
                  </TableCell>
                  <TableCell data-testid={`text-diamond-location-${diamond.id}`}>
                    {diamond.location || (
                      <span className="text-muted-foreground italic">No location</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-diamond-hours-${diamond.id}`}>
                    {diamond.availableStartTime} - {diamond.availableEndTime}
                  </TableCell>
                  <TableCell className="text-center">
                    {diamond.hasLights ? (
                      <div className="flex items-center justify-center gap-1" data-testid={`icon-has-lights-${diamond.id}`}>
                        <Lightbulb className="w-4 h-4 text-yellow-500" />
                        <span className="text-sm">Yes</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground" data-testid={`text-no-lights-${diamond.id}`}>
                        No
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingDiamond(diamond)}
                        data-testid={`button-edit-diamond-${diamond.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(diamond)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-diamond-${diamond.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DiamondFormDialog
        organizationId={organizationId}
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {editingDiamond && (
        <DiamondFormDialog
          organizationId={organizationId}
          diamond={editingDiamond}
          isOpen={!!editingDiamond}
          onOpenChange={(open) => !open && setEditingDiamond(null)}
        />
      )}
    </div>
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
              <div className="space-y-6">
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

                {/* Diamonds Management Section */}
                <div className="pt-4 border-t">
                  <DiamondManagement organizationId={org.id} organizationSlug={org.slug} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
