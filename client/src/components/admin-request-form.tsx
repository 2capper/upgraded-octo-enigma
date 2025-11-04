import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, XCircle, Clock, Loader2, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { insertAdminRequestSchema } from '@shared/schema';

const formSchema = insertAdminRequestSchema.extend({
  organizationName: z.string().min(1, 'Organization name is required'),
  organizationSlug: z.string().min(1, 'URL slug is required').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  message: z.string().min(10, 'Please provide at least 10 characters explaining why you need admin access'),
});

type FormSchema = z.infer<typeof formSchema>;

export function AdminRequestForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: existingRequest, isLoading: requestLoading } = useQuery({
    queryKey: ['/api/admin-requests/my-request'],
  });

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: '',
      organizationName: '',
      organizationSlug: '',
      organizationDescription: '',
      logoUrl: '',
      primaryColor: '#22c55e',
      secondaryColor: '#ffffff',
      websiteUrl: '',
      contactEmail: '',
      timezone: 'America/Toronto',
      defaultPlayoffFormat: 'top_6',
      defaultSeedingPattern: 'standard',
    },
  });

  const requestMutation = useMutation({
    mutationFn: async (data: FormSchema) => {
      return await apiRequest('POST', '/api/admin-requests', data);
    },
    onSuccess: () => {
      toast({
        title: "Request Submitted",
        description: "Your admin access request has been submitted and is pending review.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-requests/my-request'] });
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error.message || "Failed to submit admin request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: FormSchema) => {
    requestMutation.mutate(data);
  };

  // Auto-generate slug from organization name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    form.setValue('organizationSlug', slug);
  };

  if (requestLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--falcons-green)]" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (existingRequest) {
    const request: any = existingRequest;
    const statusIcon = {
      pending: <Clock className="w-5 h-5 text-yellow-500" />,
      approved: <CheckCircle className="w-5 h-5 text-green-500" />,
      rejected: <XCircle className="w-5 h-5 text-red-500" />,
    }[request.status];

    const statusText = {
      pending: "Your request is pending review by a super administrator.",
      approved: "Your request has been approved! Please refresh the page to access admin features.",
      rejected: "Your request was not approved. You can submit a new request if needed.",
    }[request.status];

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--falcons-green)]" />
            Admin Access Request Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <div className="flex items-center gap-2">
              {statusIcon}
              <AlertDescription>{statusText}</AlertDescription>
            </div>
          </Alert>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Your message:</p>
            <p className="text-sm text-gray-900">{request.message}</p>
            <p className="text-xs text-gray-500 mt-2">
              Submitted: {new Date(request.createdAt).toLocaleDateString()}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[var(--falcons-green)]" />
          Request Admin Access
        </CardTitle>
        <CardDescription>
          Submit a request to become an administrator and create your organization on Dugout Desk.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Organization Details Section */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-[var(--falcons-green)]" />
                <h3 className="font-semibold text-gray-900">Organization Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="organizationName"
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
                  name="organizationSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL Slug *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="ontario-baseball-association" data-testid="input-org-slug" />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Auto-generated from name (lowercase, hyphens)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="organizationDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ''}
                        placeholder="A brief description of your organization..."
                        rows={2}
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
                        <Input {...field} value={field.value || ''} type="email" placeholder="contact@yourorg.com" data-testid="input-contact-email" />
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
                        <Input {...field} value={field.value || ''} type="url" placeholder="https://yourorg.com" data-testid="input-website-url" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo URL (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} type="url" placeholder="https://yourorg.com/logo.png" data-testid="input-logo-url" />
                    </FormControl>
                    <FormDescription className="text-xs">
                      URL to your organization logo image
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Request Message Section */}
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Why do you need admin access? *</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Please explain why you need admin access to manage tournaments..."
                      rows={4}
                      data-testid="input-admin-request-message"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Minimum 10 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={requestMutation.isPending}
              className="w-full min-h-[48px] text-base font-semibold"
              style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
              data-testid="button-submit-admin-request"
            >
              {requestMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
