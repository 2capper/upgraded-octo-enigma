import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Calendar, Clock, MapPin, Users, FileText, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface BookingRequest {
  id: string;
  houseLeagueTeamId: string;
  date: string;
  startTime: string;
  endTime: string;
  diamondId: string;
  purpose?: string;
  requiresUmpire: boolean;
  status: string;
  notes?: string;
  createdAt: string;
  submittedAt?: string;
  confirmedAt?: string;
  team?: Team;
  diamond?: Diamond;
  approvals?: BookingApproval[];
}

interface BookingApproval {
  id: string;
  bookingRequestId: string;
  approverId: string;
  approverRole: string;
  decision: string;
  notes?: string;
  createdAt: string;
}

interface Team {
  id: string;
  name: string;
  division: string;
  coachName?: string;
}

interface Diamond {
  id: string;
  name: string;
  location?: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string; icon: any }> = {
  draft: { label: "Draft", variant: "secondary", color: "text-gray-600", icon: FileText },
  submitted: { label: "Pending Review", variant: "outline", color: "text-blue-600", icon: Clock },
  select_coordinator_approved: { label: "Select Approved", variant: "default", color: "text-blue-600", icon: CheckCircle },
  diamond_coordinator_approved: { label: "Approved", variant: "default", color: "text-green-600", icon: CheckCircle },
  declined: { label: "Declined", variant: "destructive", color: "text-red-600", icon: XCircle },
  cancelled: { label: "Cancelled", variant: "secondary", color: "text-gray-600", icon: XCircle },
};

export default function BookingRequestDetail() {
  const { orgId, requestId } = useParams<{ orgId: string; requestId: string }>();

  const { data: request, isLoading: requestLoading } = useQuery<BookingRequest>({
    queryKey: [`/api/organizations/${orgId}/booking-requests/${requestId}`],
  });

  // Extract nested data from composite response
  const team = request?.team;
  const diamond = request?.diamond;
  const approvals = request?.approvals || [];

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "EEEE, MMMM d, yyyy");
    } catch {
      return dateString;
    }
  };

  const formatTime = (timeString: string) => {
    try {
      const [hours, minutes] = timeString.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    } catch {
      return timeString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  };

  if (requestLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading request details...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request not found</h2>
          <p className="text-gray-600 mb-4">The booking request you're looking for doesn't exist.</p>
          <Link href={`/booking/${orgId}`}>
            <Button>Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = statusConfig[request.status] || statusConfig.draft;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="mb-6">
          <Link href={`/booking/${orgId}`}>
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <div className="space-y-6">
          {/* Header Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <StatusIcon className={`w-6 h-6 ${statusInfo.color}`} />
                    <CardTitle className="text-2xl">Booking Request</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusInfo.variant} className={statusInfo.color}>
                      {statusInfo.label}
                    </Badge>
                    <span className="text-sm text-gray-500">
                      Created {formatDateTime(request.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Team Information */}
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">Team</h3>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="font-medium" data-testid="text-team-name">
                      {team?.name || "Loading..."}
                    </p>
                    <p className="text-sm text-gray-500">
                      {team?.division} {team?.coachName && `• Coach: ${team.coachName}`}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Booking Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Date</h3>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <span className="font-medium" data-testid="text-date">
                      {formatDate(request.date)}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Time</h3>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-400" />
                    <span className="font-medium" data-testid="text-time">
                      {formatTime(request.startTime)} - {formatTime(request.endTime)}
                    </span>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Diamond</h3>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="font-medium" data-testid="text-diamond">
                        {diamond?.name || "Loading..."}
                      </p>
                      {diamond?.location && (
                        <p className="text-sm text-gray-500">{diamond.location}</p>
                      )}
                    </div>
                  </div>
                </div>

                {request.requiresUmpire && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Requirements</h3>
                    <div className="flex items-center gap-2 text-blue-600">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">Umpire required</span>
                    </div>
                  </div>
                )}
              </div>

              {request.purpose && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Purpose</h3>
                    <p className="text-gray-700">{request.purpose}</p>
                  </div>
                </>
              )}

              {request.notes && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Coach Notes</h3>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-700">{request.notes}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Approval Timeline */}
          {approvals && approvals.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Approval Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {approvals.map((approval, index) => (
                    <div key={approval.id} className="flex gap-4" data-testid={`approval-${index}`}>
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          approval.decision === 'approved' ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {approval.decision === 'approved' ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                        </div>
                        {index < approvals.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium capitalize">
                            {approval.approverRole.replace('_', ' ')}
                          </span>
                          <Badge variant={approval.decision === 'approved' ? 'default' : 'destructive'}>
                            {approval.decision}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          {formatDateTime(approval.createdAt)}
                        </p>
                        {approval.notes && (
                          <div className="p-3 bg-gray-50 rounded text-sm text-gray-700">
                            {approval.notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
