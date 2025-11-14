import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { OnboardingOrganizationForm } from '@/components/onboarding/onboarding-organization-form';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
import type { Organization } from '@shared/schema';

export default function OnboardingCreateOrganization() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: userOrgs, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
    enabled: isAuthenticated && !!user,
  });

  // Redirect if user already has organizations
  useEffect(() => {
    if (!orgsLoading && userOrgs && userOrgs.length > 0) {
      setLocation('/');
    }
  }, [orgsLoading, userOrgs, setLocation]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation('/');
    }
  }, [authLoading, isAuthenticated, setLocation]);

  if (authLoading || orgsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-green-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">Create Your Organization</CardTitle>
            <CardDescription className="text-base mt-2">
              Set up your organization to start managing tournaments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingOrganizationForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
