import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Search, Calendar, MapPin, Eye, Building2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useHostnameContext } from '@/hooks/useHostnameContext';

interface PublicTournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  logoUrl?: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
    logoUrl?: string | null;
  } | null;
}

export default function PublicDirectory() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const { isStorefront } = useHostnameContext();

  const { data: tournaments, isLoading } = useQuery<PublicTournament[]>({
    queryKey: ['/api/public/tournaments'],
  });

  const filteredTournaments = tournaments?.filter((tournament) => {
    const matchesSearch = 
      tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tournament.organization?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || tournament.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--deep-navy)] via-[var(--midnight-blue)] to-[var(--deep-navy)]">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-md border-b border-white/20 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-bold text-white font-['Oswald']">
              Dugout Desk
            </h1>
            <div className="flex gap-2">
              {isStorefront && (
                <a href="/api/login">
                  <Button
                    variant="outline"
                    className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                    data-testid="button-admin-login"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Admin Login
                  </Button>
                </a>
              )}
              {!isStorefront && (
                <Button
                  onClick={() => setLocation('/')}
                  variant="outline"
                  className="bg-white/10 text-white border-white/30 hover:bg-white/20"
                  data-testid="button-organizations"
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Organizations
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-16 text-center">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 font-['Oswald']">
            Find Your Tournament
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Discover baseball tournaments across Ontario. Get live scores, standings, and schedules.
          </p>

          {/* Search and Filter */}
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search tournaments or organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/95 border-white/30 h-12 text-lg"
                  data-testid="input-search"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48 bg-white/95 border-white/30 h-12" data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="pool_play">Pool Play</SelectItem>
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament Grid */}
      <section className="pb-16">
        <div className="container mx-auto px-4">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white/80">Loading tournaments...</p>
            </div>
          ) : filteredTournaments && filteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTournaments.map((tournament) => (
                <Card
                  key={tournament.id}
                  className="bg-white/95 hover:bg-white transition-all cursor-pointer hover:shadow-xl"
                  onClick={() => setLocation(`/tournament/${tournament.id}`)}
                  data-testid={`card-tournament-${tournament.id}`}
                >
                  <CardHeader>
                    {tournament.logoUrl && (
                      <div className="mb-4 flex justify-center">
                        <img
                          src={tournament.logoUrl}
                          alt={`${tournament.name} logo`}
                          className="h-16 w-auto object-contain"
                        />
                      </div>
                    )}
                    <CardTitle className="text-xl font-['Oswald'] text-center">
                      {tournament.name}
                    </CardTitle>
                    {tournament.organization && (
                      <CardDescription className="text-center flex items-center justify-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {tournament.organization.name}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(tournament.startDate), 'MMM d')} - {format(new Date(tournament.endDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                        {tournament.type === 'pool_play' ? 'Pool Play' : 
                         tournament.type === 'single_elimination' ? 'Single Elimination' : 
                         tournament.type === 'double_elimination' ? 'Double Elimination' : 
                         tournament.type}
                      </span>
                      <Button
                        size="sm"
                        className="bg-[var(--forest-green)] text-white hover:bg-[var(--forest-green)]/90"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/tournament/${tournament.id}`);
                        }}
                        data-testid={`button-view-${tournament.id}`}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-white/80 text-lg">
                {searchQuery || typeFilter !== 'all' 
                  ? 'No tournaments found matching your filters.'
                  : 'No public tournaments available yet.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white/10 backdrop-blur-md border-t border-white/20 py-8 mt-16">
        <div className="container mx-auto px-4 text-center text-white/60">
          <p>&copy; 2025 Dugout Desk. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
