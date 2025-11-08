import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, Users, CheckCircle, XCircle, FileText, AlertCircle } from "lucide-react";
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

interface CoordinatorApprovalDashboardProps {
  organizationId: string;
  userRole: string;
}

export function CoordinatorApprovalDashboard({ organizationId, userRole }: CoordinatorApprovalDashboardProps) {
  const [selectedRequest, setSelectedRequest] = useState<BookingRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const { toast } = useToast();

  const pendingStatus = userRole === "select_coordinator" ? "submitted" : "select_coordinator_approved";

  const { data: requests, isLoading: requestsLoading } = useQuery<BookingRequest[]>({
    queryKey: [`/api/organizations/${organizationId}/booking-requests`, { status: pendingStatus }],
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: [`/api/organizations/${organizationId}/house-league-teams`],
  });

  const { data: diamonds } = useQuery<Diamond[]>({
    queryKey: [`/api/organizations/${organizationId}/diamonds`],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, approved }: { requestId: string; approved: boolean }) => {
      return await apiRequest(`/api/organizations/${organizationId}/booking-requests/${requestId}/approve`, {
        method: "POST",
        body: JSON.stringify({
          approved,
          notes: approvalNotes,
          role: userRole,
        }),
      });
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/booking-requests`] });
      toast({
        title: approved ? "Request approved" : "Request declined",
        description: approved
          ? "The booking request has been approved."
          : "The booking request has been declined.",
      });
      setSelectedRequest(null);
      setApprovalNotes("");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to process approval. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleApprove = () => {
    if (!selectedRequest) return;
    setIsApproving(true);
    approveMutation.mutate({ requestId: selectedRequest.id, approved: true });
  };

  const handleDecline = () => {
    if (!selectedRequest) return;
    setIsApproving(false);
    approveMutation.mutate({ requestId: selectedRequest.id, approved: false });
  };

  const getTeamInfo = (teamId: string) => {
    return teams?.find(t => t.id === teamId);
  };

  const getDiamondName = (diamondId: string) => {
    const diamond = diamonds?.find(d => d.id === diamondId);
    return diamond?.name || "Unknown Diamond";
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "EEEE, MMM d, yyyy");
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

  if (requestsLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-500">Loading pending requests...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">
            {userRole === "select_coordinator" ? "Select Coordinator" : "Diamond Coordinator"} Approvals
          </h3>
          <p className="text-sm text-gray-500">
            {requests?.length || 0} request{requests?.length !== 1 ? 's' : ''} pending your review
          </p>
        </div>

        {!requests || requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
              <p className="text-gray-500">No pending requests to review at this time.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {requests.map((request) => {
              const team = getTeamInfo(request.houseLeagueTeamId);
              return (
                <Card key={request.id} className="hover:shadow-md transition-shadow" data-testid={`card-approval-${request.id}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Users className="w-5 h-5 text-gray-400" />
                          <div>
                            <h3 className="text-lg font-semibold" data-testid={`text-team-${request.id}`}>
                              {team?.name || "Unknown Team"} ({team?.division || "?"})
                            </h3>
                            {team?.coachName && (
                              <p className="text-sm text-gray-500">Coach: {team.coachName}</p>
                            )}
                          </div>
                        </div>
                        {request.purpose && (
                          <p className="text-sm text-gray-700 mb-3 pl-8">{request.purpose}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-blue-600">
                        Pending Review
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4 pl-8">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span data-testid={`text-date-${request.id}`}>{formatDate(request.date)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span data-testid={`text-time-${request.id}`}>
                          {formatTime(request.startTime)} - {formatTime(request.endTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <span data-testid={`text-diamond-${request.id}`}>{getDiamondName(request.diamondId)}</span>
                      </div>
                    </div>

                    {request.requiresUmpire && (
                      <div className="mb-4 pl-8 flex items-center gap-2 text-sm text-blue-600">
                        <AlertCircle className="w-4 h-4" />
                        <span>Umpire required</span>
                      </div>
                    )}

                    {request.notes && (
                      <div className="mb-4 pl-8">
                        <div className="p-3 bg-gray-50 rounded text-sm text-gray-600">
                          <p className="font-medium mb-1">Coach Notes:</p>
                          <p>{request.notes}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pl-8 pt-2 border-t">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsApproving(true);
                        }}
                        data-testid={`button-approve-${request.id}`}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsApproving(false);
                        }}
                        data-testid={`button-decline-${request.id}`}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Decline
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isApproving ? "Approve" : "Decline"} Booking Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRequest && (
              <div className="bg-gray-50 p-4 rounded space-y-2 text-sm">
                <p><strong>Team:</strong> {getTeamInfo(selectedRequest.houseLeagueTeamId)?.name}</p>
                <p><strong>Date:</strong> {formatDate(selectedRequest.date)}</p>
                <p><strong>Time:</strong> {formatTime(selectedRequest.startTime)} - {formatTime(selectedRequest.endTime)}</p>
                <p><strong>Diamond:</strong> {getDiamondName(selectedRequest.diamondId)}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Notes {isApproving ? "(optional)" : "(required)"}
              </label>
              <Textarea
                placeholder={isApproving
                  ? "Add any notes or conditions for approval..."
                  : "Please provide a reason for declining this request..."}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={4}
                data-testid="textarea-approval-notes"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedRequest(null);
                  setApprovalNotes("");
                }}
                data-testid="button-cancel-approval"
              >
                Cancel
              </Button>
              <Button
                className={isApproving ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                onClick={isApproving ? handleApprove : handleDecline}
                disabled={(!isApproving && !approvalNotes.trim()) || approveMutation.isPending}
                data-testid="button-confirm-approval"
              >
                {approveMutation.isPending
                  ? "Processing..."
                  : isApproving
                  ? "Confirm Approval"
                  : "Confirm Decline"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
