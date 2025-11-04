import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, Loader2, Shield, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export function AdminRequestsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['/api/admin-requests'],
  });

  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest(`/api/admin-requests/${requestId}/approve`, {
        method: 'PUT',
      });
    },
    onSuccess: () => {
      toast({
        title: "Request Approved",
        description: "Admin access has been granted to the user.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve request.",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return await apiRequest(`/api/admin-requests/${requestId}/reject`, {
        method: 'PUT',
      });
    },
    onSuccess: () => {
      toast({
        title: "Request Rejected",
        description: "The admin access request has been rejected.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin-requests'] });
    },
    onError: (error: any) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject request.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--falcons-green)]" />
      </div>
    );
  }

  const pendingRequests = requests?.filter((r: any) => r.status === 'pending') || [];
  const processedRequests = requests?.filter((r: any) => r.status !== 'pending') || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Access Requests</h2>
        <p className="text-gray-600">Review and manage admin access requests from users.</p>
      </div>

      {/* Pending Requests */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-yellow-500" />
          Pending Requests ({pendingRequests.length})
        </h3>

        {pendingRequests.length === 0 ? (
          <Alert>
            <AlertDescription>No pending admin access requests.</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {pendingRequests.map((request: any) => (
              <Card key={request.id} className="border-yellow-200 bg-yellow-50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      <span>{request.userName}</span>
                    </div>
                    <Badge variant="outline" className="bg-yellow-100 border-yellow-300 text-yellow-800">
                      Pending
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 bg-white rounded border">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Organization Name</p>
                      <p className="text-sm font-semibold text-[var(--falcons-green)]">{request.organizationName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">URL Slug</p>
                      <p className="text-sm font-mono">{request.organizationSlug}</p>
                    </div>
                    {request.organizationDescription && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Description</p>
                        <p className="text-sm">{request.organizationDescription}</p>
                      </div>
                    )}
                    {request.logoUrl && (
                      <div className="md:col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Logo Preview</p>
                        <img src={request.logoUrl} alt="Organization Logo" className="h-12 w-auto object-contain border rounded p-1" />
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Contact Info:</p>
                    <p className="text-sm font-medium">{request.userEmail}</p>
                    {request.contactEmail && request.contactEmail !== request.userEmail && (
                      <p className="text-xs text-gray-500">Org Email: {request.contactEmail}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Request Message:</p>
                    <p className="text-sm">{request.message}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      Submitted: {new Date(request.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => approveMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      data-testid={`button-approve-${request.id}`}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => rejectMutation.mutate(request.id)}
                      disabled={approveMutation.isPending || rejectMutation.isPending}
                      variant="outline"
                      className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
                      data-testid={`button-reject-${request.id}`}
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Processed Requests */}
      {processedRequests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Processed Requests ({processedRequests.length})
          </h3>
          <div className="space-y-4">
            {processedRequests.map((request: any) => {
              const isApproved = request.status === 'approved';
              return (
                <Card key={request.id} className={isApproved ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        <span>{request.userName}</span>
                      </div>
                      <Badge variant={isApproved ? 'default' : 'destructive'}>
                        {request.status}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Email:</p>
                      <p className="text-sm font-medium">{request.userEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Message:</p>
                      <p className="text-sm">{request.message}</p>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>Submitted: {new Date(request.createdAt).toLocaleString()}</p>
                      {request.reviewedAt && (
                        <p>Reviewed: {new Date(request.reviewedAt).toLocaleString()}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
