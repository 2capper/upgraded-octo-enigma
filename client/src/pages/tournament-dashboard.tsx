import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calendar, Users, Trophy, TrendingUp, FileText, Lock, MapPin, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { StandingsTable } from '@/components/tournament/standings-table';
import { GamesTab } from '@/components/tournament/games-tab';
import { TeamsTab } from '@/components/tournament/teams-tab';
import { PublicPlayoffsTab } from '@/components/tournament/public-playoffs-tab';
import { SimpleNavigation } from '@/components/tournament/simple-navigation';
import { QRCodeShare } from '@/components/tournament/qr-code-share';
import { ChatWidget } from '@/components/tournament/chat-widget';
import { useTournamentData } from '@/hooks/use-tournament-data';
import { useAuth } from '@/hooks/useAuth';
import type { Diamond, Organization } from '@shared/schema';
import { useMemo } from 'react';

export default function TournamentDashboard() {
  const params = useParams();
  const tournamentId = params.tournamentId as string;
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  // Fetch organization for logo
  // organizationId may be a UUID or slug depending on data source
  const isUuid = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  const orgIdOrSlug = currentTournament?.organizationId;
  const orgEndpoint = orgIdOrSlug 
    ? (isUuid(orgIdOrSlug) ? `/api/organizations/by-id/${orgIdOrSlug}` : `/api/organizations/${orgIdOrSlug}`)
    : null;
  
  const { data: organization } = useQuery<Organization>({
    queryKey: [orgEndpoint],
    enabled: !!orgEndpoint,
  });

  // Fetch diamonds for the tournament's organization
  const { data: diamonds = [], isLoading: diamondsLoading } = useQuery<Diamond[]>({
    queryKey: ['/api/organizations', currentTournament?.organizationId, 'diamonds'],
    enabled: !!currentTournament?.organizationId,
  });

  // Get all unique diamonds used in this tournament's games
  const usedDiamondIds = useMemo(() => {
    const ids = new Set<string>();
    games.forEach(game => {
      if (game.diamondId) ids.add(game.diamondId);
    });
    return Array.from(ids);
  }, [games]);

  const tournamentDiamonds = useMemo(() => {
    return diamonds.filter(d => usedDiamondIds.includes(d.id));
  }, [diamonds, usedDiamondIds]);

  if (tournamentLoading || isLoading || authLoading || diamondsLoading) {
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

  // Access control: Check if user can view this tournament
  const tournamentVisibility = currentTournament.visibility ?? 'private';
  if (tournamentVisibility === 'private' && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="mb-4">
            <Lock className="w-16 h-16 text-gray-400 mx-auto mb-2" />
            <h2 className="text-xl font-semibold text-gray-700">Private Tournament</h2>
          </div>
          <p className="text-gray-600 mb-6">
            This tournament is private and requires authentication to view. Please sign in to access it.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => window.location.href = '/login'} 
              className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]/90"
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
            <Button 
              onClick={() => window.location.href = '/'} 
              variant="outline"
              data-testid="button-home"
            >
              Back to Home
            </Button>
          </div>
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
            <div className="flex flex-col gap-3 items-end">
              <Badge 
                variant="outline" 
                className="text-xs px-2 py-1 w-fit border-current"
                style={{ color: currentTournament.primaryColor || '#22c55e' }}
                data-testid="badge-tournament-id"
              >
                ID: {tournamentId}
              </Badge>
              <QRCodeShare tournament={currentTournament} organizationLogoUrl={organization?.logoUrl} />
            </div>
          </div>
        </div>

        {/* Field Conditions Section */}
        {(() => {
          // Only show section if there are diamonds with status issues
          const diamondsWithIssues = tournamentDiamonds.filter(d => d.status !== 'open');
          
          if (diamondsWithIssues.length === 0) return null;

          return (
            <Card className="mb-6 border-l-4 border-l-orange-500" data-testid="field-conditions-section">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  Field Conditions Alert
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {diamondsWithIssues.map(diamond => {
                    const statusConfig = {
                      closed: { color: 'bg-red-500 text-white border-red-600', icon: '🔴', label: 'Closed' },
                      delayed: { color: 'bg-yellow-500 text-white border-yellow-600', icon: '⚠️', label: 'Delayed' },
                      tbd: { color: 'bg-gray-500 text-white border-gray-600', icon: '❓', label: 'Status TBD' },
                    };
                    
                    const config = statusConfig[diamond.status as keyof typeof statusConfig];
                    if (!config) return null;

                    return (
                      <div
                        key={diamond.id}
                        className="border-2 rounded-lg p-4 bg-white shadow-sm"
                        style={{ borderColor: config.color.split(' ')[0].replace('bg-', '') }}
                        data-testid={`field-status-${diamond.id}`}
                      >
                        <div className="flex items-start gap-3">
                          <MapPin className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900 mb-1">{diamond.name}</div>
                            {diamond.location && (
                              <div className="text-xs text-gray-600 mb-2">{diamond.location}</div>
                            )}
                            <Badge className={`${config.color} text-xs mb-2`}>
                              {config.icon} {config.label}
                            </Badge>
                            {diamond.statusMessage && (
                              <div className="text-sm text-gray-700 italic mt-2 p-2 bg-gray-50 rounded">
                                {diamond.statusMessage}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })()}

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
              primaryColor={currentTournament.primaryColor}
              secondaryColor={currentTournament.secondaryColor}
            />
          </TabsContent>
          
          <TabsContent value="games" className="mt-6">
            <GamesTab 
              games={games}
              teams={teams}
              ageDivisions={ageDivisions}
              pools={pools}
              diamonds={diamonds}
              tournamentId={tournamentId}
              primaryColor={currentTournament.primaryColor}
              secondaryColor={currentTournament.secondaryColor}
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
            <PublicPlayoffsTab 
              tournamentId={tournamentId}
              tournament={currentTournament}
              ageDivisions={ageDivisions}
              teams={teams}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Chatbot Widget */}
      <ChatWidget 
        tournamentId={tournamentId} 
        tournamentName={currentTournament.name}
        primaryColor={currentTournament.primaryColor}
        secondaryColor={currentTournament.secondaryColor}
      />
    </div>
  );
}