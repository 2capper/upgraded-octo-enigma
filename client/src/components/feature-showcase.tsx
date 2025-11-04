import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Edit3, 
  Clock, 
  Calendar, 
  UserPlus, 
  MessageSquare,
  CalendarClock,
  Trophy
} from "lucide-react";

interface Feature {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'live' | 'coming_soon';
}

const features: Feature[] = [
  {
    title: "Pool Play Standings",
    description: "Real-time standings with automatic tie-breaker calculations and playoff seeding",
    icon: TrendingUp,
    status: 'live'
  },
  {
    title: "Quick Score Entry",
    description: "Log game scores fast - designed for coaches on the go between games",
    icon: Edit3,
    status: 'live'
  },
  {
    title: "Real-Time Updates",
    description: "Instant bracket updates visible to all teams, parents, and fans",
    icon: Clock,
    status: 'live'
  },
  {
    title: "Game Scheduling",
    description: "Pool play and playoff brackets with location and time management",
    icon: Calendar,
    status: 'live'
  },
  {
    title: "Team Registration",
    description: "Online signups with secure payment processing for tournament entries",
    icon: UserPlus,
    status: 'coming_soon'
  },
  {
    title: "Communications Hub",
    description: "Multi-channel messaging to reach teams via email, SMS, and in-app",
    icon: MessageSquare,
    status: 'coming_soon'
  }
];

export function FeatureShowcase() {
  return (
    <div className="py-12 md:py-16" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div style={{ color: 'var(--clay-red)' }}>
                <Trophy className="w-8 h-8" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ color: 'var(--deep-navy)' }}>
                BUILT FOR THE GAME
              </h2>
            </div>
            <p className="text-lg md:text-xl max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Everything you need to run a professional tournament. Get in, get it done, get back to the game.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card 
                  key={index}
                  className="relative hover:shadow-lg transition-all hover:-translate-y-1"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
                  data-testid={`feature-card-${index}`}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div style={{ 
                        color: feature.status === 'live' ? 'var(--field-green)' : 'var(--clay-red)' 
                      }}>
                        <Icon className="w-8 h-8 flex-shrink-0" />
                      </div>
                      <Badge 
                        variant={feature.status === 'live' ? 'default' : 'secondary'}
                        className="text-xs font-semibold uppercase tracking-wide"
                        style={{
                          backgroundColor: feature.status === 'live' ? 'var(--field-green)' : 'var(--clay-red)',
                          color: 'white'
                        }}
                        data-testid={`badge-${feature.status}`}
                      >
                        {feature.status === 'live' ? 'Live' : 'Coming Soon'}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg md:text-xl" style={{ color: 'var(--deep-navy)' }}>
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Call to Action */}
          <div className="mt-12 text-center">
            <p className="text-base md:text-lg mb-4" style={{ color: 'var(--text-primary)' }}>
              Trusted by baseball organizations across Ontario
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <a href="#tournaments-section">
                <button
                  className="min-h-[48px] px-8 py-3 rounded-md text-base font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: 'var(--clay-red)', color: 'white' }}
                  data-testid="button-view-active-tournaments"
                >
                  View Active Tournaments
                </button>
              </a>
              <a href="/api/login">
                <button
                  className="min-h-[48px] px-8 py-3 rounded-md text-base font-semibold border-2 transition-all hover:bg-gray-50"
                  style={{ borderColor: 'var(--field-green)', color: 'var(--field-green)' }}
                  data-testid="button-admin-access"
                >
                  Get Admin Access
                </button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
