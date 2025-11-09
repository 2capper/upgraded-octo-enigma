import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { CalendarSubscription } from "@/components/booking/calendar-subscription";
import { useEffect } from "react";

export default function BookingSettingsPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, setLocation] = useLocation();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userRole, isLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const isAdmin = userRole?.isAdmin || false;

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setLocation(`/booking/${orgId}`);
    }
  }, [isLoading, isAdmin, orgId, setLocation]);

  if (isLoading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <Link href={`/booking/${orgId}`}>
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10 mb-2" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 mt-1">Settings</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
        {organization && (
          <CalendarSubscription
            type="organization"
            entityId={organization.id}
            organizationId={orgId!}
            currentToken={organization.calendarSubscriptionToken}
            entityName={organization.name}
          />
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Diamond Restrictions</CardTitle>
            <CardDescription>Configure which diamonds can be used by each division</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-center py-8">Diamond restrictions will appear here</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
