import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Organization, Tournament } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CalendarDays, Users, Trophy, LogIn, Building2, TrendingUp, Shield, BarChart3, Smartphone } from "lucide-react";
import { format } from "date-fns";
import dugoutDeskLogo from "@assets/Gemini_Generated_Image_cj7rofcj7rofcj7r (1)_1764008382610.png";
import { FeatureShowcase } from "@/components/feature-showcase";
import { useHostnameContext } from "@/hooks/useHostnameContext";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const { isStorefront } = useHostnameContext();
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();

  const handleLogout = async () => {
    try {
      await apiRequest('POST', '/api/auth/logout', {});
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/';
    }
  };
  
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
  });

  // Fetch user's personal organizations (ones they're admin of)
  const { data: userOrganizations, isLoading: userOrgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/users/me/organizations'],
    enabled: isAuthenticated && !!user,
  });

  const { data: allTournaments, isLoading: tournamentsLoading } = useQuery<Tournament[]>({
    queryKey: ['/api/tournaments'],
  });

  const isLoading = orgsLoading || tournamentsLoading;

  // Group tournaments by organization
  const tournamentsByOrg = allTournaments?.reduce((acc, tournament) => {
    const orgId = tournament.organizationId || 'unassigned';
    if (!acc[orgId]) acc[orgId] = [];
    acc[orgId].push(tournament);
    return acc;
  }, {} as Record<string, Tournament[]>) || {};

  // Calculate platform stats
  const totalTournaments = allTournaments?.length || 0;
  const totalOrgs = organizations?.length || 0;
  const totalTeams = allTournaments?.reduce((sum, t) => sum + (t.numberOfTeams || 0), 0) || 0;

  // Show loading state while checking authentication
  if (authLoading) {
    return <LoadingScreen message="Verifying your identity..." />;
  }

  // Show login page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--deep-navy)' }}>
        {/* Header */}
        <header className="border-b border-white/10 py-4">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={dugoutDeskLogo} alt="Dugout Desk" className="h-10 w-auto" />
                <h1 className="text-xl md:text-2xl font-bold text-white font-['Oswald']">
                  Dugout Desk
                </h1>
              </div>
              {!isStorefront && (
                <Link href="/directory">
                  <Button
                    variant="outline"
                    className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                    data-testid="button-public-directory"
                  >
                    <Trophy className="w-4 h-4 mr-2" />
                    Public Directory
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </header>

        {/* Login Hero */}
        <div className="flex-1 flex items-center justify-center px-4 py-16">
          <div className="max-w-2xl w-full text-center">
            <img 
              src={dugoutDeskLogo} 
              alt="Dugout Desk Logo" 
              className="w-32 h-32 md:w-40 md:h-40 mx-auto mb-8 drop-shadow-2xl"
              data-testid="img-login-logo"
            />
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 font-['Oswald']" data-testid="text-login-title">
              Admin Portal
            </h1>
            
            <p className="text-xl md:text-2xl text-white/90 mb-3 font-medium">
              Tournament Command Center
            </p>
            
            <p className="text-base md:text-lg text-white/70 mb-12 max-w-xl mx-auto">
              Manage tournaments, track scores, and update standings in real-time. 
              Built for baseball tournament directors and coaches.
            </p>

            {/* Login Button */}
            <Link href="/login">
              <Button 
                size="lg"
                className="bg-[var(--clay-red)] text-white hover:bg-[var(--clay-red)]/90 text-lg px-12 py-7 shadow-2xl font-semibold"
                data-testid="button-admin-login-main"
              >
                <Shield className="w-6 h-6 mr-3" />
                Sign In
              </Button>
            </Link>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 max-w-3xl mx-auto">
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <Smartphone className="w-10 h-10 text-[var(--field-green)] mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2 font-['Oswald']">Mobile-First</h3>
                <p className="text-white/70 text-sm">
                  Manage from anywhere, on any device
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <BarChart3 className="w-10 h-10 text-[var(--field-green)] mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2 font-['Oswald']">Real-Time</h3>
                <p className="text-white/70 text-sm">
                  Live scores and instant standings updates
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <Trophy className="w-10 h-10 text-[var(--field-green)] mx-auto mb-3" />
                <h3 className="text-white font-semibold mb-2 font-['Oswald']">Complete Solution</h3>
                <p className="text-white/70 text-sm">
                  Pool play, playoffs, and brackets
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="border-t border-white/10 py-6">
          <div className="container mx-auto px-4 text-center text-white/60 text-sm">
            <p>&copy; 2025 Dugout Desk. Professional tournament management for Ontario Baseball.</p>
          </div>
        </footer>
      </div>
    );
  }

  // Show authenticated dashboard
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--light-gray)' }}>
      {/* Header with Logo */}
      <header className="border-b shadow-sm" style={{ backgroundColor: 'var(--deep-navy)', borderColor: 'var(--deep-navy)' }}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={dugoutDeskLogo} alt="Dugout Desk" className="h-12 w-auto" data-testid="img-header-logo" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white font-['Oswald']">
                  Dugout Desk
                </h1>
                <p className="text-xs text-white/70">Tournament Command Center</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              {!isStorefront && (
                <Link href="/directory">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                    data-testid="button-browse-public"
                  >
                    <Trophy className="w-4 h-4 mr-0 sm:mr-2" />
                    <span className="hidden sm:inline">Public Directory</span>
                  </Button>
                </Link>
              )}
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                onClick={() => document.getElementById('tournaments-section')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-view-organizations"
              >
                <Building2 className="w-4 h-4 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Organizations</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogIn className="w-4 h-4 mr-0 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Banner */}
      <div className="text-white" style={{ backgroundColor: 'var(--deep-navy)' }}>
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center font-['Oswald']" data-testid="text-dashboard-title">
              Platform Overview
            </h2>
            
            {/* Platform Stats */}
            <div className="grid grid-cols-3 gap-6 md:gap-10 max-w-3xl mx-auto">
              <div className="text-center bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <div className="text-3xl md:text-5xl font-bold mb-2" style={{ color: 'var(--clay-red)' }}>
                  {totalOrgs}
                </div>
                <div className="text-sm md:text-base opacity-90 font-medium">Organizations</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <div className="text-3xl md:text-5xl font-bold mb-2" style={{ color: 'var(--field-green)' }}>
                  {totalTournaments}
                </div>
                <div className="text-sm md:text-base opacity-90 font-medium">Tournaments</div>
              </div>
              <div className="text-center bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10">
                <div className="text-3xl md:text-5xl font-bold mb-2" style={{ color: 'var(--clay-red)' }}>
                  {totalTeams}
                </div>
                <div className="text-sm md:text-base opacity-90 font-medium">Teams</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Showcase */}
      <FeatureShowcase />

      {/* Main Content */}
      <div id="tournaments-section" className="container mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: 'var(--field-green)', borderTopColor: 'transparent' }}></div>
              <p style={{ color: 'var(--text-secondary)' }}>Loading tournaments...</p>
            </div>
          </div>
        ) : organizations && organizations.length > 0 ? (
          <div className="space-y-12">
            {organizations.map((org) => {
              const orgTournaments = tournamentsByOrg[org.id] || [];
              
              return (
                <div key={org.id} className="space-y-6" data-testid={`org-section-${org.slug}`}>
                  {/* Organization Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-4 gap-4" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <Building2 className="w-8 h-8" style={{ color: 'var(--field-green)' }} />
                      <div>
                        <h2 className="text-2xl md:text-3xl font-bold" style={{ color: 'var(--deep-navy)' }} data-testid={`text-org-name-${org.slug}`}>
                          {org.name}
                        </h2>
                        {org.description && (
                          <p className="text-sm md:text-base mt-1" style={{ color: 'var(--text-secondary)' }}>{org.description}</p>
                        )}
                      </div>
                    </div>
                    <Link href={`/org/${org.slug}`}>
                      <Button 
                        variant="outline" 
                        className="min-h-[44px] w-full sm:w-auto"
                        style={{ borderColor: 'var(--field-green)', color: 'var(--field-green)' }}
                        data-testid={`button-view-org-${org.slug}`}
                      >
                        View All
                      </Button>
                    </Link>
                  </div>

                  {/* Organization Tournaments */}
                  {orgTournaments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {orgTournaments.map((tournament) => (
                        <Link key={tournament.id} href={`/tournament/${tournament.id}`}>
                          <Card 
                            className="hover:shadow-lg transition-all cursor-pointer h-full hover:-translate-y-1"
                            data-testid={`card-tournament-${tournament.id}`}
                            style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
                          >
                            <CardHeader>
                              <CardTitle className="text-lg md:text-xl" style={{ color: 'var(--deep-navy)' }} data-testid={`text-tournament-name-${tournament.id}`}>
                                {tournament.customName || tournament.name}
                              </CardTitle>
                              <CardDescription>
                                <div className="flex items-center gap-2 text-sm">
                                  <CalendarDays className="w-4 h-4" />
                                  <span data-testid={`text-tournament-dates-${tournament.id}`}>
                                    {format(new Date(tournament.startDate), 'MMM d')} - {format(new Date(tournament.endDate), 'MMM d, yyyy')}
                                  </span>
                                </div>
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                <Users className="w-4 h-4" />
                                <span data-testid={`text-tournament-teams-${tournament.id}`}>
                                  {tournament.numberOfTeams} Teams
                                </span>
                              </div>
                              {tournament.numberOfPools && (
                                <div className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                  {tournament.numberOfPools} Pool{tournament.numberOfPools > 1 ? 's' : ''}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
                      No tournaments scheduled for this organization yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Organizations Yet
            </h3>
            <p className="text-gray-600 mb-4">
              Organizations and tournaments will appear here once they're created.
            </p>
          </div>
        )}

        {/* Unassigned Tournaments */}
        {tournamentsByOrg['unassigned'] && tournamentsByOrg['unassigned'].length > 0 && (
          <div className="mt-12 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-3xl font-bold text-gray-900">Other Tournaments</h2>
              <p className="text-gray-600 mt-1">Tournaments not yet assigned to an organization</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournamentsByOrg['unassigned'].map((tournament) => (
                <Link key={tournament.id} href={`/tournament/${tournament.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                    <CardHeader>
                      <CardTitle className="text-xl">
                        {tournament.customName || tournament.name}
                      </CardTitle>
                      <CardDescription>
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="w-4 h-4" />
                          <span>
                            {format(new Date(tournament.startDate), 'MMM d')} - {format(new Date(tournament.endDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{tournament.numberOfTeams} Teams</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
