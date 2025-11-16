import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tournament, Team, Game, Pool, AgeDivision } from '@shared/schema';

export const useTournamentData = (tournamentId: string = '') => {
  // Fetch tournaments (backend already filters by user's organizations)
  const { data: tournaments = [], isLoading: tournamentsLoading, error: tournamentsError } = useQuery({
    queryKey: ['/api/tournaments'],
    queryFn: async () => {
      const response = await fetch('/api/tournaments');
      if (!response.ok) throw new Error('Failed to fetch tournaments');
      return response.json() as Tournament[];
    },
  });

  // Only fetch tournament-specific data if we have a valid tournament ID
  const hasValidTournamentId = !!(tournamentId && tournamentId.length > 0);

  const { data: teams = [], isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'teams'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams`);
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json() as Team[];
    },
    enabled: hasValidTournamentId,
  });

  const { data: games = [], isLoading: gamesLoading, error: gamesError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'games'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/games`);
      if (!response.ok) throw new Error('Failed to fetch games');
      return response.json() as Game[];
    },
    enabled: hasValidTournamentId,
  });

  // Fetch ALL pools (including Playoff, Unassigned, and temp pools)
  const { data: allPools = [], isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'pools'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/pools`);
      if (!response.ok) throw new Error('Failed to fetch pools');
      return response.json() as Pool[];
    },
    enabled: hasValidTournamentId,
  });

  // Filter to get only REAL pools (exclude system pools)
  const pools = useMemo(() => {
    return allPools.filter(pool => {
      const poolNameLower = pool.name.toLowerCase();
      return (
        !!pool.ageDivisionId && // Must be assigned to a division
        !poolNameLower.includes('unassigned') && 
        !poolNameLower.includes('playoff') &&
        !pool.id.includes('_pool_temp_')
      );
    });
  }, [allPools]);

  const { data: ageDivisions = [], isLoading: ageDivisionsLoading, error: ageDivisionsError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'age-divisions'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/age-divisions`);
      if (!response.ok) throw new Error('Failed to fetch age divisions');
      return response.json() as AgeDivision[];
    },
    enabled: hasValidTournamentId,
  });

  const loading = tournamentsLoading || teamsLoading || gamesLoading || poolsLoading || ageDivisionsLoading;
  const error = tournamentsError || teamsError || gamesError || poolsError || ageDivisionsError;
  
  // Find the current tournament from the tournaments list
  const currentTournament = tournaments.find(t => t.id === tournamentId) || null;

  return {
    teams,
    games,
    pools, // Filtered pools (real pools only)
    allPools, // All pools including system pools (for components that need them)
    tournaments,
    ageDivisions,
    currentTournament,
    isLoading: loading,
    loading,
    error: error?.message || null
  };
};
