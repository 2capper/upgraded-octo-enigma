import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Printer, AlertTriangle, CheckCircle2, TrendingUp, Trophy, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ValidationReport {
  tournament: any;
  pools: any[];
  teams: any[];
  games: any[];
  poolStandings: PoolStandingsReport[];
  seeding: SeedingReport[];
  playoffBracket: PlayoffBracketReport[];
  isComplete: boolean;
  warnings: string[];
}

interface PoolStandingsReport {
  pool: any;
  teams: TeamStandingDetail[];
}

interface TeamStandingDetail {
  team: any;
  rank: number;
  record: {
    wins: number;
    losses: number;
    ties: number;
    points: number;
  };
  runs: {
    runsFor: number;
    runsAgainst: number;
    runDifferential: number;
  };
  ratios: {
    runsAgainstPerInning: number;
    runsForPerInning: number;
    offensiveInnings: number;
    defensiveInnings: number;
  };
  games: GameDetail[];
  tieBreakers: TieBreakerExplanation[];
}

interface GameDetail {
  game: any;
  opponent: any;
  result: 'W' | 'L' | 'T';
  runsFor: number;
  runsAgainst: number;
  inningsBatted: number;
  inningsPitched: number;
}

interface TieBreakerExplanation {
  rule: string;
  description: string;
  value: string | number;
  comparedTo?: Array<{ teamName: string; value: string | number }>;
}

interface SeedingReport {
  seed: number;
  team: any;
  pool: any;
  poolRank: number;
  seedingPattern: string;
  explanation: string;
}

interface PlayoffBracketReport {
  round: number;
  gameNumber: number;
  bracket: 'winners' | 'losers' | 'championship';
  team1?: any;
  team2?: any;
  matchupDescription: string;
}

