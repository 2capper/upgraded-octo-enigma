import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { insertOrganizationSchema } from '@shared/schema';

const formSchema = insertOrganizationSchema.extend({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'URL slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
});

type FormSchema = z.infer<typeof formSchema>;

export const OrganizationCreationForm = () => {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      logoUrl: '',
      primaryColor: '#22c55e',
      secondaryColor: '#ffffff',
      websiteUrl: '',
      contactEmail: '',
      timezone: 'America/Toronto',
      defaultPrimaryColor: '#22c55e',
      defaultSecondaryColor: '#ffffff',
      defaultPlayoffFormat: 'top_6',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormSchema) => {
      return apiRequest('POST', '/api/organizations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      toast({
        title: 'Organization Created',
        description: 'The organization has been successfully created.',
      });
      form.reset();
      setShowForm(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Creation Failed',
        description: error.message || 'Failed to create organization. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (data: FormSchema) => {
    createMutation.mutate(data);
  };

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    form.setValue('slug', slug);
  };

  if (!showForm) {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Create New Organization
          </CardTitle>
          <CardDescription>
            Add a new baseball organization to the Dugout Desk platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => setShowForm(true)}
            className="min-h-[48px] font-semibold"
            style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
            data-testid="button-create-organization"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Organization
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Create New Organization
        </CardTitle>
        <CardDescription>
          Fill out the form below to add a new organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ontario Baseball Association"
                        onChange={(e) => {
                          field.onChange(e);
                          handleNameChange(e.target.value);
                        }}
                        data-testid="input-org-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL Slug *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ontario-baseball-association" data-testid="input-org-slug" />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers, and hyphens only
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value || ''}
                      placeholder="A brief description of the organization..."
                      rows={3}
                      data-testid="input-org-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Email</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="email" placeholder="contact@org.com" data-testid="input-org-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Website URL</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="url" placeholder="https://org.com" data-testid="input-org-website" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Color</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="color" data-testid="input-org-primary-color" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Secondary Color</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="color" data-testid="input-org-secondary-color" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ''} placeholder="America/Toronto" data-testid="input-org-timezone" />
                  </FormControl>
                  <FormDescription>
                    IANA timezone identifier (e.g., America/Toronto, America/New_York)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="min-h-[48px] font-semibold"
                style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
                data-testid="button-submit-organization"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Organization'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  form.reset();
                }}
                disabled={createMutation.isPending}
                data-testid="button-cancel-organization"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
