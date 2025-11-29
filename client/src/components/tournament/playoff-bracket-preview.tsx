import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface PlayoffBracketPreviewProps {
  playoffFormat: string;
  seedingPattern: string;
  pools: any[];
  primaryColor?: string;
  secondaryColor?: string;
}

export function PlayoffBracketPreview({
  playoffFormat,
  seedingPattern,
  pools,
  primaryColor = '#1f2937',
  secondaryColor = '#ca8a04',
}: PlayoffBracketPreviewProps) {
  
  // Cross-pool bracket structure for cross_pool_4 seeding
  if (seedingPattern === 'cross_pool_4') {
    const poolNames = ['A', 'B', 'C', 'D'];
    const hasAllPools = poolNames.every(name => 
      pools.some(p => p.name === `Pool ${name}`)
    );

    if (!hasAllPools) {
      return (
        <div className="text-center p-8 bg-gray-50 rounded-xl">
          <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Bracket Preview Unavailable</h3>
          <p className="text-gray-500">Cross-pool playoff format requires 4 pools (A, B, C, D) to be created first.</p>
        </div>
      );
    }

    return (
      <div className="space-y-8">
        {/* Pool Standings Preview */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Pool Standings</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {poolNames.map(poolName => {
              const pool = pools.find(p => p.name === `Pool ${poolName}`);
              return (
                <Card key={poolName}>
                  <CardContent className="pt-4">
                    <h5 className="font-semibold mb-2" style={{ color: primaryColor }}>
                      Pool {poolName}
                    </h5>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>1st Place:</span>
                        <span className="font-medium">{poolName}1</span>
                      </div>
                      <div className="flex justify-between">
                        <span>2nd Place:</span>
                        <span className="font-medium">{poolName}2</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Bracket Structure */}
        <div>
          <h4 className="text-lg font-semibold mb-4">Playoff Bracket Structure</h4>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Quarterfinals */}
            <div className="space-y-6">
              <h5 className="text-center font-semibold text-gray-700">Quarterfinals</h5>
              {[
                { home: 'A1', away: 'C2', gameNum: 1 },
                { home: 'A2', away: 'C1', gameNum: 2 },
                { home: 'B1', away: 'D2', gameNum: 3 },
                { home: 'B2', away: 'D1', gameNum: 4 },
              ].map((matchup) => (
                <Card key={matchup.gameNum} className="border-2" style={{ borderColor: primaryColor }}>
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500 mb-2">QF Game {matchup.gameNum}</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium">{matchup.home}</span>
                        <span className="text-gray-400">-</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="font-medium">{matchup.away}</span>
                        <span className="text-gray-400">-</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Semifinals */}
            <div className="space-y-6">
              <h5 className="text-center font-semibold text-gray-700">Semifinals</h5>
              {[
                { label: 'Winner QF1 vs Winner QF2', gameNum: 1 },
                { label: 'Winner QF3 vs Winner QF4', gameNum: 2 },
              ].map((matchup) => (
                <Card key={matchup.gameNum} className="border-2 mt-20" style={{ borderColor: secondaryColor }}>
                  <CardContent className="p-4">
                    <div className="text-xs text-gray-500 mb-2">SF Game {matchup.gameNum}</div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">Winner QF{matchup.gameNum * 2 - 1}</span>
                        <span className="text-gray-400">-</span>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">Winner QF{matchup.gameNum * 2}</span>
                        <span className="text-gray-400">-</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Finals */}
            <div className="space-y-6">
              <h5 className="text-center font-semibold text-gray-700">Finals</h5>
              <Card className="border-2 mt-32" style={{ borderColor: '#fbbf24' }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-4 h-4 text-yellow-500" />
                    <div className="text-xs text-gray-500">Championship</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">Winner SF1</span>
                      <span className="text-gray-400">-</span>
                    </div>
                    <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">Winner SF2</span>
                      <span className="text-gray-400">-</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-800">
            <strong>Preview Mode:</strong> This shows the bracket structure for your tournament. 
            Once pool play is complete, generate the playoff bracket to fill in the actual teams based on final standings.
          </p>
        </div>
      </div>
    );
  }

  // Standard bracket preview for top_8, top_6, top_4 formats
  const teamsInPlayoff = playoffFormat === 'top_8' ? 8 : playoffFormat === 'top_6' ? 6 : playoffFormat === 'top_4' ? 4 : 0;
  
  if (teamsInPlayoff === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-xl">
        <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">Playoff Format Not Configured</h3>
        <p className="text-gray-500">Configure your tournament's playoff format to see the bracket preview.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Playoff Format:</strong> Top {teamsInPlayoff} teams will advance to playoffs. 
          Bracket will be generated based on final pool play standings.
        </p>
      </div>

      <div className="text-center p-8 bg-gray-50 rounded-xl">
        <Trophy className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">{playoffFormat.replace('_', ' ').toUpperCase()} Playoff Bracket</h3>
        <p className="text-gray-500">
          {teamsInPlayoff} teams will compete in the playoff bracket.
        </p>
        <p className="text-gray-500 mt-2">
          Complete pool play and generate the playoff bracket to see matchups.
        </p>
      </div>
    </div>
  );
}
