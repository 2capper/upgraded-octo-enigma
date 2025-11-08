import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { BarChart3, Download, Calendar, Clock, CheckCircle, XCircle, Loader2, TrendingUp, MapPin } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface DiamondUtilization {
  diamondId: string;
  diamondName: string;
  totalBookings: number;
  totalHours: number;
  confirmedBookings: number;
  confirmedHours: number;
  peakHours: { hour: string; count: number }[];
}

interface DivisionStats {
  division: string;
  totalRequests: number;
  confirmedRequests: number;
  declinedRequests: number;
  pendingRequests: number;
  averageBookingHours: number;
}

interface ApprovalMetrics {
  totalRequests: number;
  confirmedCount: number;
  declinedCount: number;
  pendingCount: number;
  cancelledCount: number;
  averageApprovalTimeHours: number;
  approvalRate: number;
  selectCoordinatorApprovals: number;
  diamondCoordinatorApprovals: number;
}

interface BookingReportsProps {
  organizationId: string;
}

export function BookingReports({ organizationId }: BookingReportsProps) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
  
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);

  const { data: diamondUtilization, isLoading: utilizationLoading } = useQuery<DiamondUtilization[]>({
    queryKey: [`/api/organizations/${organizationId}/reports/diamond-utilization`, { startDate, endDate }],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/reports/diamond-utilization?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error('Failed to fetch diamond utilization');
      return res.json();
    },
  });

  const { data: divisionStats, isLoading: divisionLoading } = useQuery<DivisionStats[]>({
    queryKey: [`/api/organizations/${organizationId}/reports/division-stats`, { startDate, endDate }],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/reports/division-stats?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error('Failed to fetch division stats');
      return res.json();
    },
  });

  const { data: approvalMetrics, isLoading: metricsLoading } = useQuery<ApprovalMetrics>({
    queryKey: [`/api/organizations/${organizationId}/reports/approval-metrics`, { startDate, endDate }],
    queryFn: async () => {
      const res = await fetch(`/api/organizations/${organizationId}/reports/approval-metrics?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error('Failed to fetch approval metrics');
      return res.json();
    },
  });

  const handleExportCSV = () => {
    if (!diamondUtilization || !divisionStats || !approvalMetrics) return;

    let csvContent = "Diamond Utilization Report\n";
    csvContent += `Date Range: ${startDate} to ${endDate}\n\n`;
    
    csvContent += "Diamond,Total Bookings,Total Hours,Confirmed Bookings,Confirmed Hours\n";
    diamondUtilization.forEach(d => {
      csvContent += `${d.diamondName},${d.totalBookings},${d.totalHours.toFixed(1)},${d.confirmedBookings},${d.confirmedHours.toFixed(1)}\n`;
    });

    csvContent += "\n\nDivision Statistics\n";
    csvContent += "Division,Total Requests,Confirmed,Declined,Pending,Avg Hours\n";
    divisionStats.forEach(d => {
      csvContent += `${d.division},${d.totalRequests},${d.confirmedRequests},${d.declinedRequests},${d.pendingRequests},${d.averageBookingHours.toFixed(1)}\n`;
    });

    csvContent += "\n\nApproval Metrics\n";
    csvContent += `Total Requests,${approvalMetrics.totalRequests}\n`;
    csvContent += `Confirmed,${approvalMetrics.confirmedCount}\n`;
    csvContent += `Declined,${approvalMetrics.declinedCount}\n`;
    csvContent += `Pending,${approvalMetrics.pendingCount}\n`;
    csvContent += `Cancelled,${approvalMetrics.cancelledCount}\n`;
    csvContent += `Approval Rate,${(approvalMetrics.approvalRate * 100).toFixed(1)}%\n`;
    csvContent += `Avg Approval Time (hours),${approvalMetrics.averageApprovalTimeHours.toFixed(1)}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `booking-report-${startDate}-to-${endDate}.csv`;
    link.click();
  };

  const isLoading = utilizationLoading || divisionLoading || metricsLoading;

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Booking Reports
          </CardTitle>
          <CardDescription>Analyze diamond usage, division activity, and approval performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-report-start-date"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-report-end-date"
              />
            </div>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              disabled={isLoading || !diamondUtilization}
              data-testid="button-export-csv"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Approval Metrics */}
          {approvalMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span className="text-2xl font-bold">{approvalMetrics.totalRequests}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Approval Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-2xl font-bold">{(approvalMetrics.approvalRate * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {approvalMetrics.confirmedCount} confirmed, {approvalMetrics.declinedCount} declined
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Approval Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-purple-600" />
                    <span className="text-2xl font-bold">{approvalMetrics.averageApprovalTimeHours.toFixed(1)}h</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="text-2xl font-bold">{approvalMetrics.pendingCount}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Diamond Utilization */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Diamond Utilization
              </CardTitle>
              <CardDescription>Booking volume and hours by diamond</CardDescription>
            </CardHeader>
            <CardContent>
              {!diamondUtilization || diamondUtilization.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No diamond utilization data for this period</p>
              ) : (
                <div className="space-y-4">
                  {diamondUtilization.map((diamond) => (
                    <div
                      key={diamond.diamondId}
                      className="border rounded-lg p-4"
                      data-testid={`diamond-util-${diamond.diamondId}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-semibold">{diamond.diamondName}</h4>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Total Bookings</div>
                          <div className="font-bold">{diamond.totalBookings}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Total Hours</div>
                          <div className="font-medium">{diamond.totalHours.toFixed(1)}h</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Confirmed Hours</div>
                          <div className="font-medium text-green-600">{diamond.confirmedHours.toFixed(1)}h</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Division Statistics */}
          <Card>
            <CardHeader>
              <CardTitle>Division Statistics</CardTitle>
              <CardDescription>Booking activity by division</CardDescription>
            </CardHeader>
            <CardContent>
              {!divisionStats || divisionStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No division statistics for this period</p>
              ) : (
                <div className="space-y-4">
                  {divisionStats.map((division) => (
                    <div
                      key={division.division}
                      className="border rounded-lg p-4"
                      data-testid={`division-stats-${division.division}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-semibold text-lg">{division.division}</h4>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Total Requests</div>
                          <div className="font-bold text-xl">{division.totalRequests}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <div>
                            <div className="text-muted-foreground">Confirmed</div>
                            <div className="font-medium">{division.confirmedRequests}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-600" />
                          <div>
                            <div className="text-muted-foreground">Declined</div>
                            <div className="font-medium">{division.declinedRequests}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-600" />
                          <div>
                            <div className="text-muted-foreground">Pending</div>
                            <div className="font-medium">{division.pendingRequests}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <div>
                            <div className="text-muted-foreground">Avg Hours</div>
                            <div className="font-medium">{division.averageBookingHours.toFixed(1)}h</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
