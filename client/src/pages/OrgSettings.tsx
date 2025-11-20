import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Settings, Calendar, MessageSquare, Cloud, Trophy } from "lucide-react";
import { useEffect } from "react";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  isGlobalOnly: boolean;
  orgEnabled: boolean | null;
  effectivelyEnabled: boolean;
}

export default function OrgSettings() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const { data: featureFlags, isLoading: flagsLoading } = useQuery<FeatureFlag[]>({
    queryKey: [`/api/organizations/${orgId}/feature-flags`],
    enabled: !!orgId,
  });

  const isAdmin = userRole?.isAdmin || false;

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate(`/org/${orgId}/admin`);
    }
  }, [roleLoading, isAdmin, orgId, navigate]);

  const toggleFeatureMutation = useMutation({
    mutationFn: async ({ featureFlagId, isEnabled }: { featureFlagId: string; isEnabled: boolean }) => {
      return apiRequest(`/api/organizations/${orgId}/feature-flags/${featureFlagId}`, {
        method: "POST",
        body: JSON.stringify({ isEnabled }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${orgId}/feature-flags`] });
      toast({
        title: "Feature updated",
        description: `Feature ${variables.isEnabled ? 'enabled' : 'disabled'} successfully`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update feature",
        variant: "destructive",
      });
    },
  });

  const getFeatureIcon = (key: string) => {
    const icons: Record<string, React.ReactNode> = {
      'booking': <Calendar className="w-5 h-5 text-green-600" />,
      'sms': <MessageSquare className="w-5 h-5 text-blue-600" />,
      'weather': <Cloud className="w-5 h-5 text-sky-600" />,
      'tournaments': <Trophy className="w-5 h-5 text-purple-600" />,
    };
    return icons[key] || <Settings className="w-5 h-5 text-gray-600" />;
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

  if (!isAdmin) {
    return null;
  }

  const configFeatures = featureFlags?.filter(f => 
    ['booking', 'sms', 'weather', 'tournaments'].includes(f.key)
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <Button
            variant="ghost"
            className="text-white hover:text-white hover:bg-white/10 mb-2"
            onClick={() => navigate(`/org/${orgId}/admin`)}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin Portal
          </Button>
          <h1 className="text-3xl font-bold">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 mt-1">Organization Settings</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Feature Modules */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Modules</CardTitle>
            <CardDescription>
              Enable or disable features for your organization. Disabling a feature will hide it from your admin portal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {configFeatures.length === 0 ? (
              <p className="text-center text-gray-500 py-4">No feature flags available</p>
            ) : (
              configFeatures.map(flag => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  data-testid={`feature-${flag.key}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      {getFeatureIcon(flag.key)}
                    </div>
                    <div>
                      <h3 className="font-medium">{flag.name}</h3>
                      <p className="text-sm text-gray-600">{flag.description}</p>
                      {flag.isGlobalOnly && (
                        <p className="text-xs text-gray-500 mt-1">
                          This feature is globally {flag.isEnabled ? 'enabled' : 'disabled'}
                        </p>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={flag.orgEnabled ?? flag.isEnabled}
                    onCheckedChange={(checked) => 
                      toggleFeatureMutation.mutate({
                        featureFlagId: flag.id,
                        isEnabled: checked,
                      })
                    }
                    disabled={flag.isGlobalOnly || toggleFeatureMutation.isPending}
                    data-testid={`switch-${flag.key}`}
                  />
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Service Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Service Integrations</CardTitle>
            <CardDescription>
              Configure third-party services and API integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href={`/booking/${orgId}/twilio-settings`}>
              <Button variant="outline" className="w-full justify-start" data-testid="link-twilio-settings">
                <MessageSquare className="w-4 h-4 mr-2" />
                Twilio SMS Settings
              </Button>
            </Link>
            <Link href={`/booking/${orgId}/weather-settings`}>
              <Button variant="outline" className="w-full justify-start" data-testid="link-weather-settings">
                <Cloud className="w-4 h-4 mr-2" />
                Weather API Settings
              </Button>
            </Link>
            <Link href={`/booking/${orgId}/settings`}>
              <Button variant="outline" className="w-full justify-start" data-testid="link-booking-settings">
                <Calendar className="w-4 h-4 mr-2" />
                Booking & Calendar Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
