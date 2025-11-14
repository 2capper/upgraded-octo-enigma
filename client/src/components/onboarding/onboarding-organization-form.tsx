import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export const OnboardingOrganizationForm = () => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [logoPreviewError, setLogoPreviewError] = useState(false);

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
      return apiRequest('POST', '/api/onboarding/create-organization', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/organizations'] });
      toast({
        title: 'Organization Created',
        description: 'Your organization has been created successfully! Redirecting to dashboard...',
      });
      setTimeout(() => {
        setLocation('/');
      }, 1500);
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Organization Name */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., Forest Glade Baseball"
                  onChange={(e) => {
                    field.onChange(e);
                    handleNameChange(e.target.value);
                  }}
                  data-testid="input-org-name"
                />
              </FormControl>
              <FormDescription>
                The full name of your baseball organization or league
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* URL Slug */}
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL Slug *</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g., forest-glade-baseball"
                  data-testid="input-org-slug"
                />
              </FormControl>
              <FormDescription>
                Used in your organization's public URL (auto-generated from name)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
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
                  placeholder="Brief description of your organization"
                  rows={3}
                  data-testid="textarea-org-description"
                />
              </FormControl>
              <FormDescription>
                Optional description to appear on your organization's public page
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Logo URL */}
        <FormField
          control={form.control}
          name="logoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Logo URL</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="https://example.com/logo.png"
                  type="url"
                  data-testid="input-org-logo-url"
                />
              </FormControl>
              <FormDescription>
                URL to your organization's logo image (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Logo Preview */}
        {form.watch('logoUrl') && !logoPreviewError && (
          <div className="mt-4">
            <FormLabel>Logo Preview</FormLabel>
            <div className="mt-2 border rounded-lg p-4 flex justify-center bg-gray-50">
              <img
                src={form.watch('logoUrl') || ''}
                alt="Logo preview"
                className="max-h-32 object-contain"
                onError={() => setLogoPreviewError(true)}
                data-testid="img-org-logo-preview"
              />
            </div>
          </div>
        )}

        {logoPreviewError && (
          <div className="text-sm text-red-500">
            Failed to load logo image. Please check the URL.
          </div>
        )}

        {/* Contact Email */}
        <FormField
          control={form.control}
          name="contactEmail"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  value={field.value || ''}
                  placeholder="contact@yourorg.com"
                  type="email"
                  data-testid="input-org-contact-email"
                />
              </FormControl>
              <FormDescription>
                Public contact email for your organization (optional)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="min-h-[48px] font-semibold px-8"
            data-testid="button-submit-org"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating Organization...
              </>
            ) : (
              'Create Organization'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
