import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, BarChart3, ArrowRight, ArrowLeft } from "lucide-react";

interface FeatureFlag {
  id: string;
  key: string;
  effectivelyEnabled: boolean;
}

export default function BookingHub() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/by-id/${orgId}`],
  });

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const { data: featureFlags } = useQuery<FeatureFlag[]>({
    queryKey: [`/api/organizations/${orgId}/feature-flags`],
    enabled: !!orgId,
  });

  const isAdmin = userRole?.isAdmin || false;

  const isFeatureEnabled = (featureKey: string): boolean => {
    if (!featureFlags || featureFlags.length === 0) {
      const defaultEnabledFeatures = ['tournaments', 'sms', 'weather', 'booking'];
      return defaultEnabledFeatures.includes(featureKey);
    }
    const flag = featureFlags.find(f => f.key === featureKey);
    return flag ? flag.effectivelyEnabled : false;
  };

  const teamsEnabled = isFeatureEnabled('teams');
  const reportsEnabled = isFeatureEnabled('reports');

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const hubFeatures = [
    {
      id: 'calendar',
      title: 'Booking Calendar',
      description: 'View and manage diamond bookings',
      icon: <Calendar className="w-5 h-5" />,
      href: `/booking/${orgId}/calendar`,
      color: 'green',
      enabled: true,
      testId: 'card-booking-calendar',
    },
    {
      id: 'teams',
      title: 'Team Management',
      description: 'Manage house league teams and rosters',
      icon: <Users className="w-5 h-5" />,
      href: `/org/${orgId}/teams`,
      color: 'orange',
      enabled: teamsEnabled,
      testId: 'card-teams',
    },
    {
      id: 'reports',
      title: 'Reports & Analytics',
      description: 'View booking statistics and utilization',
      icon: <BarChart3 className="w-5 h-5" />,
      href: `/org/${orgId}/reports`,
      color: 'indigo',
      enabled: reportsEnabled,
      testId: 'card-reports',
    },
  ];

  const visibleFeatures = hubFeatures.filter(f => f.enabled);

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      green: { bg: 'bg-green-100', text: 'text-green-600', border: 'hover:border-green-600' },
      orange: { bg: 'bg-orange-100', text: 'text-orange-600', border: 'hover:border-orange-600' },
      indigo: { bg: 'bg-indigo-100', text: 'text-indigo-600', border: 'hover:border-indigo-600' },
    };
    return colorMap[color] || { bg: 'bg-gray-100', text: 'text-gray-600', border: 'hover:border-gray-600' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <Button
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10 mb-2"
            onClick={() => navigate(`/org/${orgId}/admin`)}
            data-testid="button-back-to-admin"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Portal
          </Button>
          <h1 className="text-3xl font-bold">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 mt-1">Diamond Booking</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Diamond Booking Features</h2>
          <p className="text-gray-600">Manage your organization's diamond bookings, teams, and reports</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleFeatures.map((feature) => {
            const colors = getColorClasses(feature.color);
            return (
              <Link key={feature.id} href={feature.href}>
                <Card 
                  className={`cursor-pointer hover:shadow-lg transition-shadow border-2 ${colors.border}`}
                  data-testid={feature.testId}
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
            <p className="text-gray-500">No booking features available. Please contact your administrator.</p>
          </div>
        )}

        {/* Quick Access for Admins */}
        {isAdmin && (
          <div className="mt-8">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-blue-900">Quick Access</CardTitle>
                <CardDescription className="text-blue-700">
                  Jump directly to the booking dashboard for coach/coordinator view
                </CardDescription>
              </CardHeader>
              <div className="px-6 pb-6">
                <Link href={`/booking/${orgId}`}>
                  <Button variant="outline" className="w-full justify-start" data-testid="button-booking-dashboard">
                    <Calendar className="w-4 h-4 mr-2" />
                    Go to Booking Dashboard
                  </Button>
                </Link>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
