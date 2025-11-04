import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Users, Trophy, TrendingUp, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StandingsTable } from '@/components/tournament/standings-table';
import { GamesTab } from '@/components/tournament/games-tab';
import { TeamsTab } from '@/components/tournament/teams-tab';
import { PlayoffsTab } from '@/components/tournament/playoffs-tab';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';
import { useTournamentData } from '@/hooks/use-tournament-data';

export default function TournamentDashboard() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['/api/tournaments', tournamentId],
    enabled: !!tournamentId,
  });

  const {
    tournaments,
    currentTournament,
    ageDivisions,
    pools,
    teams,
    games,
    isLoading,
    error
  } = useTournamentData(tournamentId);

  if (tournamentLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--falcons-green)] mx-auto mb-4" />
          <p className="text-gray-600">Loading tournament data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <Trophy className="w-16 h-16 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Tournament Not Found</h2>
          </div>
          <p className="text-gray-600 mb-4">
            The tournament "{tournamentId}" could not be found.
          </p>
          <Button 
            onClick={() => window.location.href = '/'} 
            className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!currentTournament) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">No Tournament Selected</h2>
          <p className="text-gray-500">Please select a tournament to view.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleNavigation 
        tournamentId={tournamentId}
        currentPage='dashboard'
        tournament={currentTournament}
      />
      
      <div className="px-4 py-4 md:py-8">
        {/* Tournament Header with Custom Branding */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Tournament Logo */}
              {currentTournament.logoUrl && (
                <img
                  src={currentTournament.logoUrl}
                  alt="Tournament Logo"
                  className="h-16 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                  data-testid="img-tournament-logo"
                />
              )}
              
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  {currentTournament.customName || currentTournament.name}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {currentTournament.startDate} - {currentTournament.endDate}
                  </div>
                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {teams.length} Teams
                  </div>
                  <div className="flex items-center">
                    <Trophy className="w-4 h-4 mr-1" />
                    {ageDivisions.length} Divisions
                  </div>
                </div>
              </div>
            </div>
            <div>
              <Badge 
                variant="outline" 
                className="text-xs px-2 py-1 w-fit border-current"
                style={{ color: currentTournament.primaryColor || '#22c55e' }}
                data-testid="badge-tournament-id"
              >
                ID: {tournamentId}
              </Badge>
            </div>
          </div>
        </div>



        {/* Main Content Tabs */}
        <Tabs defaultValue="standings" className="mt-6">
          <TabsList 
            className="grid grid-cols-2 md:grid-cols-4 w-full gap-1 h-auto"
            style={{
              '--tab-bg': currentTournament.primaryColor || 'hsl(120, 45%, 25%)',
              '--tab-bg-hover': currentTournament.primaryColor ? `color-mix(in srgb, ${currentTournament.primaryColor} 80%, #000 20%)` : 'hsl(120, 45%, 20%)',
              '--tab-text': currentTournament.secondaryColor || '#ffffff',
              '--tab-active-bg': currentTournament.secondaryColor || '#ffffff',
              '--tab-active-text': currentTournament.primaryColor || 'hsl(120, 45%, 25%)',
            } as React.CSSProperties}
          >
            <TabsTrigger 
              value="standings" 
              className="text-xs md:text-sm py-2 data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
            >
              Standings
            </TabsTrigger>
            <TabsTrigger 
              value="games" 
              className="text-xs md:text-sm py-2 data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
            >
              Games
            </TabsTrigger>
            <TabsTrigger 
              value="teams" 
              className="text-xs md:text-sm py-2 data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
            >
              Teams
            </TabsTrigger>
            <TabsTrigger 
              value="playoffs" 
              className="text-xs md:text-sm py-2 data-[state=active]:bg-[var(--tab-active-bg)] data-[state=active]:text-[var(--tab-active-text)] bg-[var(--tab-bg)] text-[var(--tab-text)] hover:bg-[var(--tab-bg-hover)]"
            >
              Playoffs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="standings" className="mt-6">
            <StandingsTable 
              teams={teams}
              games={games}
              ageDivisions={ageDivisions}
              pools={pools}
              tournament={currentTournament}
            />
          </TabsContent>
          
          <TabsContent value="games" className="mt-6">
            <GamesTab 
              games={games}
              teams={teams}
              ageDivisions={ageDivisions}
              pools={pools}
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
              games={games}
              teams={teams}
              pools={pools}
              ageDivisions={ageDivisions}
              tournamentId={tournamentId}
              tournament={currentTournament}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}