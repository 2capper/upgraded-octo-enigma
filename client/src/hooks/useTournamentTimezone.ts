import { useQuery } from '@tanstack/react-query';
import type { Tournament, Organization } from '@shared/schema';

/**
 * Hook to get the timezone for a tournament based on its organization
 * 
 * @param tournamentId - The tournament ID
 * @returns Object with timezone, loading state, and error
 * 
 * @example
 * const { timezone, isLoading } = useTournamentTimezone(tournamentId);
 * const formattedDate = formatInTimezone(game.dateTime, timezone);
 */
export function useTournamentTimezone(tournamentId: string | undefined) {
  // Get tournament data (uses default fetcher from queryClient)
  const { data: tournament, isLoading: tournamentLoading } = useQuery<Tournament>({
    queryKey: ['/api/tournaments', tournamentId],
    enabled: !!tournamentId,
  });

  // Get organization data if tournament has an organizationId
  // Note: organizationId may be UUID or slug depending on data source
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const orgIdOrSlug = tournament?.organizationId;
  const orgEndpoint = orgIdOrSlug 
    ? (isUuid(orgIdOrSlug) ? `/api/organizations/by-id/${orgIdOrSlug}` : `/api/organizations/${orgIdOrSlug}`)
    : null;
  
  const { data: organization, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: [orgEndpoint],
    enabled: !!orgEndpoint,
  });

  return {
    timezone: organization?.timezone || 'America/Toronto', // Default to Toronto
    isLoading: tournamentLoading || orgLoading,
  };
}
