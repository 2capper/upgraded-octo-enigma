import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTour } from "@/hooks/useTour";
import { 
  Calendar, 
  Trophy, 
  ArrowRight, 
  MessageSquare, 
  Cloud, 
  Settings,
  Compass,
  Shield
} from "lucide-react";
import { useEffect } from "react";

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  featureKey?: string; // Key to check in feature flags
  requiresAdmin?: boolean;
  requiresSuperAdmin?: boolean; // Only super admins can see this
  testId: string;
}

export default function OrgAdminPortal() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const { isCompleted, startTour } = useTour('admin-portal');

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userData } = useQuery<any>({
    queryKey: ['/api/auth/me'],
  });

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const { data: featureFlags, isLoading: flagsLoading } = useQuery<Array<{
    key: string;
    effectivelyEnabled: boolean;
  }>>({
    queryKey: [`/api/organizations/${orgId}/feature-flags`],
    enabled: !!orgId,
  });

  const isAdmin = userRole?.isAdmin || false;

  // Helper function to check if a feature is enabled
  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!featureFlags || featureFlags.length === 0) {
      // If flags haven't loaded yet, don't show any feature-gated cards
      return false;
    }
    const flag = featureFlags.find(f => f.key === featureKey);
    return flag ? flag.effectivelyEnabled : false;
  };

  // Define all available features
  const allFeatures: FeatureCard[] = [
    {
      id: 'tournaments',
      title: 'Tournament Management',
      description: 'Create and manage baseball tournaments',
      icon: <Trophy className="w-5 h-5" />,
      href: `/org/${orgId}/tournaments`,
      color: 'purple',
      featureKey: 'tournaments',
      requiresAdmin: true,
      testId: 'card-tournaments',
    },
    {
      id: 'booking',
      title: 'Diamond Booking',
      description: 'Bookings, teams, and reports',
      icon: <Calendar className="w-5 h-5" />,
      href: `/booking/${orgId}/hub`,
      color: 'green',
      featureKey: 'booking',
      requiresAdmin: true,
      testId: 'card-booking',
    },
    {
      id: 'communications',
      title: 'SMS Communications',
      description: 'Send messages to coaches and teams',
      icon: <MessageSquare className="w-5 h-5" />,
      href: `/org/${orgId}/communications`,
      color: 'blue',
      featureKey: 'sms',
      requiresAdmin: true,
      testId: 'card-communications',
    },
    {
      id: 'weather',
      title: 'Weather Dashboard',
      description: 'Monitor game weather and safety alerts',
      icon: <Cloud className="w-5 h-5" />,
      href: `/org/${orgId}/weather`,
      color: 'sky',
      featureKey: 'weather',
      requiresAdmin: true,
      testId: 'card-weather',
    },
    {
      id: 'user-management',
      title: 'User Management',
      description: 'Manage users and permissions across the platform',
      icon: <Shield className="w-5 h-5" />,
      href: `/org/${orgId}/admin/users`,
      color: 'red',
      requiresSuperAdmin: true,
      testId: 'card-user-management',
    },
    {
      id: 'settings',
      title: 'Organization Settings',
      description: 'Configure organization preferences',
      icon: <Settings className="w-5 h-5" />,
      href: `/org/${orgId}/settings`,
      color: 'gray',
      requiresAdmin: true,
      testId: 'card-settings',
    },
  ];

  // Filter features based on user role and feature flags
  const visibleFeatures = allFeatures.filter(feature => {
    // Check super admin requirement
    if (feature.requiresSuperAdmin && !userData?.isSuperAdmin) {
      return false;
    }

    // Check admin requirement
    if (feature.requiresAdmin && !isAdmin) {
      return false;
    }

    // Check feature flag if specified
    if (feature.featureKey && !isFeatureEnabled(feature.featureKey)) {
      return false;
    }
    
    return true;
  });

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      purple: { bg: 'bg-purple-100', text: 'text-purple-600', border: 'hover:border-purple-600' },
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'hover:border-green-600' },
      blue: { bg: 'bg-blue-100', text: 'text-blue-600', border: 'hover:border-blue-600' },
      sky: { bg: 'bg-sky-100', text: 'text-sky-600', border: 'hover:border-sky-600' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'hover:border-orange-600' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'hover:border-indigo-600' },
      red: { bg: 'bg-red-100', text: 'text-red-600', border: 'hover:border-red-600' },
      gray: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'hover:border-gray-600' },
    };
    return colorMap[color] || colorMap.gray;
  };

  if (roleLoading || flagsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Authorization guard: coaches cannot access admin portal
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the admin portal.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2B3A4A] text-white py-12 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 text-center">
          {organization?.logoUrl && (
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="w-24 h-24 object-contain mx-auto mb-4"
              data-testid="img-org-logo"
            />
          )}
          <h1 className="text-4xl font-bold mb-2">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 text-lg">
            Welcome back{userData?.firstName ? `, ${userData.firstName}` : ''}!
          </p>
          {isAdmin && (
            <p className="text-green-400 text-sm mt-1">Organization Administrator</p>
          )}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold" data-tour="tournaments-section">Your Features</h2>
          {!isCompleted && (
            <Button
              onClick={startTour}
              variant="outline"
              size="sm"
              className="gap-2"
              data-testid="button-start-tour"
            >
              <Compass className="w-4 h-4" />
              Take a Tour
            </Button>
          )}
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFeatures.map((feature) => {
            const colors = getColorClasses(feature.color);
            const tourDataMap: Record<string, string> = {
              'tournaments': 'tournaments-tab',
              'booking': 'booking-tab',
              'communications': 'sms-tab',
              'weather': 'weather-tab',
              'user-management': 'users-tab',
              'settings': 'settings-tab',
            };
            const tourDataId = tourDataMap[feature.id];
            return (
              <Link key={feature.id} href={feature.href}>
                <Card 
                  className={`cursor-pointer hover:shadow-lg transition-shadow border-2 ${colors.border}`}
                  data-testid={feature.testId}
                  data-tour={tourDataId}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${colors.bg} rounded-lg flex items-center justify-center`}>
                          <div className={colors.text}>
                            {feature.icon}
                          </div>
                        </div>
                        <div>
                          <CardTitle className="text-lg">{feature.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {feature.description}
                          </CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {visibleFeatures.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No features available. Please contact your administrator.</p>
          </div>
        )}
      </div>
    </div>
  );
}
