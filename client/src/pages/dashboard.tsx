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
  const currentTournamentId = tournamentId || 'fg-baseball-11u-13u-2025-08';
  const { teams, games, pools, tournaments, ageDivisions, currentTournament, loading, error } = useTournamentData(currentTournamentId);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--splash-light-gray)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--splash-orange)] mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading tournament dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--splash-light-gray)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading tournament data: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-[var(--forest-green)] text-[var(--yellow)] px-6 py-3 rounded font-semibold hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--splash-light-gray)]">
      <SimpleNavigation 
        tournamentId={currentTournamentId} 
        currentPage="dashboard" 
        tournament={currentTournament || undefined}
      />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardHeader />
        
        <TournamentCards 
          tournaments={tournaments}
          teams={teams}
          games={games}
          pools={pools}
          ageDivisions={ageDivisions}
        />

        <div className="mt-8">
          <Tabs defaultValue="standings" className="w-full">
            <TabsList 
              className="grid w-full grid-cols-4"
              style={{
                '--tab-bg': currentTournament?.primaryColor || 'hsl(120, 45%, 25%)',
                '--tab-bg-hover': currentTournament?.primaryColor ? `color-mix(in srgb, ${currentTournament.primaryColor} 80%, #000 20%)` : 'hsl(120, 45%, 20%)',
                '--tab-text': currentTournament?.secondaryColor || '#ffffff',
                '--tab-active-bg': currentTournament?.secondaryColor || '#ffffff',
                '--tab-active-text': currentTournament?.primaryColor || 'hsl(120, 45%, 25%)',
              } as React.CSSProperties}
            >
              <TabsTrigger 
                value="standings"
                className="data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
              >
                Standings
              </TabsTrigger>
              <TabsTrigger 
                value="games"
                className="data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
              >
                Games
              </TabsTrigger>
              <TabsTrigger 
                value="teams"
                className="data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
              >
                Teams
              </TabsTrigger>
              <TabsTrigger 
                value="playoffs"
                className="data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
              >
                Playoffs
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="standings" className="mt-6">
              <StandingsTable 
                teams={teams}
                games={games}
                pools={pools}
                ageDivisions={ageDivisions}
                tournament={currentTournament}
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
              {currentTournament ? (
                <PlayoffsTab 
                  teams={teams}
                  games={games}
                  pools={pools}
                  ageDivisions={ageDivisions}
                  tournamentId={currentTournamentId}
                  tournament={currentTournament}
                />
              ) : (
                <div className="text-center p-8">
                  <p className="text-gray-500">Loading tournament data...</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}