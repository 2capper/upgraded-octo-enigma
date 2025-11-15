import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
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
  adminEmail: z.string().email('Valid email required').min(1, 'Admin email is required'),
});

type FormSchema = z.infer<typeof formSchema>;

export const OnboardingOrganizationForm = () => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      logoUrl: '',
      primaryColor: '#22c55e',
      secondaryColor: '#ffffff',
      websiteUrl: '',
      contactEmail: '',
      adminEmail: '',
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/organizations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users/me/organizations'] });
      setShowSuccess(true);
      setTimeout(() => {
        // Redirect to admin portal with auto-open tournament creation
        setLocation('/admin-portal?firstTime=true');
      }, 2500);
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

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    form.setValue('slug', slug);
  };

  const canProceedToStep2 = () => {
    const name = form.getValues('name');
    const slug = form.getValues('slug');
    const adminEmail = form.getValues('adminEmail');
    return name.length > 0 && slug.length > 0 && adminEmail.length > 0 && 
           !form.formState.errors.name && !form.formState.errors.slug && !form.formState.errors.adminEmail;
  };

  const handleNext = () => {
    if (canProceedToStep2()) {
      setCurrentStep(2);
    }
  };

  if (showSuccess) {
    return (
      <div className="text-center py-12 animate-in fade-in zoom-in duration-500">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500 to-blue-600 rounded-full mb-6 animate-in zoom-in duration-700 delay-150">
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          Success! <Sparkles className="inline w-6 h-6 text-yellow-500" />
        </h2>
        <p className="text-lg text-gray-600 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
          Your organization is ready. Taking you to your dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Progress Indicator */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
            currentStep >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
          </div>
          <span className="ml-2 text-sm font-medium text-gray-700">Essentials</span>
        </div>
        <div className={`h-1 w-16 transition-all ${currentStep >= 2 ? 'bg-green-600' : 'bg-gray-200'}`} />
        <div className="flex items-center">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
            currentStep >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
          }`}>
            2
          </div>
          <span className="ml-2 text-sm font-medium text-gray-700">Customize</span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {currentStep === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Tell us about your organization</h3>
                <p className="text-gray-600">We'll use this to set up your workspace</p>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Organization Name *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., Forest Glade Baseball"
                        className="h-12 text-base"
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

              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">URL Slug *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g., forest-glade-baseball"
                        className="h-12 text-base font-mono"
                        data-testid="input-org-slug"
                      />
                    </FormControl>
                    <FormDescription>
                      Your unique URL: dugoutdesk.ca/org/<span className="font-semibold text-green-700">{field.value || 'your-slug'}</span>
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Admin Email *</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="e.g., you@email.com"
                        className="h-12 text-base"
                        data-testid="input-admin-email"
                      />
                    </FormControl>
                    <FormDescription>
                      Your email address for welcome messages and tournament notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Public Contact Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        placeholder="e.g., info@forestgladebaseball.com"
                        className="h-12 text-base"
                        data-testid="input-contact-email"
                      />
                    </FormControl>
                    <FormDescription>
                      Public contact email displayed on your organization page (optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToStep2()}
                className="w-full h-12 text-base font-semibold mt-8"
                data-testid="button-next-step"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Customize your workspace</h3>
                <p className="text-gray-600">Optional - you can always change these later</p>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Tell people about your organization..."
                        className="min-h-24 text-base resize-none"
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormDescription>
                      A brief description that appears on your public page
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="logoUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Logo URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://..."
                        className="h-12 text-base"
                        data-testid="input-logo-url"
                      />
                    </FormControl>
                    <FormDescription>
                      Link to your organization's logo image
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Website URL</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="https://..."
                        className="h-12 text-base"
                        data-testid="input-website-url"
                      />
                    </FormControl>
                    <FormDescription>
                      Your organization's main website
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-4 mt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="w-32 h-12 text-base font-semibold"
                  data-testid="button-back"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  data-testid="button-create-org-submit"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Organization
                      <Check className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};
