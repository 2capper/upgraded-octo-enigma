import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import type { Organization, Tournament } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, ArrowLeft, Building2, Globe, Mail } from "lucide-react";
import { format } from "date-fns";

export default function OrganizationPage() {
  const { slug } = useParams();

  const { data: organization, isLoading: orgLoading } = useQuery<Organization>({
    queryKey: [`/api/organizations/${slug}`],
    enabled: !!slug,
  });

  const { data: tournaments, isLoading: tournamentsLoading } = useQuery<Tournament[]>({
    queryKey: [`/api/organizations/${slug}/tournaments`],
    enabled: !!slug,
  });

  const isLoading = orgLoading || tournamentsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[var(--forest-green)] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading organization...</p>
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Organization Not Found</h2>
          <p className="text-gray-600 mb-6">The organization you're looking for doesn't exist.</p>
          <Link href="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--forest-green)] to-green-700 text-white">
        <div className="container mx-auto px-4 py-12">
          <Link href="/">
            <Button 
              variant="ghost" 
              className="text-white hover:bg-white/20 mb-6"
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-start gap-6">
            {organization.logoUrl ? (
              <img 
                src={organization.logoUrl} 
                alt={organization.name}
                className="w-24 h-24 rounded-lg bg-white p-2"
                data-testid="img-org-logo"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-white/20 flex items-center justify-center">
                <Building2 className="w-12 h-12" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-bold mb-2" data-testid="text-org-name">
                {organization.name}
              </h1>
              {organization.description && (
                <p className="text-xl opacity-90 mb-4" data-testid="text-org-description">
                  {organization.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm">
                {organization.websiteUrl && (
                  <a 
                    href={organization.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:underline"
                    data-testid="link-org-website"
                  >
                    <Globe className="w-4 h-4" />
                    {organization.websiteUrl}
                  </a>
                )}
                {organization.contactEmail && (
                  <a 
                    href={`mailto:${organization.contactEmail}`}
                    className="flex items-center gap-2 hover:underline"
                    data-testid="link-org-email"
                  >
                    <Mail className="w-4 h-4" />
                    {organization.contactEmail}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tournaments Section */}
      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Tournaments</h2>
          <p className="text-gray-600">
            {tournaments && tournaments.length > 0
              ? `${tournaments.length} tournament${tournaments.length > 1 ? 's' : ''} organized by ${organization.name}`
              : `No tournaments scheduled yet`}
          </p>
        </div>

        {tournaments && tournaments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((tournament) => (
              <Link key={tournament.id} href={`/tournament/${tournament.id}`}>
                <Card 
                  className="hover:shadow-lg transition-shadow cursor-pointer h-full"
                  data-testid={`card-tournament-${tournament.id}`}
                >
                  <CardHeader>
                    <CardTitle className="text-xl" data-testid={`text-tournament-name-${tournament.id}`}>
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
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span data-testid={`text-tournament-teams-${tournament.id}`}>
                          {tournament.numberOfTeams} Teams
                        </span>
                      </div>
                      {tournament.numberOfPools && (
                        <div className="text-sm text-gray-600">
                          {tournament.numberOfPools} Pool{tournament.numberOfPools > 1 ? 's' : ''}
                        </div>
                      )}
                      <div className="pt-2">
                        <span className="text-xs font-medium text-[var(--forest-green)] bg-green-50 px-2 py-1 rounded">
                          {tournament.type.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <CalendarDays className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Tournaments Yet
            </h3>
            <p className="text-gray-600">
              This organization hasn't scheduled any tournaments yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
