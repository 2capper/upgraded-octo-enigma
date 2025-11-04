import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface FeatureFlag {
  id: string;
  featureKey: string;
  displayName: string;
  description: string;
  isEnabled: boolean;
  icon: string;
  comingSoonText: string;
}

export const FeatureManagement = () => {
  const { toast } = useToast();

  const { data: featureFlags, isLoading } = useQuery<FeatureFlag[]>({
    queryKey: ['/api/feature-flags'],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      return apiRequest('PUT', `/api/feature-flags/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/feature-flags'] });
      toast({
        title: "Feature Updated",
        description: "Feature flag has been successfully updated.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update feature flag. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (id: string, currentState: boolean) => {
    toggleMutation.mutate({ id, isEnabled: !currentState });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--field-green)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Settings className="w-4 h-4" />
        <AlertDescription>
          Control which features are available across the platform. Disabled features will show "Coming Soon" pages to users.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        {featureFlags?.map((flag) => (
          <Card key={flag.id} className="border-2">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-xl flex items-center gap-2">
                    {flag.displayName}
                    {flag.isEnabled && (
                      <span className="text-xs px-2 py-1 rounded-full font-normal" style={{ backgroundColor: 'rgba(58, 107, 53, 0.15)', color: 'var(--field-green)' }}>
                        Active
                      </span>
                    )}
                    {!flag.isEnabled && (
                      <span className="text-xs px-2 py-1 rounded-full font-normal" style={{ backgroundColor: 'rgba(43, 58, 74, 0.1)', color: 'var(--deep-navy)' }}>
                        Disabled
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {flag.description}
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id={flag.id}
                    checked={flag.isEnabled}
                    onCheckedChange={() => handleToggle(flag.id, flag.isEnabled)}
                    disabled={toggleMutation.isPending}
                    data-testid={`switch-feature-${flag.featureKey}`}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                <p className="mb-2">
                  <span className="font-semibold">Feature Key:</span> <code className="px-2 py-1 rounded" style={{ backgroundColor: 'rgba(43, 58, 74, 0.05)' }}>{flag.featureKey}</code>
                </p>
                {flag.comingSoonText && (
                  <p className="italic" style={{ color: 'var(--text-secondary)' }}>
                    "{flag.comingSoonText}"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
