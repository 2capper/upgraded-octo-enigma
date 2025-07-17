import { useState, useEffect } from 'react';
import { useParams } from 'wouter';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { SimpleNavigation } from '@/components/tournament/simple-navigation';
import { DashboardHeader } from '@/components/tournament/dashboard-header';
import { TournamentCards } from '@/components/tournament/tournament-cards';
import { StandingsTable } from '@/components/tournament/standings-table';
import { GamesTab } from '@/components/tournament/games-tab';
import { PlayoffsTab } from '@/components/tournament/playoffs-tab';
import { TeamsTab } from '@/components/tournament/teams-tab';
import { useTournamentData } from '@/hooks/use-tournament-data';

export default function Dashboard() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const currentTournamentId = tournamentId || 'aug-classic';
  const { teams, games, pools, tournaments, ageDivisions, loading, error } = useTournamentData(currentTournamentId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-baseball-primary mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading tournament dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-subtle flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading tournament data: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="baseball-btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <SimpleNavigation tournamentId={currentTournamentId} currentPage="dashboard" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader tournamentId={currentTournamentId} />
        
        <TournamentCards 
          tournaments={tournaments}
          teams={teams}
          games={games}
          pools={pools}
          ageDivisions={ageDivisions}
        />

        <div className="mt-8">
          <Tabs defaultValue="standings" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="standings">Standings</TabsTrigger>
              <TabsTrigger value="games">Games</TabsTrigger>
              <TabsTrigger value="teams">Teams</TabsTrigger>
              <TabsTrigger value="playoffs">Playoffs</TabsTrigger>
            </TabsList>
            
            <TabsContent value="standings" className="mt-6">
              <StandingsTable 
                teams={teams}
                games={games}
                pools={pools}
                ageDivisions={ageDivisions}
              />
            </TabsContent>
            
            <TabsContent value="games" className="mt-6">
              <GamesTab 
                games={games}
                teams={teams}
                pools={pools}
                ageDivisions={ageDivisions}
              />
            </TabsContent>
            
            <TabsContent value="teams" className="mt-6">
              <TeamsTab 
                teams={teams}
                pools={pools}
                ageDivisions={ageDivisions}
              />
            </TabsContent>
            
            <TabsContent value="playoffs" className="mt-6">
              <PlayoffsTab 
                teams={teams}
                games={games}
                pools={pools}
                ageDivisions={ageDivisions}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}