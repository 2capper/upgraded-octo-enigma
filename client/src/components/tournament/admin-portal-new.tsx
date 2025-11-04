import { useState } from 'react';
import { UploadCloud, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface AdminPortalNewProps {
  tournamentId: string;
  onImportSuccess?: () => void;
}

export const AdminPortalNew = ({ tournamentId, onImportSuccess }: AdminPortalNewProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(tournamentId);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all tournaments for selection
  const { data: tournaments = [] } = useQuery({
    queryKey: ['/api/tournaments'],
    queryFn: async () => {
      const response = await fetch('/api/tournaments');
      if (!response.ok) throw new Error('Failed to fetch tournaments');
      return response.json();
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (importData: any) => {
      const response = await fetch(`/api/tournaments/${selectedTournamentId}/bulk-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });
      if (!response.ok) throw new Error('Failed to import data');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Import Successful",
        description: `Tournament data has been successfully imported to ${tournaments.find((t: any) => t.id === selectedTournamentId)?.name || selectedTournamentId}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', selectedTournamentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      setFile(null);
      if (onImportSuccess) onImportSuccess();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import tournament data. Please check your CSV file format.",
        variant: "destructive",
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage({ type: '', text: '' });
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const adjustTimeToET = (timeString: string) => {
    if (!timeString) return '';
    const timeParts = timeString.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!timeParts) return timeString;

    let [, hours, minutes, modifier] = timeParts;
    let hoursNum = parseInt(hours, 10);

    if (modifier.toUpperCase() === 'PM' && hoursNum !== 12) {
      hoursNum += 12;
    }
    if (modifier.toUpperCase() === 'AM' && hoursNum === 12) {
      hoursNum = 0;
    }

    hoursNum += 1;

    if (hoursNum >= 24) {
      hoursNum -= 24;
    }

    const newModifier = hoursNum >= 12 ? 'PM' : 'AM';
    let displayHours = hoursNum % 12;
    if (displayHours === 0) {
      displayHours = 12;
    }

    const displayMinutes = `0${parseInt(minutes, 10)}`.slice(-2);
    return `${displayHours}:${displayMinutes} ${newModifier}`;
  };

  const handleImport = async () => {
    if (!file) {
      setMessage({ type: 'error', text: 'Please select a file to import.' });
      return;
    }

    setMessage({ type: 'info', text: 'Processing CSV file...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          setMessage({ type: 'error', text: 'CSV file is empty or has no data rows.' });
          return;
        }

        // Function to properly parse CSV row handling quoted values
        const parseCSVRow = (row: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            const nextChar = row[i + 1];
            
            if (char === '"' && (i === 0 || row[i - 1] === ',')) {
              // Start of quoted value
              inQuotes = true;
            } else if (char === '"' && nextChar === ',' && inQuotes) {
              // End of quoted value
              inQuotes = false;
            } else if (char === '"' && i === row.length - 1 && inQuotes) {
              // End of quoted value at end of line
              inQuotes = false;
            } else if (char === ',' && !inQuotes) {
              // End of field
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          
          // Add the last field
          if (current || row.endsWith(',')) {
            result.push(current);
          }
          
          return result;
        };

        const normalizeHeader = (h: string) => h.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const rawHeaders = parseCSVRow(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));

        const headerMapping: Record<string, string[]> = {
          matchNumber: ['game', 'match', 'matchno', 'game#'],
          date: ['date'],
          time: ['time'],
          venue: ['venue', 'location', 'diamond'],
          subVenue: ['subvenue', 'sub-venue'],
          division: ['division'],
          pool: ['pool'],
          matchType: ['matchtype', 'gametype', 'type', 'match type'],
          homeTeam: ['hometeam', 'home', 'team1', 'team 1'],
          awayTeam: ['awayteam', 'visitor', 'away', 'team2', 'team 2']
        };

        const columnIndexMap: Record<string, number> = {};
        const foundHeaders = new Set<string>();

        rawHeaders.forEach((rawHeader, index) => {
          const normalized = normalizeHeader(rawHeader);
          for (const canonicalHeader in headerMapping) {
            if (headerMapping[canonicalHeader].includes(normalized)) {
              columnIndexMap[canonicalHeader] = index;
              foundHeaders.add(canonicalHeader);
              break;
            }
          }
        });

        const requiredCanonicalHeaders = ['matchNumber', 'date', 'time', 'venue', 'division', 'pool', 'homeTeam', 'awayTeam'];
        const missingHeaders = requiredCanonicalHeaders.filter(h => !foundHeaders.has(h));

        if (missingHeaders.length > 0) {
          setMessage({ 
            type: 'error', 
            text: `CSV is missing required columns: ${missingHeaders.join(', ')}. Found headers: ${rawHeaders.join(', ')}` 
          });
          return;
        }

        const data = lines.slice(1).map(line => {
          const values = parseCSVRow(line);
          const rowData: Record<string, string> = {};
          for (const key in columnIndexMap) {
            rowData[key] = values[columnIndexMap[key]]?.trim().replace(/^"|"$/g, '') || '';
          }
          return rowData;
        });

        // Check if a team name is a playoff placeholder
        const isPlayoffPlaceholder = (team: string) => {
          if (!team) return false;
          return team.includes('TBD') || 
                 team.includes('Seed #') || 
                 team.includes('Winner of') ||
                 team.includes('Loser of') ||
                 team.toLowerCase().includes('tbd');
        };

        // Validate data - playoff games can have placeholder teams
        const validData = data.filter(row => {
          // Must have division
          if (!row.division) return false;
          
          // Playoff games identified by matchType or placeholder teams
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff' ||
                               isPlayoffPlaceholder(row.homeTeam) || 
                               isPlayoffPlaceholder(row.awayTeam);
          
          // Pool games must have pool and actual team names
          if (!isPlayoffGame) {
            return row.pool && row.homeTeam && row.awayTeam;
          }
          
          // Playoff games must have at least placeholder team names
          return row.homeTeam && row.awayTeam;
        });

        if (validData.length === 0) {
          setMessage({ 
            type: 'error', 
            text: `Found ${data.length} data rows, but 0 were valid. Please check the data in your CSV file.` 
          });
          return;
        }

        // Process data for API
        const divisionsMap = new Map<string, string>();
        const poolsMap = new Map<string, string>();
        const teamsMap = new Map<string, string>();

        const ageDivisions: any[] = [];
        const pools: any[] = [];
        const teams: any[] = [];
        const games: any[] = [];

        // Build structure with tournament-specific IDs
        for (const row of validData) {
          let divisionId = divisionsMap.get(row.division);
          if (!divisionId) {
            divisionId = `${selectedTournamentId}_div_${row.division.replace(/\s+/g, '-')}`;
            divisionsMap.set(row.division, divisionId);
            ageDivisions.push({ id: divisionId, name: row.division });
          }

          // Check if this is a playoff game
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff' ||
                               isPlayoffPlaceholder(row.homeTeam) || 
                               isPlayoffPlaceholder(row.awayTeam);

          let poolId;
          if (isPlayoffGame) {
            // Create or get playoff pool for this division
            const playoffPoolKey = `${divisionId}-Playoff`;
            poolId = poolsMap.get(playoffPoolKey);
            if (!poolId) {
              poolId = `${selectedTournamentId}_pool_${playoffPoolKey.replace(/\s+/g, '-')}`;
              poolsMap.set(playoffPoolKey, poolId);
              pools.push({ id: poolId, name: 'Playoff', ageDivisionId: divisionId });
            }
          } else {
            // Regular pool game
            let poolName = row.pool.replace(row.division, '').trim();
            if (!poolName) poolName = row.pool;
            let poolKey = `${divisionId}-${poolName}`;
            poolId = poolsMap.get(poolKey);
            if (!poolId) {
              poolId = `${selectedTournamentId}_pool_${poolKey.replace(/\s+/g, '-')}`;
              poolsMap.set(poolKey, poolId);
              pools.push({ id: poolId, name: poolName, ageDivisionId: divisionId });
            }
          }

          // Create teams - including placeholder teams for playoffs
          const homeTeamKey = `${divisionId}-${row.homeTeam}`;
          if (!teamsMap.has(homeTeamKey)) {
            const teamId = `${selectedTournamentId}_team_${homeTeamKey.replace(/\s+/g, '-')}`;
            teamsMap.set(homeTeamKey, teamId);
            // For playoff placeholder teams, assign to playoff pool
            const teamPoolId = isPlayoffPlaceholder(row.homeTeam) 
              ? poolsMap.get(`${divisionId}-Playoff`) || poolId 
              : poolId;
            teams.push({ id: teamId, name: row.homeTeam, division: row.division, poolId: teamPoolId });
          }

          const awayTeamKey = `${divisionId}-${row.awayTeam}`;
          if (!teamsMap.has(awayTeamKey)) {
            const teamId = `${selectedTournamentId}_team_${awayTeamKey.replace(/\s+/g, '-')}`;
            teamsMap.set(awayTeamKey, teamId);
            // For playoff placeholder teams, assign to playoff pool
            const teamPoolId = isPlayoffPlaceholder(row.awayTeam) 
              ? poolsMap.get(`${divisionId}-Playoff`) || poolId 
              : poolId;
            teams.push({ id: teamId, name: row.awayTeam, division: row.division, poolId: teamPoolId });
          }
        }

        // Create games
        for (const row of validData) {
          const divisionId = divisionsMap.get(row.division);
          
          // Check if this is a playoff game
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff' ||
                               isPlayoffPlaceholder(row.homeTeam) || 
                               isPlayoffPlaceholder(row.awayTeam);

          // Get appropriate pool ID
          let poolId;
          if (isPlayoffGame) {
            const playoffPoolKey = `${divisionId}-Playoff`;
            poolId = poolsMap.get(playoffPoolKey);
          } else {
            const poolName = row.pool.replace(row.division, '').trim();
            const poolKey = `${divisionId}-${poolName}`;
            poolId = poolsMap.get(poolKey);
          }

          if (!poolId) continue;

          // Get team IDs - all teams should now exist including placeholder teams
          const homeTeamId = teamsMap.get(`${divisionId}-${row.homeTeam}`);
          const awayTeamId = teamsMap.get(`${divisionId}-${row.awayTeam}`);

          // Skip only if we truly don't have team IDs (shouldn't happen now)
          if (!homeTeamId || !awayTeamId) {
            console.warn(`Warning: Game ${row.matchNumber} missing team IDs - this shouldn't happen`);
            continue;
          }

          const gameId = `${selectedTournamentId}_g${row.matchNumber}`;
          
          // Log venue data for debugging
          if (row.matchNumber === '1' || row.matchNumber === '40') {
            console.log(`Game ${row.matchNumber} data:`, {
              venue: row.venue,
              subVenue: row.subVenue,
              date: row.date,
              parsedDate: new Date(row.date).toDateString(),
              time: row.time,
              division: row.division,
              pool: row.pool
            });
          }
          
          games.push({
            id: gameId,
            homeTeamId,
            awayTeamId,
            status: 'scheduled',
            homeScore: null,
            awayScore: null,
            homeInningsBatted: null,
            awayInningsBatted: null,
            poolId,
            forfeitStatus: 'none',
            date: row.date,
            time: row.time, // Store in Central Time, will be converted to ET on display
            location: row.venue || '3215 Forest Glade Dr',
            subVenue: row.subVenue || '',
            tournamentId: selectedTournamentId,
            isPlayoff: isPlayoffGame
          });
        }

        // Count playoff games
        let playoffGamesCount = 0;
        let poolGamesCount = 0;
        for (const row of validData) {
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff' ||
                               isPlayoffPlaceholder(row.homeTeam) || 
                               isPlayoffPlaceholder(row.awayTeam);
          if (isPlayoffGame) {
            playoffGamesCount++;
          } else {
            poolGamesCount++;
          }
        }

        // Log import details for debugging
        console.log('CSV Import Summary:');
        console.log(`- Total rows in CSV: ${data.length}`);
        console.log(`- Valid data rows: ${validData.length}`);
        console.log(`- Games imported: ${games.length}`);
        console.log(`  - Pool games: ${poolGamesCount}`);
        console.log(`  - Playoff games: ${playoffGamesCount}`);
        console.log(`- Divisions: ${ageDivisions.length}`);
        console.log(`- Pools: ${pools.length} (including playoff pools)`);
        console.log(`- Teams: ${teams.length} (including placeholder teams)`);

        bulkImportMutation.mutate({
          ageDivisions,
          pools,
          teams,
          games
        });

        setMessage({ 
          type: 'success', 
          text: `Successfully imported ${games.length} games (${poolGamesCount} pool games, ${playoffGamesCount} playoff games).`
        });

      } catch (error) {
        console.error("Error importing CSV:", error);
        setMessage({ type: 'error', text: 'An error occurred during import. Check console for details.' });
      }
    };

    reader.readAsText(file);
  };

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="w-6 h-6 text-[var(--falcons-green)] mr-2" />
          Admin Portal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="tournamentSelect" className="text-sm font-medium">Select Tournament</Label>
          <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Select a tournament..." />
            </SelectTrigger>
            <SelectContent>
              {tournaments.map((tournament: any) => (
                <SelectItem key={tournament.id} value={tournament.id}>
                  {tournament.name} ({tournament.startDate} - {tournament.endDate})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500 mt-1">
            Choose which tournament to import data into
          </p>
        </div>

        <div>
          <Label htmlFor="csvFile" className="text-sm font-medium">Import Tournament Data (CSV)</Label>
          <div className="mt-2 flex items-center space-x-4">
            <Input
              id="csvFile"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Button 
              onClick={handleImport} 
              disabled={!file || !selectedTournamentId || bulkImportMutation.isPending}
              className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
            >
              {bulkImportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Upload a CSV file with columns: Game, Date, Time, Location, Division, Pool, Home Team, Away Team
          </p>
        </div>

        {message.text && (
          <Alert className={`${
            message.type === 'success' ? 'border-green-500 bg-green-50' : 
            message.type === 'error' ? 'border-red-500 bg-red-50' : 
            'border-blue-500 bg-blue-50'
          }`}>
            <AlertDescription className={
              message.type === 'success' ? 'text-green-800' : 
              message.type === 'error' ? 'text-red-800' : 
              'text-blue-800'
            }>
              {message.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};