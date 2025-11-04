import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Upload, AlertCircle } from 'lucide-react';

interface CSVReimportToolProps {
  tournamentId: string;
}

export function CSVReimportTool({ tournamentId }: CSVReimportToolProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const parseCSV = (csvText: string) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const data = lines.slice(1).map(line => {
      const values = line.match(/("([^"]*)"|[^,]+)/g) || [];
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.replace(/"/g, '').trim() || '';
      });
      
      return row;
    });
    
    return data;
  };

  const diamondCoordinates: Record<string, { lat: number; lng: number }> = {
    'Bernie Amlin Field (BAF)': { lat: 42.208056, lng: -83.009443 },
    'Tom Wilson Field (TWF)': { lat: 42.209054, lng: -83.008994 },
    'Optimist 1 (OPT1)': { lat: 42.208169, lng: -83.008209 },
    'Optimist 2 (OPT2)': { lat: 42.208594, lng: -83.007789 },
    'Donna Bombardier Diamond (DBD)': { lat: 42.209259, lng: -83.009798 }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const csvData = parseCSV(text);
      
      // Extract unique divisions and pools
      const ageDivisions = [...new Set(csvData.map(row => row.Division))].filter(Boolean);
      // Strip "Pool" prefix from pool names to match main import format
      const pools = [...new Set(csvData.map(row => {
        if (!row.Pool) return null;
        const cleanPoolName = row.Pool.replace(/^Pool\s+/i, '');
        return `${row.Division}-${cleanPoolName}`;
      }))]
        .filter(p => p && p.includes('-'));
      
      // Add playoff pools for each division (for playoff games without pools)
      ageDivisions.forEach(div => {
        pools.push(`${div}-Playoff`);
      });
      
      // Extract unique teams (skip playoff placeholders)
      const teams = new Set<string>();
      csvData.forEach(row => {
        // Skip playoff placeholder teams like "Seed #3", "Winner of game"
        const isPlayoffPlaceholder = (team: string) => 
          team.includes('Seed #') || team.includes('Winner of');
        
        if (row['Team 1'] && !isPlayoffPlaceholder(row['Team 1'])) {
          teams.add(`${row.Division}-${row['Team 1']}`);
        }
        if (row['Team 2'] && !isPlayoffPlaceholder(row['Team 2'])) {
          teams.add(`${row.Division}-${row['Team 2']}`);
        }
      });
      
      // Transform games data with proper column mapping
      const games = csvData.map(row => {
        const gameId = `${tournamentId}_g${row['Game #']}`;
        
        // Check if this is a playoff game with placeholder teams
        const isPlayoffPlaceholder = (team: string) => 
          team.includes('Seed #') || team.includes('Winner of');
        
        // For playoff games with placeholders, use empty team IDs
        const divId = `${tournamentId}_div_${row.Division}`;
        const homeTeamId = row['Team 1'] && !isPlayoffPlaceholder(row['Team 1']) 
          ? `${tournamentId}_team_div_${row.Division}-${row['Team 1']}` 
          : '';
        const awayTeamId = row['Team 2'] && !isPlayoffPlaceholder(row['Team 2'])
          ? `${tournamentId}_team_div_${row.Division}-${row['Team 2']}`
          : '';
        
        // Use regular pool or playoff pool for games without pools
        // Strip "Pool" prefix from pool name to match main import format
        const poolName = row.Pool ? row.Pool.replace(/^Pool\s+/i, '') : '';
        const poolId = poolName 
          ? `${tournamentId}_pool_div_${row.Division}-${poolName}` 
          : `${tournamentId}_pool_div_${row.Division}-Playoff`;
        
        return {
          id: gameId,
          homeTeamId,
          awayTeamId,
          homeScore: row['Team 1 Score'] ? parseInt(row['Team 1 Score']) : null,
          awayScore: row['Team 2 Score'] ? parseInt(row['Team 2 Score']) : null,
          date: row.Date,
          time: row.Time, // Keep in Central time, will be converted on display
          location: row.Venue || '3215 Forest Glade Dr',
          subVenue: row.SubVenue || '',
          isPlayoff: row['Match Type'] === 'playoff',
          poolId: poolId,
          status: 'scheduled' as const
        };
      }).filter(game => game.homeTeamId && game.awayTeamId); // Only include games with both teams
      
      // Prepare the data for bulk import
      const importData = {
        ageDivisions: ageDivisions.map(div => ({
          id: `${tournamentId}_div_${div}`,
          name: div,
          sortOrder: div === '11U' ? 1 : 2
        })),
        pools: pools.filter(p => p.split('-')[1]).map(pool => {
          const [division, ...poolParts] = pool.split('-');
          const poolName = poolParts.join('-');
          // Remove "Pool" prefix to match main import format
          const cleanPoolName = poolName.replace(/^Pool\s+/i, '');
          return {
            id: `${tournamentId}_pool_div_${division}-${cleanPoolName}`,
            name: cleanPoolName,
            ageDivisionId: `${tournamentId}_div_${division}`
          };
        }),
        teams: Array.from(teams).map(team => {
          const [division, ...nameParts] = team.split('-');
          const teamName = nameParts.join(' ');
          const poolMatch = csvData.find(row => 
            (row['Team 1'] === teamName || row['Team 2'] === teamName) && 
            row.Division === division && 
            row.Pool
          );
          
          return {
            id: `${tournamentId}_team_div_${division}-${teamName}`, // Keep spaces in team ID
            name: teamName,
            ageDivisionId: `${tournamentId}_div_${division}`,
            poolId: poolMatch?.Pool 
              ? `${tournamentId}_pool_div_${division}-${poolMatch.Pool.replace(/^Pool\s+/i, '')}` 
              : `${tournamentId}_pool_div_${division}-Playoff` // Use playoff pool if no pool found
          };
        }),
        games
      };
      
      // Make the API call to bulk import
      const response = await fetch(`/api/tournaments/${tournamentId}/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to import data');
      }
      
      toast({
        title: 'Success!',
        description: `Imported ${games.length} games with proper venue and diamond data`,
      });
      
      // Refresh the page to show updated data
      window.location.reload();
      
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: 'Import Failed',
        description: 'There was an error importing the CSV file',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">CSV Data Re-import</h3>
            <p className="text-sm text-gray-600 mt-1">
              Upload the corrected CSV file to fix the venue and diamond data
            </p>
          </div>
        </div>
        
        <div className="space-y-2">
          <p className="text-sm text-gray-700">Expected CSV columns:</p>
          <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
            <li>Game #, Division, Pool, Team 1, Team 1 Score, Team 2 Score, Team 2</li>
            <li>Match Type, Date, Time, Venue, SubVenue</li>
          </ul>
          <p className="text-xs text-blue-600 mt-2">
            <strong>Note:</strong> Times in CSV should be in Central Time. They will be displayed in Eastern Time (+1 hour).
          </p>
        </div>
        
        <div className="pt-2">
          <label htmlFor="csv-upload" className="block">
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isProcessing}
              className="hidden"
            />
            <Button
              type="button"
              disabled={isProcessing}
              className="w-full cursor-pointer bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
              asChild
            >
              <span>
                <Upload className="w-4 h-4 mr-2" />
                {isProcessing ? 'Processing...' : 'Upload CSV File'}
              </span>
            </Button>
          </label>
        </div>
      </div>
    </Card>
  );
}