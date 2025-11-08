import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, ClipboardList, Users, Settings } from "lucide-react";
import { Link } from "wouter";
import { TeamManagement } from "@/components/booking/team-management";
import { BookingRequestList } from "@/components/booking/booking-request-list";
import { CoordinatorApprovalDashboard } from "@/components/booking/coordinator-approval-dashboard";

export default function BookingDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const isAdmin = userRole?.isAdmin || false;
  const isCoordinator = userRole?.role === 'select_coordinator' || userRole?.role === 'diamond_coordinator';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#2B3A4A] text-white py-6 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold">{organization?.name || 'Loading...'}</h1>
          <p className="text-gray-300 mt-1">Diamond Booking System</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList>
            <TabsTrigger value="requests" data-testid="tab-my-requests">
              <ClipboardList className="w-4 h-4 mr-2" />
              My Requests
            </TabsTrigger>
            {isCoordinator && (
              <TabsTrigger value="approvals" data-testid="tab-approvals">
                <Calendar className="w-4 h-4 mr-2" />
                Pending Approvals
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="teams" data-testid="tab-teams">
                <Users className="w-4 h-4 mr-2" />
                Teams
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="settings" data-testid="tab-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="requests">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">My Booking Requests</h3>
                  <p className="text-sm text-gray-500">View and manage your diamond booking requests</p>
                </div>
                <Link href={`/booking/${orgId}/new-request`}>
                  <Button data-testid="button-new-request">
                    <Calendar className="w-4 h-4 mr-2" />
                    New Request
                  </Button>
                </Link>
              </div>
              <BookingRequestList organizationId={orgId!} />
            </div>
          </TabsContent>

          {isCoordinator && (
            <TabsContent value="approvals">
              <CoordinatorApprovalDashboard
                organizationId={orgId!}
                userRole={userRole?.role || ""}
              />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="teams">
              <TeamManagement organizationId={orgId!} />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Diamond Restrictions</CardTitle>
                  <CardDescription>Configure which diamonds can be used by each division</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-500 text-center py-8">Diamond restrictions will appear here</p>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
