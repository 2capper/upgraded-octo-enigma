import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CoordinatorApprovalDashboard } from "@/components/booking/coordinator-approval-dashboard";
import { useEffect } from "react";

export default function CoordinatorApprovals() {
  const { orgId } = useParams<{ orgId: string }>();
  const [, setLocation] = useLocation();

  const { data: organization } = useQuery({
    queryKey: [`/api/organizations/${orgId}`],
  });

  const { data: userRole, isLoading } = useQuery({
    queryKey: [`/api/organizations/${orgId}/user-role`],
  });

  const isCoordinator = userRole?.role === 'select_coordinator' || userRole?.role === 'diamond_coordinator';
  const isAdmin = userRole?.isAdmin || false;

  useEffect(() => {
    if (!isLoading && !isCoordinator && !isAdmin) {
      setLocation(`/booking/${orgId}`);
    }
  }, [isLoading, isCoordinator, isAdmin, orgId, setLocation]);

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

  if (!isCoordinator && !isAdmin) {
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
          <p className="text-gray-300 mt-1">Pending Approvals</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <CoordinatorApprovalDashboard
          organizationId={orgId!}
          userRole={userRole?.role || ""}
        />
      </div>
    </div>
  );
}
