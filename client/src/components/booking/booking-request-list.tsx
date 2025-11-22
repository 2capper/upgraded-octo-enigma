import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Clock, MapPin, Users, FileText, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

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
}

interface Diamond {
  id: string;
  name: string;
  location?: string;
}

interface BookingRequestListProps {
  organizationId: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }> = {
  draft: { label: "Draft", variant: "secondary", color: "text-gray-600" },
  submitted: { label: "Pending", variant: "outline", color: "text-blue-600" },
  select_coordinator_approved: { label: "Select Approved", variant: "default", color: "text-blue-600" },
  diamond_coordinator_approved: { label: "Approved", variant: "default", color: "text-green-600" },
  declined: { label: "Declined", variant: "destructive", color: "text-red-600" },
  cancelled: { label: "Cancelled", variant: "secondary", color: "text-gray-600" },
};

export function BookingRequestList({ organizationId }: BookingRequestListProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: requests, isLoading: requestsLoading } = useQuery<BookingRequest[]>({
    queryKey: [`/api/organizations/${organizationId}/booking-requests`, { status: selectedStatus !== "all" ? selectedStatus : undefined }],
  });

  const { data: teams } = useQuery<Team[]>({
    queryKey: [`/api/organizations/${organizationId}/house-league-teams`],
  });

  const { data: diamonds } = useQuery<Diamond[]>({
    queryKey: [`/api/organizations/${organizationId}/diamonds`],
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest("POST", `/api/organizations/${organizationId}/booking-requests/${requestId}/cancel`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/organizations/${organizationId}/booking-requests`] });
      toast({
        title: "Request cancelled",
        description: "Your booking request has been cancelled.",
      });
      setCancelRequestId(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel request. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getTeamName = (teamId: string) => {
    const team = teams?.find(t => t.id === teamId);
    return team ? `${team.name} (${team.division})` : "Unknown Team";
  };

  const getDiamondName = (diamondId: string) => {
    const diamond = diamonds?.find(d => d.id === diamondId);
    return diamond?.name || "Unknown Diamond";
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, variant: "outline" as const, color: "text-gray-600" };
    return (
      <Badge variant={config.variant} className={config.color} data-testid={`badge-status-${status}`}>
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM d, yyyy");
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
          <p className="text-center text-gray-500">Loading requests...</p>
        </CardContent>
      </Card>
    );
  }

  const filteredRequests = selectedStatus === "all" 
    ? requests 
    : requests?.filter(r => r.status === selectedStatus);

  return (
    <div className="space-y-4">
      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-status-all">
            All ({requests?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="draft" data-testid="tab-status-draft">
            Draft ({requests?.filter(r => r.status === "draft").length || 0})
          </TabsTrigger>
          <TabsTrigger value="submitted" data-testid="tab-status-submitted">
            Pending ({requests?.filter(r => r.status === "submitted").length || 0})
          </TabsTrigger>
          <TabsTrigger value="diamond_coordinator_approved" data-testid="tab-status-approved">
            Approved ({requests?.filter(r => r.status === "diamond_coordinator_approved").length || 0})
          </TabsTrigger>
          <TabsTrigger value="declined" data-testid="tab-status-declined">
            Declined ({requests?.filter(r => r.status === "declined").length || 0})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!filteredRequests || filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No requests found</h3>
            <p className="text-gray-500 mb-4">
              {selectedStatus === "all" 
                ? "You haven't created any booking requests yet." 
                : `No ${statusConfig[selectedStatus]?.label.toLowerCase()} requests.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow" data-testid={`card-request-${request.id}`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold" data-testid={`text-team-${request.id}`}>
                        {getTeamName(request.houseLeagueTeamId)}
                      </h3>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.purpose && (
                      <p className="text-sm text-gray-600 mb-3">{request.purpose}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                  <div className="mt-3 flex items-center gap-2 text-sm text-blue-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Umpire required</span>
                  </div>
                )}

                {request.notes && (
                  <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
                    <p className="font-medium mb-1">Notes:</p>
                    <p>{request.notes}</p>
                  </div>
                )}

                <div className="mt-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setLocation(`/booking/${organizationId}/request/${request.id}`)}
                    data-testid={`button-view-${request.id}`}
                  >
                    View Details
                  </Button>
                  {(request.status === "draft" || request.status === "submitted") && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-600 hover:text-red-700" 
                      onClick={() => setCancelRequestId(request.id)}
                      disabled={cancelMutation.isPending}
                      data-testid={`button-cancel-${request.id}`}
                    >
                      Cancel Request
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!cancelRequestId} onOpenChange={(open) => !open && setCancelRequestId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your booking request. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-dialog-close">No, keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelRequestId && cancelMutation.mutate(cancelRequestId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-cancel-dialog-confirm"
            >
              Yes, cancel request
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
