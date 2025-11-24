import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Search, Calendar, MapPin, Eye, Building2, LogIn, Trophy, Smartphone, BarChart3, Users, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isPast, isFuture } from 'date-fns';
import { useHostnameContext } from '@/hooks/useHostnameContext';
import logoUrl from '@assets/Gemini_Generated_Image_cj7rofcj7rofcj7r (1)_1764008382610.png';

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

  const sortedAndFilteredTournaments = useMemo(() => {
    if (!tournaments) return [];

    const filtered = tournaments.filter((tournament) => {
      const matchesSearch = 
        tournament.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tournament.organization?.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter === 'all' || tournament.type === typeFilter;
      
      return matchesSearch && matchesType;
    });

    return filtered.sort((a, b) => {
      const aStart = new Date(a.startDate);
      const bStart = new Date(b.startDate);
      const now = new Date();

      const aIsFuture = isFuture(aStart);
      const bIsFuture = isFuture(bStart);

      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;

      return aStart.getTime() - bStart.getTime();
    });
  }, [tournaments, searchQuery, typeFilter]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[var(--deep-navy)] border-b border-white/10 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Dugout Desk" className="h-12 w-auto" />
              <h1 className="text-2xl md:text-3xl font-bold text-white font-['Oswald']">
                Dugout Desk
              </h1>
            </div>
            <div className="flex gap-2">
              {isStorefront && (
                <a href="/login">
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
      <section className="bg-gradient-to-br from-[var(--deep-navy)] via-[var(--deep-navy)] to-[#1e3a5f] text-white py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 font-['Oswald'] leading-tight">
              Your Tournament Command Center
            </h2>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto leading-relaxed">
              Streamlined tournament management for baseball leagues across Ontario. 
              Get in, get it done, get back to the game.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a href="/login">
                <Button
                  size="lg"
                  className="bg-[var(--clay-red)] text-white hover:bg-[var(--clay-red)]/90 text-lg px-8 py-6 shadow-xl"
                  data-testid="button-get-started"
                >
                  <Trophy className="w-5 h-5 mr-2" />
                  Get Started
                </Button>
              </a>
              <Button
                size="lg"
                variant="outline"
                className="bg-white/10 text-white border-white/30 hover:bg-white/20 text-lg px-8 py-6"
                onClick={() => document.getElementById('tournaments')?.scrollIntoView({ behavior: 'smooth' })}
                data-testid="button-browse-tournaments"
              >
                Browse Tournaments
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-20 bg-[var(--light-gray)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-[var(--deep-navy)] mb-4 font-['Oswald']">
              Built for Speed. Designed for Coaches.
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Everything you need to manage tournaments efficiently, right from your phone.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-[var(--field-green)] rounded-full flex items-center justify-center mx-auto mb-4">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Mobile-First</h4>
              <p className="text-gray-600">
                Optimized for coaches managing tournaments on the go. Lightning-fast score entry.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[var(--field-green)] rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Live Standings</h4>
              <p className="text-gray-600">
                Automatic standings updates with tie-breaker logic. No manual calculations needed.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[var(--field-green)] rounded-full flex items-center justify-center mx-auto mb-4">
                <Trophy className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Playoff Brackets</h4>
              <p className="text-gray-600">
                Automated playoff seeding with visual bracket displays. Pool play to finals.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-[var(--field-green)] rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Multi-Organization</h4>
              <p className="text-gray-600">
                Separate branding and settings for each league. One platform, unlimited possibilities.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 md:py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-[var(--deep-navy)] mb-4 font-['Oswald']">
              How It Works
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Three simple steps to tournament management excellence.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-20 h-20 bg-[var(--clay-red)] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold font-['Oswald']">
                1
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Create Your Tournament</h4>
              <p className="text-gray-600">
                Set up pools, teams, and schedules in minutes. Import rosters with ease.
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-[var(--clay-red)] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold font-['Oswald']">
                2
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Enter Scores</h4>
              <p className="text-gray-600">
                Quick score entry from your phone. Standings update instantly.
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-[var(--clay-red)] rounded-full flex items-center justify-center mx-auto mb-4 text-white text-3xl font-bold font-['Oswald']">
                3
              </div>
              <h4 className="text-xl font-bold text-[var(--deep-navy)] mb-2 font-['Oswald']">Teams Access Live Data</h4>
              <p className="text-gray-600">
                Coaches, parents, and players check scores and standings in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament Directory */}
      <section id="tournaments" className="py-16 md:py-20 bg-[var(--light-gray)]">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h3 className="text-3xl md:text-4xl font-bold text-[var(--deep-navy)] mb-4 font-['Oswald']">
              Browse Public Tournaments
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
              Discover upcoming and ongoing baseball tournaments across Ontario
            </p>
          </div>

          {/* Search and Filter */}
          <div className="max-w-4xl mx-auto mb-12">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search tournaments or organizations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white border-gray-300 h-12 text-lg"
                  data-testid="input-search"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-48 bg-white border-gray-300 h-12" data-testid="select-type-filter">
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

          {isLoading ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 border-4 border-[var(--clay-red)]/30 border-t-[var(--clay-red)] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading tournaments...</p>
            </div>
          ) : sortedAndFilteredTournaments && sortedAndFilteredTournaments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {sortedAndFilteredTournaments.map((tournament) => (
                <Card
                  key={tournament.id}
                  className="bg-white hover:shadow-2xl transition-all cursor-pointer border-2 border-gray-200 hover:border-[var(--field-green)] overflow-hidden group"
                  onClick={() => setLocation(`/tournament/${tournament.id}`)}
                  data-testid={`card-tournament-${tournament.id}`}
                >
                  {tournament.organization?.logoUrl && (
                    <div className="bg-gradient-to-br from-[var(--deep-navy)] to-[#1e3a5f] p-6 flex items-center justify-center min-h-[140px]">
                      <img
                        src={tournament.organization.logoUrl}
                        alt={`${tournament.organization.name} logo`}
                        className="h-24 w-auto object-contain drop-shadow-lg"
                      />
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl font-['Oswald'] text-[var(--deep-navy)] group-hover:text-[var(--field-green)] transition-colors">
                      {tournament.name}
                    </CardTitle>
                    {tournament.organization && (
                      <CardDescription className="flex items-center gap-1 text-base">
                        <Building2 className="w-4 h-4" />
                        {tournament.organization.name}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 text-[var(--clay-red)]" />
                      <span className="font-medium">
                        {format(new Date(tournament.startDate), 'MMM d')} - {format(new Date(tournament.endDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t">
                      <span className="text-xs px-3 py-1.5 bg-[var(--field-green)]/10 text-[var(--field-green)] rounded-full font-medium">
                        {tournament.type === 'pool_play' ? 'Pool Play' : 
                         tournament.type === 'single_elimination' ? 'Single Elimination' : 
                         tournament.type === 'double_elimination' ? 'Double Elimination' : 
                         tournament.type}
                      </span>
                      <Button
                        size="sm"
                        className="bg-[var(--clay-red)] text-white hover:bg-[var(--clay-red)]/90 shadow-sm"
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
              <p className="text-gray-600 text-lg">
                {searchQuery || typeFilter !== 'all' 
                  ? 'No tournaments found matching your filters.'
                  : 'No public tournaments available yet.'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 md:py-20 bg-gradient-to-br from-[var(--deep-navy)] to-[#1e3a5f] text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h3 className="text-3xl md:text-4xl font-bold mb-4 font-['Oswald']">
              Ready to Streamline Your Tournament?
            </h3>
            <p className="text-xl text-white/90 mb-8">
              Join baseball organizations across Ontario using Dugout Desk for faster, simpler tournament management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="/login">
                <Button
                  size="lg"
                  className="bg-[var(--clay-red)] text-white hover:bg-[var(--clay-red)]/90 text-lg px-8 py-6 shadow-xl"
                  data-testid="button-request-access"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Request Admin Access
                </Button>
              </a>
            </div>
            <div className="mt-8 flex items-center justify-center gap-8 text-white/70">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--field-green)]" />
                <span>Mobile-First Design</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--field-green)]" />
                <span>Real-Time Updates</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[var(--field-green)]" />
                <span>No Setup Fees</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--deep-navy)] border-t border-white/10 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Dugout Desk" className="h-10 w-auto" />
              <div className="text-white">
                <div className="font-bold text-lg font-['Oswald']">Dugout Desk</div>
                <div className="text-sm text-white/60">Your Tournament Command Center</div>
              </div>
            </div>
            <div className="text-white/60 text-sm text-center md:text-right">
              <p className="mb-2">Streamlined tournament management for baseball leagues</p>
              <p>&copy; 2025 Dugout Desk. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
