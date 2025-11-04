import { useQuery } from '@tanstack/react-query';

/**
 * Hook to check if a feature is enabled for a specific organization.
 * 
 * This hook checks both:
 * 1. Global feature flag (super admin controlled)
 * 2. Organization-specific feature flag (org admin controlled)
 * 
 * A feature is only enabled if BOTH conditions are true:
 * - The feature is globally enabled by super admin
 * - The organization has the feature enabled (or hasn't set a preference, defaulting to global)
 * 
 * @param organizationId - The ID of the organization to check
 * @param featureKey - The feature key to check (e.g., "tournament_registration")
 * @returns Object with enabled status, loading state, and error
 * 
 * @example
 * const { enabled, isLoading } = useFeatureEnabled(orgId, 'tournament_registration');
 * 
 * if (isLoading) return <Spinner />;
 * if (enabled) return <RegistrationFeature />;
 * return <ComingSoonMessage />;
 */
export function useFeatureEnabled(organizationId: string | undefined, featureKey: string) {
  const { data, isLoading, error } = useQuery<{ enabled: boolean }>({
    queryKey: ['/api/organizations', organizationId, 'features', featureKey, 'enabled'],
    queryFn: async () => {
      const response = await fetch(`/api/organizations/${organizationId}/features/${featureKey}/enabled`);
      if (!response.ok) {
        throw new Error('Failed to check feature status');
      }
      return response.json();
    },
    enabled: !!organizationId, // Only run query if organizationId is provided
  });

  return {
    enabled: data?.enabled ?? false,
    isLoading,
    error,
  };
}
