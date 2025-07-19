import { useQuery } from '@tanstack/react-query';
import { Tournament, Team, Game, Pool, AgeDivision } from '@shared/schema';

export const useTournamentData = (tournamentId: string = 'aug-classic') => {
  const { data: tournaments = [], isLoading: tournamentsLoading, error: tournamentsError } = useQuery({
    queryKey: ['/api/tournaments'],
    queryFn: async () => {
      const response = await fetch('/api/tournaments');
      if (!response.ok) throw new Error('Failed to fetch tournaments');
      return response.json() as Tournament[];
    },
  });

  const { data: teams = [], isLoading: teamsLoading, error: teamsError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'teams'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/teams`);
      if (!response.ok) throw new Error('Failed to fetch teams');
      return response.json() as Team[];
    },
  });

  const { data: games = [], isLoading: gamesLoading, error: gamesError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'games'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/games`);
      if (!response.ok) throw new Error('Failed to fetch games');
      return response.json() as Game[];
    },
  });

  const { data: pools = [], isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'pools'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/pools`);
      if (!response.ok) throw new Error('Failed to fetch pools');
      return response.json() as Pool[];
    },
  });

  const { data: ageDivisions = [], isLoading: ageDivisionsLoading, error: ageDivisionsError } = useQuery({
    queryKey: ['/api/tournaments', tournamentId, 'age-divisions'],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${tournamentId}/age-divisions`);
      if (!response.ok) throw new Error('Failed to fetch age divisions');
      return response.json() as AgeDivision[];
    },
  });

  const loading = tournamentsLoading || teamsLoading || gamesLoading || poolsLoading || ageDivisionsLoading;
  const error = tournamentsError || teamsError || gamesError || poolsError || ageDivisionsError;
  
  // Find the current tournament from the tournaments list
  const currentTournament = tournaments.find(t => t.id === tournamentId) || null;

  return {
    teams,
    games,
    pools,
    tournaments,
    ageDivisions,
    currentTournament,
    isLoading: loading,
    loading,
    error: error?.message || null
  };
};
