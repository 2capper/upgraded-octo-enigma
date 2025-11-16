import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Edit, Building2, Loader2, Palette, Clock, Trophy, Image, MapPin, Plus, Trash2, Lightbulb, ShieldAlert, Calendar, RefreshCw, AlertCircle, CheckCircle2, Mail, Phone, User, Users, Send, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import type { Organization, Diamond, InsertDiamond, OrganizationIcalFeed, InsertOrganizationIcalFeed, OrganizationCoordinator, InsertOrganizationCoordinator, CoachInvitation, HouseLeagueTeam } from '@shared/schema';
import { insertDiamondSchema, insertOrganizationIcalFeedSchema, insertOrganizationCoordinatorSchema } from '@shared/schema';
import { poolPlayFormats, type PlayoffFormatOption } from '@shared/playoffFormats';
import { seedingPatternOptions, type SeedingPattern } from '@shared/seedingPatterns';
import { z } from 'zod';

interface DiamondRestriction {
  id: string;
  division: string;
  allowedDiamonds: string[];
  reason?: string;
}

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
      latitude: diamond?.latitude || '',
      longitude: diamond?.longitude || '',
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
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="e.g., 42.12345"
                        data-testid="input-diamond-latitude"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="e.g., -82.12345"
                        data-testid="input-diamond-longitude"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormDescription className="!mt-2">
              Optional coordinates for precise walking directions. If left blank, directions will use the main location address.
            </FormDescription>

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

interface DiamondRestrictionManagementProps {
  organizationId: string;
  organizationSlug: string;
}

