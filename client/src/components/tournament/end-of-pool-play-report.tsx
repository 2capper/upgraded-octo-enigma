import { useQuery } from '@tanstack/react-query';
import { Loader2, Trophy } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StandingsReportRow {
  rank: number;
  teamName: string;
  poolName: string;
  poolRank: number;
  record: string;
  points: number;
  runsFor: number;
  runsAgainst: number;
  runDifferential: number;
  tieBreaker_RunsAgainstPerInning: string;
  offensiveInnings: number;
  defensiveInnings: number;
}

interface AgeDivision {
  id: string;
  name: string;
  tournamentId: string;
}

interface EndOfPoolPlayReportProps {
  tournamentId: string;
}

export function EndOfPoolPlayReport({ tournamentId }: EndOfPoolPlayReportProps) {
  // First, fetch divisions for this tournament
  const { data: divisions, isLoading: divisionsLoading, error: divisionsError } = useQuery<AgeDivision[]>({
    queryKey: ['/api/tournaments', tournamentId, 'age-divisions'],
    enabled: !!tournamentId,
  });

  // Use the first division for the MVP (can be extended to support division selection)
  const divisionId = divisions?.[0]?.id;

  // Fetch standings report for the division
  const { data: standingsData, isLoading: standingsLoading, error: standingsError } = useQuery<StandingsReportRow[]>({
    queryKey: [`/api/tournaments/${tournamentId}/standings-report`, divisionId],
    queryFn: async () => {
      if (!divisionId) throw new Error('Division ID is required');
      const res = await fetch(`/api/tournaments/${tournamentId}/standings-report?divisionId=${divisionId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
    enabled: !!tournamentId && !!divisionId,
  });

  const isLoading = divisionsLoading || standingsLoading;
  const error = divisionsError || standingsError;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--field-green)]" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load standings report. Please try again.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!standingsData || standingsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            End of Pool Play Report
          </CardTitle>
          <CardDescription>
            No standings data available. Complete some pool play games to generate this report.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const divisionName = divisions?.[0]?.name || 'Division';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5" />
          End of Pool Play Report - {divisionName}
        </CardTitle>
        <CardDescription>
          Official tournament seeding based on all completed pool play games and tie-breaker rules.
          This report shows how playoff seeding was determined for the {divisionName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-800">
                <TableHead className="font-semibold text-center w-[60px]">Seed</TableHead>
                <TableHead className="font-semibold min-w-[180px]">Team</TableHead>
                <TableHead className="font-semibold text-center w-[100px]">Pool</TableHead>
                <TableHead className="font-semibold text-center w-[80px]">Pool Rank</TableHead>
                <TableHead className="font-semibold text-center w-[100px]">Record (W-L-T)</TableHead>
                <TableHead className="font-semibold text-center w-[60px]">PTS</TableHead>
                <TableHead className="font-semibold text-center w-[60px]">RF</TableHead>
                <TableHead className="font-semibold text-center w-[60px]">RA</TableHead>
                <TableHead className="font-semibold text-center w-[80px]">Run Diff</TableHead>
                <TableHead className="font-semibold text-center w-[100px]">Tie-Breaker (RA/Inn)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standingsData.map((team) => (
                <TableRow 
                  key={team.rank} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  data-testid={`row-team-${team.rank}`}
                >
                  <TableCell className="font-bold text-center" data-testid={`text-seed-${team.rank}`}>
                    {team.rank}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-team-name-${team.rank}`}>
                    {team.teamName}
                  </TableCell>
                  <TableCell className="text-center text-sm" data-testid={`text-pool-${team.rank}`}>
                    {team.poolName}
                  </TableCell>
                  <TableCell className="text-center" data-testid={`text-pool-rank-${team.rank}`}>
                    {team.poolRank}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm" data-testid={`text-record-${team.rank}`}>
                    {team.record}
                  </TableCell>
                  <TableCell className="text-center font-semibold" data-testid={`text-points-${team.rank}`}>
                    {team.points}
                  </TableCell>
                  <TableCell className="text-center text-green-600 dark:text-green-400 font-semibold" data-testid={`text-runs-for-${team.rank}`}>
                    {team.runsFor}
                  </TableCell>
                  <TableCell className="text-center text-red-600 dark:text-red-400 font-semibold" data-testid={`text-runs-against-${team.rank}`}>
                    {team.runsAgainst}
                  </TableCell>
                  <TableCell 
                    className={`text-center font-semibold ${
                      team.runDifferential > 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : team.runDifferential < 0 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                    data-testid={`text-run-diff-${team.rank}`}
                  >
                    {team.runDifferential > 0 ? '+' : ''}{team.runDifferential}
                  </TableCell>
                  <TableCell className="text-center font-mono text-sm font-semibold" data-testid={`text-tiebreaker-${team.rank}`}>
                    {team.tieBreaker_RunsAgainstPerInning}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-semibold mb-2 text-sm" style={{ color: 'var(--deep-navy)' }}>
            How to Read This Report
          </h4>
          <ul className="text-sm text-[var(--text-secondary)] space-y-1">
            <li>• <strong>Seed:</strong> Final playoff seeding position (lower number = better seed)</li>
            <li>• <strong>Pool Rank:</strong> Team's finish position within their pool</li>
            <li>• <strong>PTS:</strong> Points earned (2 for win, 1 for tie, 0 for loss)</li>
            <li>• <strong>RF:</strong> Runs scored (shown in green)</li>
            <li>• <strong>RA:</strong> Runs allowed (shown in red)</li>
            <li>• <strong>Run Diff:</strong> Net run differential (RF - RA)</li>
            <li>• <strong>Tie-Breaker (RA/Inn):</strong> Runs allowed per defensive inning (lower is better) - used when teams have the same points</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
