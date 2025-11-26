import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatCardSkeleton() {
  return (
    <Card data-testid="skeleton-stat-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export function GameCardSkeleton() {
  return (
    <Card className="overflow-hidden" data-testid="skeleton-game-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-6 w-8" />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StandingsTableSkeleton() {
  return (
    <Card data-testid="skeleton-standings-table">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b">
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
            <Skeleton className="h-4 w-8" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <Skeleton className="h-4 w-6" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function TournamentHeaderSkeleton() {
  return (
    <div className="mb-6" data-testid="skeleton-tournament-header">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 items-end">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}

export function TabsNavigationSkeleton() {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" data-testid="skeleton-tabs">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-9 w-24 rounded-md" />
      ))}
    </div>
  );
}

export function TournamentDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50" data-testid="skeleton-tournament-dashboard">
      <div className="px-4 py-4 md:py-8">
        <TournamentHeaderSkeleton />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        
        <TabsNavigationSkeleton />
        
        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CommunicationsComposeSkeleton() {
  return (
    <div className="grid md:grid-cols-2 gap-4" data-testid="skeleton-communications-compose">
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
          <Skeleton className="h-9 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="space-y-2 border rounded-md p-3 max-h-64 overflow-hidden">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="h-4 w-4" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40 mt-1" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-3">
            <Skeleton className="h-4 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-20" />
            </div>
          </div>
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
