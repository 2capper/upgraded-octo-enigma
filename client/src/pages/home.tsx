import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Organization, Tournament } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Trophy, LogIn, Building2, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import dugoutDeskLogo from "@assets/tinywow_Gemini_Generated_Image_cj7rofcj7rofcj7r_85636863_1761934089236.png";
import { FeatureShowcase } from "@/components/feature-showcase";

export default function Home() {
  const { data: organizations, isLoading: orgsLoading } = useQuery<Organization[]>({
    queryKey: ['/api/organizations'],
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--light-gray)' }}>
      {/* Hero Section */}
      <div className="text-white" style={{ backgroundColor: 'var(--deep-navy)' }}>
        <div className="container mx-auto px-4 py-12 md:py-16">
          <div className="max-w-5xl mx-auto text-center">
            {/* Logo */}
            <img 
              src={dugoutDeskLogo} 
              alt="Dugout Desk Logo" 
              className="w-24 h-24 md:w-32 md:h-32 mx-auto mb-6"
              data-testid="img-dugout-desk-logo"
            />
            
            {/* Title & Tagline */}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-4" data-testid="text-homepage-title">
              DUGOUT DESK
            </h1>
            <p className="text-xl md:text-2xl mb-3 font-medium" data-testid="text-homepage-subtitle">
              Your Tournament Command Center
            </p>
            <p className="text-base md:text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Organize. Track. Win. Built for Ontario Baseball.
            </p>
            
            {/* Platform Stats */}
            <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-2xl mx-auto mb-8">
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold" style={{ color: 'var(--clay-red)' }}>
                  {totalOrgs}
                </div>
                <div className="text-xs md:text-sm opacity-80 uppercase tracking-wide">Organizations</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold" style={{ color: 'var(--field-green)' }}>
                  {totalTournaments}
                </div>
                <div className="text-xs md:text-sm opacity-80 uppercase tracking-wide">Tournaments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-4xl font-bold" style={{ color: 'var(--clay-red)' }}>
                  {totalTeams}
                </div>
                <div className="text-xs md:text-sm opacity-80 uppercase tracking-wide">Teams</div>
              </div>
            </div>
            
            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg" 
                className="min-h-[48px] px-8 text-base font-semibold"
                style={{ backgroundColor: 'var(--field-green)', color: 'white' }}
                onClick={() => document.getElementById('tournaments-section')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-view-tournaments"
              >
                <Trophy className="w-5 h-5 mr-2" />
                Explore Tournaments
              </Button>
              <a href="/api/login">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="min-h-[48px] px-8 text-base font-semibold bg-white hover:bg-gray-100"
                  style={{ color: 'var(--deep-navy)' }}
                  data-testid="button-admin-login"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Admin Login
                </Button>
              </a>
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
