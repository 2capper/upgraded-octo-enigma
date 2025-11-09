import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Trophy, ArrowRight, ClipboardList, Users, BarChart3, Settings, CheckSquare, PlusCircle } from "lucide-react";
import { BookingRequestList } from "@/components/booking/booking-request-list";
import type { HouseLeagueTeam } from "@shared/schema";

export default function BookingDashboard() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userRole, isLoading: roleLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const { data: teams } = useQuery<HouseLeagueTeam[]>({
    queryKey: [`/api/organizations/${orgId}/house-league-teams`],
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
          <p className="text-gray-300 text-lg">Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}!</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick Actions for All Users */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Diamond Booking</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Link href={`/booking/${orgId}/calendar`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-600" data-testid="card-view-calendar">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-green-600" />
                      </div>
                      <CardTitle className="text-lg">View Calendar</CardTitle>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </CardHeader>
              </Card>
            </Link>

            <Link href={`/booking/${orgId}/new-request`}>
              <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-green-600" data-testid="card-new-request">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <PlusCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <CardTitle className="text-lg">New Booking Request</CardTitle>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                  </div>
                </CardHeader>
              </Card>
            </Link>
          </div>

          {/* My Booking Requests */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-gray-700" />
                <CardTitle>My Booking Requests</CardTitle>
              </div>
              <CardDescription>View and manage your diamond booking requests</CardDescription>
            </CardHeader>
            <CardContent>
              <BookingRequestList organizationId={orgId!} />
            </CardContent>
          </Card>
        </div>

        {/* Coordinator Features */}
        {isCoordinator && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Coordinator Tools</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Link href={`/booking/${orgId}/approvals`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-blue-600" data-testid="card-approvals">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Pending Approvals</CardTitle>
                          <CardDescription className="text-sm">Review and approve booking requests</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        )}

        {/* Admin Features */}
        {isAdmin && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Administration</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Link href="/admin-portal">
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-600" data-testid="card-tournament-management">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Tournaments</CardTitle>
                          <CardDescription className="text-sm">Manage tournaments</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              <Link href={`/booking/${orgId}/teams`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-orange-600" data-testid="card-team-management">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Users className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Teams</CardTitle>
                          <CardDescription className="text-sm">Manage house league teams</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              <Link href={`/booking/${orgId}/reports`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-indigo-600" data-testid="card-reports">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                          <BarChart3 className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Reports</CardTitle>
                          <CardDescription className="text-sm">View booking analytics</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>

              <Link href={`/booking/${orgId}/settings`}>
                <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-gray-600" data-testid="card-settings">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                          <Settings className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">Settings</CardTitle>
                          <CardDescription className="text-sm">Calendar & preferences</CardDescription>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