function DiamondRestrictionManagement({ organizationId, organizationSlug }: DiamondRestrictionManagementProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRestriction, setEditingRestriction] = useState<DiamondRestriction | null>(null);

  const { data: restrictions, isLoading } = useQuery<DiamondRestriction[]>({
    queryKey: [`/api/organizations/${organizationId}/diamond-restrictions`],
  });

  const { data: diamonds } = useQuery<Diamond[]>({
    queryKey: [`/api/organizations/${organizationId}/diamonds`],
  });

  const deleteMutation = useMutation({
    mutationFn: async (restrictionId: string) => {
      return await apiRequest("DELETE", `/api/diamond-restrictions/${restrictionId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/diamond-restrictions`] });
      toast({
        title: "Restriction Deleted",
        description: "The diamond restriction has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete diamond restriction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (restriction: DiamondRestriction) => {
    if (confirm(`Are you sure you want to delete the restriction for ${restriction.division}?`)) {
      deleteMutation.mutate(restriction.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const divisions = ['9U', '11U', '13U', '15U', '18U', 'Senior Mens', 'T-Ball'];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Diamond Restrictions</h3>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          size="sm"
          data-testid={`button-create-restriction-${organizationSlug}`}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Restriction
        </Button>
      </div>

      <Alert>
        <ShieldAlert className="w-4 h-4" />
        <AlertDescription>
          Configure which diamonds each division is allowed to use. For example, restrict 15U/18U teams to larger diamonds only.
        </AlertDescription>
      </Alert>

      {!restrictions || restrictions.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <ShieldAlert className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No diamond restrictions configured. All divisions can use any diamond.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Division</TableHead>
                <TableHead>Allowed Diamonds</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restrictions.map((restriction) => (
                <TableRow key={restriction.id} data-testid={`row-restriction-${restriction.id}`}>
                  <TableCell className="font-medium" data-testid={`text-restriction-division-${restriction.id}`}>
                    {restriction.division}
                  </TableCell>
                  <TableCell data-testid={`text-restriction-diamonds-${restriction.id}`}>
                    <div className="flex flex-wrap gap-1">
                      {restriction.allowedDiamonds.map((name) => (
                        <span key={name} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                          {name}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-restriction-reason-${restriction.id}`}>
                    {restriction.reason || (
                      <span className="text-muted-foreground italic">No reason provided</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRestriction(restriction)}
                        data-testid={`button-edit-restriction-${restriction.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(restriction)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-restriction-${restriction.id}`}
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

      <DiamondRestrictionFormDialog
        organizationId={organizationId}
        divisions={divisions}
        diamonds={diamonds || []}
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {editingRestriction && (
        <DiamondRestrictionFormDialog
          organizationId={organizationId}
          divisions={divisions}
          diamonds={diamonds || []}
          restriction={editingRestriction}
          isOpen={!!editingRestriction}
          onOpenChange={(open) => !open && setEditingRestriction(null)}
        />
      )}
    </div>
  );
}

interface DiamondRestrictionFormDialogProps {
  organizationId: string;
  divisions: string[];
  diamonds: Diamond[];
  restriction?: DiamondRestriction;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function DiamondRestrictionFormDialog({ organizationId, divisions, diamonds, restriction, isOpen, onOpenChange }: DiamondRestrictionFormDialogProps) {
  const { toast } = useToast();
  const [selectedDiamonds, setSelectedDiamonds] = useState<string[]>(restriction?.allowedDiamonds || []);
  const [division, setDivision] = useState(restriction?.division || "");
  const [reason, setReason] = useState(restriction?.reason || "");
  const isEdit = !!restriction;

  const createMutation = useMutation({
    mutationFn: async (data: { division: string; allowedDiamonds: string[]; reason?: string }) => {
      return await apiRequest("POST", `/api/organizations/${organizationId}/diamond-restrictions`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/diamond-restrictions`] });
      toast({
        title: "Restriction Created",
        description: "Diamond restriction has been created successfully.",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create diamond restriction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { division: string; allowedDiamonds: string[]; reason?: string }) => {
      return await apiRequest("PUT", `/api/diamond-restrictions/${restriction!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/diamond-restrictions`] });
      toast({
        title: "Restriction Updated",
        description: "Diamond restriction has been updated successfully.",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update diamond restriction. Please try again.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setDivision("");
    setSelectedDiamonds([]);
    setReason("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!division) {
      toast({
        title: "Validation Error",
        description: "Please select a division.",
        variant: "destructive",
      });
      return;
    }

    if (selectedDiamonds.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one allowed diamond.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      division,
      allowedDiamonds: selectedDiamonds,
      reason: reason || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleDiamond = (diamondName: string) => {
    setSelectedDiamonds(prev =>
      prev.includes(diamondName)
        ? prev.filter(d => d !== diamondName)
        : [...prev, diamondName]
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Diamond Restriction' : 'Create Diamond Restriction'}</DialogTitle>
          <DialogDescription>
            Specify which diamonds this division is allowed to book.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="division">Division *</Label>
            <Select value={division} onValueChange={setDivision} disabled={isEdit}>
              <SelectTrigger id="division" data-testid="select-division">
                <SelectValue placeholder="Select division" />
              </SelectTrigger>
              <SelectContent>
                {divisions.map((div) => (
                  <SelectItem key={div} value={div} data-testid={`option-division-${div}`}>
                    {div}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">Division cannot be changed after creation</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Allowed Diamonds *</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
              {diamonds.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No diamonds available. Create diamonds first.
                </p>
              ) : (
                diamonds.map((diamond) => (
                  <div key={diamond.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`diamond-${diamond.id}`}
                      checked={selectedDiamonds.includes(diamond.name)}
                      onCheckedChange={() => toggleDiamond(diamond.name)}
                      data-testid={`checkbox-diamond-${diamond.id}`}
                    />
                    <label
                      htmlFor={`diamond-${diamond.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {diamond.name}
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedDiamonds.length} diamond(s) selected
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Diamond size requirements"
              rows={3}
              data-testid="input-reason"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-cancel-restriction"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-restriction"
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEdit ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>{isEdit ? 'Update Restriction' : 'Create Restriction'}</>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface CoordinatorCardProps {
  organizationId: string;
  role: 'select_coordinator' | 'diamond_coordinator' | 'uic' | 'treasurer';
  roleLabel: string;
  existingCoordinator?: OrganizationCoordinator;
}

function CoordinatorCard({ organizationId, role, roleLabel, existingCoordinator }: CoordinatorCardProps) {
  const { toast } = useToast();
  
  // Convert role with underscores to hyphens for test IDs
  const testIdRole = role.replace(/_/g, '-');
  
  const coordinatorSchema = insertOrganizationCoordinatorSchema.extend({
    email: z.string().email('Please enter a valid email address'),
  });

  const form = useForm<InsertOrganizationCoordinator>({
    resolver: zodResolver(coordinatorSchema),
    defaultValues: {
      organizationId,
      role,
      email: existingCoordinator?.email || '',
      phone: existingCoordinator?.phone || '',
      firstName: existingCoordinator?.firstName || '',
      lastName: existingCoordinator?.lastName || '',
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: InsertOrganizationCoordinator) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/coordinators`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'coordinators'] });
      toast({
        title: "Coordinator Saved",
        description: `${roleLabel} has been updated successfully.`,
      });
    },
    onError: () => {
      toast({
        title: "Save Failed",
        description: `Failed to save ${roleLabel}. Please try again.`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertOrganizationCoordinator) => {
    saveMutation.mutate(data);
  };

  return (
    <Card data-testid={`card-coordinator-${testIdRole}`}>
      <CardHeader>
        <CardTitle className="text-base">{roleLabel}</CardTitle>
        <CardDescription className="text-sm">
          Contact information for {roleLabel.toLowerCase()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm">
                    <Mail className="w-3.5 h-3.5" />
                    Email *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="coordinator@example.com"
                      data-testid={`input-${testIdRole}-email`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5 text-sm">
                    <Phone className="w-3.5 h-3.5" />
                    Phone
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value || ''}
                      type="tel"
                      placeholder="(555) 123-4567"
                      data-testid={`input-${testIdRole}-phone`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-sm">
                      <User className="w-3.5 h-3.5" />
                      First Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="John"
                        data-testid={`input-${testIdRole}-first-name`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-sm">
                      <User className="w-3.5 h-3.5" />
                      Last Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Doe"
                        data-testid={`input-${testIdRole}-last-name`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full"
              data-testid={`button-save-${testIdRole}`}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Coordinator'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

interface CoordinatorsManagementProps {
  organizationId: string;
}

function CoordinatorsManagement({ organizationId }: CoordinatorsManagementProps) {
  const { data: coordinators, isLoading } = useQuery<OrganizationCoordinator[]>({
    queryKey: ['/api/organizations', organizationId, 'coordinators'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const coordinatorRoles: Array<{
    role: 'select_coordinator' | 'diamond_coordinator' | 'uic' | 'treasurer';
    label: string;
  }> = [
    { role: 'select_coordinator', label: 'Select Coordinator' },
    { role: 'diamond_coordinator', label: 'Diamond Coordinator' },
    { role: 'uic', label: 'UIC (Umpire in Chief)' },
    { role: 'treasurer', label: 'Treasurer' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Organization Coordinators</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Manage coordinators who will receive booking approval notifications
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {coordinatorRoles.map(({ role, label }) => {
          const existingCoordinator = coordinators?.find((c) => c.role === role);
          return (
            <CoordinatorCard
              key={role}
              organizationId={organizationId}
              role={role}
              roleLabel={label}
              existingCoordinator={existingCoordinator}
            />
          );
        })}
      </div>
    </div>
  );
}

interface CoachInvitationsManagementProps {
  organizationId: string;
}

function CoachInvitationsManagement({ organizationId }: CoachInvitationsManagementProps) {
  const { toast } = useToast();
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const invitationSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
  });

  const form = useForm<{ email: string }>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
    },
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery<CoachInvitation[]>({
    queryKey: ['/api/organizations', organizationId, 'invitations'],
  });

  const { data: teams, isLoading: teamsLoading } = useQuery<HouseLeagueTeam[]>({
    queryKey: ['/api/organizations', organizationId, 'house-league-teams'],
  });

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { email: string; teamIds: string[] }) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/invitations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'invitations'] });
      toast({
        title: "Invitation Sent",
        description: "The coach invitation has been sent successfully.",
      });
      form.reset();
      setSelectedTeamIds([]);
    },
    onError: () => {
      toast({
        title: "Invitation Failed",
        description: "Failed to send invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const revokeInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      return apiRequest('DELETE', `/api/organizations/${organizationId}/invitations/${invitationId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'invitations'] });
      toast({
        title: "Invitation Revoked",
        description: "The coach invitation has been revoked successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Revoke Failed",
        description: "Failed to revoke invitation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: { email: string }) => {
    if (selectedTeamIds.length === 0) {
      toast({
        title: "No Teams Selected",
        description: "Please select at least one team for the invitation.",
        variant: "destructive",
      });
      return;
    }
    createInvitationMutation.mutate({ email: data.email, teamIds: selectedTeamIds });
  };

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const handleRevoke = (invitationId: string) => {
    if (confirm('Are you sure you want to revoke this invitation?')) {
      revokeInvitationMutation.mutate(invitationId);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
      case 'accepted':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Accepted</Badge>;
      case 'revoked':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Revoked</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTeamNames = (teamIds: string[]) => {
    if (!teams) return '';
    return teamIds
      .map(id => teams.find(t => t.id === id)?.name)
      .filter(Boolean)
      .join(', ');
  };

  if (invitationsLoading || teamsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Coach Invitations</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Invite coaches to access the booking system
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Invitation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send Invitation</CardTitle>
            <CardDescription>Invite a coach to manage team bookings</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        Coach Email *
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="coach@example.com"
                          data-testid="input-coach-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Teams *
                  </Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                    {!teams || teams.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No teams available. Create teams first.
                      </p>
                    ) : (
                      teams.map((team) => (
                        <div key={team.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`team-${team.id}`}
                            checked={selectedTeamIds.includes(team.id)}
                            onCheckedChange={() => toggleTeam(team.id)}
                            data-testid={`checkbox-team-${team.id}`}
                          />
                          <label
                            htmlFor={`team-${team.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {team.name} ({team.division})
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {selectedTeamIds.length} team(s) selected
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={createInvitationMutation.isPending}
                  className="w-full"
                  data-testid="button-send-invitation"
                >
                  {createInvitationMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Invitations List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sent Invitations</CardTitle>
            <CardDescription>Manage pending and accepted invitations</CardDescription>
          </CardHeader>
          <CardContent>
            {!invitations || invitations.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-muted/30">
                <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No invitations yet. Send one to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="border rounded-lg p-3 space-y-2"
                    data-testid={`invitation-${invitation.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <p className="font-medium text-sm" data-testid={`text-invitation-email-${invitation.id}`}>
                            {invitation.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(invitation.status)}
                          <span className="text-xs text-muted-foreground" data-testid={`text-invitation-date-${invitation.id}`}>
                            {formatDistanceToNow(new Date(invitation.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <Users className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <p className="text-xs text-muted-foreground" data-testid={`text-invitation-teams-${invitation.id}`}>
                            {getTeamNames(invitation.teamIds)}
                          </p>
                        </div>
                      </div>
                      {invitation.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevoke(invitation.id)}
                          disabled={revokeInvitationMutation.isPending}
                          data-testid={`button-revoke-${invitation.id}`}
                        >
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface ICalFeedFormDialogProps {
  organizationId: string;
  feed?: OrganizationIcalFeed;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

function ICalFeedFormDialog({ organizationId, feed, isOpen, onOpenChange }: ICalFeedFormDialogProps) {
  const { toast } = useToast();
  const isEdit = !!feed;

  const [mappings, setMappings] = useState<Array<{ wordpressLocation: string; diamondId: string }>>(
    feed?.diamondMapping 
      ? Object.entries(feed.diamondMapping as Record<string, string>).map(([wordpressLocation, diamondId]) => ({ 
          wordpressLocation, 
          diamondId 
        }))
      : [{ wordpressLocation: '', diamondId: '' }]
  );

  const { data: diamonds } = useQuery<Diamond[]>({
    queryKey: ['/api/organizations', organizationId, 'diamonds'],
  });

  const form = useForm<InsertOrganizationIcalFeed>({
    resolver: zodResolver(insertOrganizationIcalFeedSchema),
    defaultValues: {
      organizationId,
      name: feed?.name || '',
      feedUrl: feed?.feedUrl || '',
      diamondMapping: feed?.diamondMapping || {},
      isActive: feed?.isActive !== undefined ? feed.isActive : true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertOrganizationIcalFeed) => {
      return apiRequest('POST', `/api/organizations/${organizationId}/ical-feeds`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'ical-feeds'] });
      toast({
        title: "Feed Created",
        description: "The iCal feed has been created successfully.",
      });
      onOpenChange(false);
      form.reset();
      setMappings([{ wordpressLocation: '', diamondId: '' }]);
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create iCal feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertOrganizationIcalFeed) => {
      return apiRequest('PUT', `/api/ical-feeds/${feed?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'ical-feeds'] });
      toast({
        title: "Feed Updated",
        description: "The iCal feed has been updated successfully.",
      });
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update iCal feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertOrganizationIcalFeed) => {
    const diamondMapping = mappings.reduce((acc, mapping) => {
      if (mapping.wordpressLocation && mapping.diamondId) {
        acc[mapping.wordpressLocation] = mapping.diamondId;
      }
      return acc;
    }, {} as Record<string, string>);

    const submitData = {
      ...data,
      diamondMapping,
    };

    if (isEdit) {
      updateMutation.mutate(submitData);
    } else {
      createMutation.mutate(submitData);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { wordpressLocation: '', diamondId: '' }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'wordpressLocation' | 'diamondId', value: string) => {
    const updated = [...mappings];
    updated[index][field] = value;
    setMappings(updated);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit iCal Feed' : 'Create iCal Feed'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the iCal feed information and diamond mappings.' : 'Add a WordPress Events Calendar iCal feed to import house league events.'}
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
                      placeholder="Baseball House League, 13U Division, etc."
                      data-testid="input-feed-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="feedUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>iCal Feed URL *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="url"
                      placeholder="https://yoursite.com/?ical=1"
                      data-testid="input-feed-url"
                    />
                  </FormControl>
                  <FormDescription>
                    WordPress Events Calendar iCal feed URL
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Diamond Mappings</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addMapping}
                  data-testid="button-add-mapping"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Mapping
                </Button>
              </div>
              <FormDescription>
                Map WordPress location names to your system diamonds. Example locations: "Diamond 1", "Field A", "North Field"
              </FormDescription>

              {!diamonds || diamonds.length === 0 ? (
                <Alert>
                  <AlertCircle className="w-4 h-4" />
                  <AlertDescription>
                    No diamonds available. Create diamonds first to enable mapping.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                  {mappings.map((mapping, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="WordPress location (e.g., Diamond 1)"
                          value={mapping.wordpressLocation}
                          onChange={(e) => updateMapping(index, 'wordpressLocation', e.target.value)}
                          data-testid={`input-wordpress-location-${index}`}
                        />
                      </div>
                      <div className="flex-1">
                        <Select
                          value={mapping.diamondId}
                          onValueChange={(value) => updateMapping(index, 'diamondId', value)}
                        >
                          <SelectTrigger data-testid={`select-diamond-mapping-${index}`}>
                            <SelectValue placeholder="Select diamond" />
                          </SelectTrigger>
                          <SelectContent>
                            {diamonds.map((diamond) => (
                              <SelectItem key={diamond.id} value={diamond.id}>
                                {diamond.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeMapping(index)}
                        disabled={mappings.length === 1}
                        data-testid={`button-remove-mapping-${index}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
                data-testid="button-cancel-feed"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                data-testid="button-save-feed"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isEdit ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>{isEdit ? 'Update Feed' : 'Create Feed'}</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface ICalFeedManagementProps {
  organizationId: string;
}

function ICalFeedManagement({ organizationId }: ICalFeedManagementProps) {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFeed, setEditingFeed] = useState<OrganizationIcalFeed | null>(null);

  const { data: feeds, isLoading } = useQuery<OrganizationIcalFeed[]>({
    queryKey: ['/api/organizations', organizationId, 'ical-feeds'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return apiRequest('DELETE', `/api/ical-feeds/${feedId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'ical-feeds'] });
      toast({
        title: "Feed Deleted",
        description: "The iCal feed has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete iCal feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (feedId: string) => {
      return apiRequest('POST', `/api/ical-feeds/${feedId}/sync`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations', organizationId, 'ical-feeds'] });
      toast({
        title: "Sync Complete",
        description: "The iCal feed has been synchronized successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sync Failed",
        description: error?.message || "Failed to sync iCal feed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleDelete = (feed: OrganizationIcalFeed) => {
    if (confirm(`Are you sure you want to delete "${feed.name}"?`)) {
      deleteMutation.mutate(feed.id);
    }
  };

  const handleSync = (feedId: string) => {
    syncMutation.mutate(feedId);
  };

  const getNextSyncTime = (lastSyncAt: string | null) => {
    if (!lastSyncAt) return 'Not synced yet';
    const lastSync = new Date(lastSyncAt);
    const nextSync = new Date(lastSync.getTime() + 8 * 60 * 60 * 1000); // 8 hours
    return formatDistanceToNow(nextSync, { addSuffix: true });
  };

  const truncateUrl = (url: string, maxLength: number = 50) => {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
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
          <Calendar className="w-5 h-5" />
          <h3 className="text-lg font-semibold">WordPress Calendar Feeds</h3>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          size="sm"
          data-testid="button-create-ical-feed"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Feed
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Import house league events from WordPress Events Calendar
      </p>

      {!feeds || feeds.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-muted/30">
          <Calendar className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            No iCal feeds configured yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Last Synced</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mappings</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feeds.map((feed) => (
                <TableRow key={feed.id} data-testid={`row-ical-feed-${feed.id}`}>
                  <TableCell className="font-medium" data-testid={`text-feed-name-${feed.id}`}>
                    {feed.name}
                  </TableCell>
                  <TableCell data-testid={`text-feed-url-${feed.id}`}>
                    <span title={feed.feedUrl} className="text-sm">
                      {truncateUrl(feed.feedUrl)}
                    </span>
                  </TableCell>
                  <TableCell data-testid={`text-feed-last-sync-${feed.id}`}>
                    {feed.lastSyncAt ? (
                      <div className="text-sm">
                        <div>{formatDistanceToNow(new Date(feed.lastSyncAt), { addSuffix: true })}</div>
                        <div className="text-xs text-muted-foreground">
                          Next: {getNextSyncTime(feed.lastSyncAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Never synced</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-feed-status-${feed.id}`}>
                    {feed.lastSyncStatus === 'success' ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Active</span>
                      </div>
                    ) : feed.lastSyncStatus === 'error' ? (
                      <div 
                        className="flex items-center gap-1 text-destructive cursor-help" 
                        title={feed.lastSyncError || 'Sync failed'}
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span className="text-sm">Error</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-feed-mappings-${feed.id}`}>
                    <span className="text-sm">
                      {feed.diamondMapping ? Object.keys(feed.diamondMapping as Record<string, string>).length : 0} mapping(s)
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(feed.id)}
                        disabled={syncMutation.isPending}
                        data-testid={`button-sync-ical-feed-${feed.id}`}
                        title="Sync now"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingFeed(feed)}
                        data-testid={`button-edit-ical-feed-${feed.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(feed)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-ical-feed-${feed.id}`}
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

      <ICalFeedFormDialog
        organizationId={organizationId}
        isOpen={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {editingFeed && (
        <ICalFeedFormDialog
          organizationId={organizationId}
          feed={editingFeed}
          isOpen={!!editingFeed}
          onOpenChange={(open) => !open && setEditingFeed(null)}
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

      <Accordion type="single" collapsible className="w-full space-y-4">
        {organizations.map((org) => (
          <AccordionItem key={org.id} value={String(org.id)} className="border-none">
            <Card className="overflow-hidden" data-testid={`card-org-${org.slug}`}>
              <AccordionTrigger className="flex w-full items-center justify-between p-6 hover:no-underline hover:bg-gray-50 dark:hover:bg-gray-800">
                <div className="flex items-center gap-3 flex-1">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div className="space-y-1 text-left">
                    <CardTitle className="text-xl">{org.name}</CardTitle>
                    <CardDescription className="text-base">
                      {org.description || 'No description provided'}
                    </CardDescription>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()} className="ml-4">
                  <EditOrganizationDialog
                    organization={org}
                    onSuccess={() => {
                      // Callback after successful update
                    }}
                  />
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="pt-0 pb-6">
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

                    {/* Coordinators Management Section */}
                    <div className="pt-4 border-t">
                      <CoordinatorsManagement organizationId={org.id} />
                    </div>

                    {/* Coach Invitations Management Section - Only show if organization has diamond booking enabled */}
                    {org.hasDiamondBooking && (
                      <div className="pt-4 border-t">
                        <CoachInvitationsManagement organizationId={org.id} />
                      </div>
                    )}

                    {/* iCal Feeds Management Section */}
                    <div className="pt-4 border-t">
                      <ICalFeedManagement organizationId={org.id} />
                    </div>

                    {/* Diamond Restrictions Management Section */}
                    <div className="pt-4 border-t">
                      <DiamondRestrictionManagement organizationId={org.id} organizationSlug={org.slug} />
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