export default function ValidationReportPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  
  const { data: report, isLoading, error } = useQuery<ValidationReport>({
    queryKey: [`/api/tournaments/${tournamentId}/validation-report`],
    enabled: !!tournamentId,
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--field-green)]" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load validation report. Please try again.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header - Hidden when printing */}
      <div className="bg-white border-b sticky top-0 z-10 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--deep-navy)' }}>
                Tournament Validation Report
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {report.tournament.name}
              </p>
            </div>
            <Button onClick={handlePrint} data-testid="button-print-report">
              <Printer className="w-4 h-4 mr-2" />
              Print Report
            </Button>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:px-0 print:py-0">
        {/* Print Header - Only visible when printing */}
        <div className="hidden print:block mb-8">
          <h1 className="text-3xl font-bold text-center mb-2">Tournament Validation Report</h1>
          <h2 className="text-xl text-center text-gray-600 mb-4">{report.tournament.name}</h2>
          <p className="text-sm text-center text-gray-500">
            Generated: {new Date().toLocaleString()}
          </p>
        </div>

        {/* Warnings */}
        {report.warnings.length > 0 && (
          <Alert className="mb-6" data-testid="alert-warnings">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside">
                {report.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Tournament Summary */}
        <Card className="mb-6 print:shadow-none print:border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Tournament Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Tournament Type</p>
                <p className="font-semibold capitalize">{report.tournament.type?.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-gray-500">Teams</p>
                <p className="font-semibold">{report.teams.length}</p>
              </div>
              <div>
                <p className="text-gray-500">Pools</p>
                <p className="font-semibold">{report.pools.length}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Games</p>
                <p className="font-semibold">{report.games.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pool Standings with Detailed Game-by-Game */}
        {report.poolStandings.map((poolReport, poolIndex) => (
          <Card key={poolIndex} className="mb-6 print:shadow-none print:border print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                {poolReport.pool.name} - Standings & Tie-Breakers
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Standings Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Rank</th>
                      <th className="text-left py-2 px-2">Team</th>
                      <th className="text-center py-2 px-2">W-L-T</th>
                      <th className="text-center py-2 px-2">Pts</th>
                      <th className="text-center py-2 px-2">RF</th>
                      <th className="text-center py-2 px-2">RA</th>
                      <th className="text-center py-2 px-2">RD</th>
                      <th className="text-center py-2 px-2">RA/DIP</th>
                      <th className="text-center py-2 px-2">RF/OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {poolReport.teams.map((teamDetail, teamIndex) => (
                      <tr key={teamIndex} className="border-b">
                        <td className="py-2 px-2 font-semibold">{teamDetail.rank}</td>
                        <td className="py-2 px-2 font-semibold">{teamDetail.team.name}</td>
                        <td className="text-center py-2 px-2">
                          {teamDetail.record.wins}-{teamDetail.record.losses}-{teamDetail.record.ties}
                        </td>
                        <td className="text-center py-2 px-2 font-semibold">{teamDetail.record.points}</td>
                        <td className="text-center py-2 px-2">{teamDetail.runs.runsFor}</td>
                        <td className="text-center py-2 px-2">{teamDetail.runs.runsAgainst}</td>
                        <td className="text-center py-2 px-2">
                          {teamDetail.runs.runDifferential > 0 ? '+' : ''}
                          {teamDetail.runs.runDifferential}
                        </td>
                        <td className="text-center py-2 px-2">{teamDetail.ratios.runsAgainstPerInning.toFixed(3)}</td>
                        <td className="text-center py-2 px-2">{teamDetail.ratios.runsForPerInning.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Detailed Team Breakdowns */}
              {poolReport.teams.map((teamDetail, teamIndex) => (
                <div key={teamIndex} className="border-t pt-4 print:break-inside-avoid">
                  <h4 className="font-semibold text-lg mb-3" style={{ color: 'var(--deep-navy)' }}>
                    #{teamDetail.rank} {teamDetail.team.name} - Detailed Breakdown
                  </h4>
                  
                  {/* Game-by-Game Results */}
                  <div className="mb-4">
                    <h5 className="font-semibold text-sm mb-2">Game Results:</h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left py-1 px-2">Opponent</th>
                            <th className="text-center py-1 px-2">Result</th>
                            <th className="text-center py-1 px-2">Score</th>
                            <th className="text-center py-1 px-2">Inn Batted</th>
                            <th className="text-center py-1 px-2">Inn Pitched</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamDetail.games.map((game, gameIndex) => (
                            <tr key={gameIndex} className="border-b">
                              <td className="py-1 px-2">{game.opponent.name}</td>
                              <td className="text-center py-1 px-2">
                                <span className={`font-semibold ${
                                  game.result === 'W' ? 'text-green-600' : 
                                  game.result === 'L' ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                  {game.result}
                                </span>
                              </td>
                              <td className="text-center py-1 px-2">{game.runsFor}-{game.runsAgainst}</td>
                              <td className="text-center py-1 px-2">{game.inningsBatted}</td>
                              <td className="text-center py-1 px-2">{game.inningsPitched}</td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50 font-semibold">
                            <td className="py-1 px-2">Totals:</td>
                            <td className="text-center py-1 px-2">
                              {teamDetail.record.wins}-{teamDetail.record.losses}-{teamDetail.record.ties}
                            </td>
                            <td className="text-center py-1 px-2">
                              {teamDetail.runs.runsFor}-{teamDetail.runs.runsAgainst}
                            </td>
                            <td className="text-center py-1 px-2">{teamDetail.ratios.offensiveInnings}</td>
                            <td className="text-center py-1 px-2">{teamDetail.ratios.defensiveInnings}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Tie-Breaker Explanations */}
                  <div>
                    <h5 className="font-semibold text-sm mb-2">Tie-Breaker Analysis:</h5>
                    <div className="space-y-2">
                      {teamDetail.tieBreakers.map((tieBreaker, tbIndex) => (
                        <div key={tbIndex} className="bg-gray-50 p-3 rounded text-xs">
                          <p className="font-semibold text-blue-700">{tieBreaker.rule}</p>
                          <p className="text-gray-600 mb-1">{tieBreaker.description}</p>
                          <p className="font-semibold">{teamDetail.team.name}: {tieBreaker.value}</p>
                          {tieBreaker.comparedTo && tieBreaker.comparedTo.length > 0 && (
                            <div className="mt-1 pl-4 border-l-2 border-gray-300">
                              {tieBreaker.comparedTo.map((comp, compIndex) => (
                                <p key={compIndex} className="text-gray-600">
                                  {comp.teamName}: {comp.value}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        {/* Seeding Report */}
        {report.seeding.length > 0 && (
          <Card className="mb-6 print:shadow-none print:border print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Playoff Seeding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Seed</th>
                      <th className="text-left py-2 px-2">Team</th>
                      <th className="text-left py-2 px-2">Pool</th>
                      <th className="text-center py-2 px-2">Pool Rank</th>
                      <th className="text-left py-2 px-2">Explanation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.seeding.map((seed, index) => (
                      <tr key={index} className="border-b">
                        <td className="py-2 px-2 font-semibold">#{seed.seed}</td>
                        <td className="py-2 px-2">{seed.team.name}</td>
                        <td className="py-2 px-2">{seed.pool.name}</td>
                        <td className="text-center py-2 px-2">{seed.poolRank}</td>
                        <td className="py-2 px-2 text-xs text-gray-600">{seed.explanation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Playoff Bracket */}
        {report.playoffBracket.length > 0 && (
          <Card className="mb-6 print:shadow-none print:border print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                Playoff Bracket
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from(new Set(report.playoffBracket.map(g => g.round))).map(round => (
                  <div key={round}>
                    <h4 className="font-semibold mb-2" style={{ color: 'var(--deep-navy)' }}>
                      Round {round}
                      {round === Math.max(...report.playoffBracket.map(g => g.round)) && ' (Championship)'}
                    </h4>
                    <div className="space-y-2">
                      {report.playoffBracket
                        .filter(g => g.round === round)
                        .map((game, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded text-sm">
                            <p className="text-xs text-gray-500 mb-1">Game {game.gameNumber}</p>
                            <p className="font-semibold">{game.matchupDescription}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion Badge */}
        <div className="text-center mt-8 mb-4 print:mt-12">
          {report.isComplete ? (
            <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-semibold">Pool Play Complete - Results are Final</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 bg-yellow-50 text-yellow-700 px-4 py-2 rounded-full">
              <AlertTriangle className="w-5 h-5" />
              <span className="font-semibold">Pool Play In Progress - Results are Preliminary</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-500 mt-8 print:mt-12">
          <p>This validation report provides complete transparency into all tournament calculations.</p>
          <p className="mt-1">Generated on {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
