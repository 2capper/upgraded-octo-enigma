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
  const [registrationsFile, setRegistrationsFile] = useState<File | null>(null);
  const [matchesFile, setMatchesFile] = useState<File | null>(null);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(tournamentId);
  const [registrationsMessage, setRegistrationsMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });
  const [matchesMessage, setMatchesMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });
  
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

  // Fetch selected tournament details for playoff seeding
  const { data: selectedTournament } = useQuery({
    queryKey: ['/api/tournaments', selectedTournamentId],
    queryFn: async () => {
      const response = await fetch(`/api/tournaments/${selectedTournamentId}`);
      if (!response.ok) throw new Error('Failed to fetch tournament');
      return response.json();
    },
    enabled: !!selectedTournamentId,
  });

  const registrationsImportMutation = useMutation({
    mutationFn: async (importData: any) => {
      const response = await fetch(`/api/tournaments/${selectedTournamentId}/import-registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importData)
      });
      if (!response.ok) throw new Error('Failed to import registrations');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registrations Import Successful",
        description: `Successfully imported ${data.teams.length} teams from registrations CSV.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', selectedTournamentId] });
      setRegistrationsFile(null);
      if (onImportSuccess) onImportSuccess();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import registrations data. Please check your CSV file format.",
        variant: "destructive",
      });
    }
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
        title: "Matches Import Successful",
        description: `Tournament schedule has been successfully imported to ${tournaments.find((t: any) => t.id === selectedTournamentId)?.name || selectedTournamentId}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments', selectedTournamentId] });
      queryClient.invalidateQueries({ queryKey: ['/api/tournaments'] });
      setMatchesFile(null);
      if (onImportSuccess) onImportSuccess();
    },
    onError: (error) => {
      toast({
        title: "Import Failed",
        description: "Failed to import matches data. Please check your CSV file format.",
        variant: "destructive",
      });
    }
  });

  const handleRegistrationsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRegistrationsMessage({ type: '', text: '' });
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setRegistrationsFile(selectedFile);
    }
  };

  const handleMatchesFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMatchesMessage({ type: '', text: '' });
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setMatchesFile(selectedFile);
    }
  };

  const validateTeamNumber = (value: string): string | null => {
    if (!value || value.trim() === '') return null;
    const cleaned = value.trim().replace(/\D/g, '');
    if (cleaned.length === 6 && /^\d{6}$/.test(cleaned)) {
      return cleaned;
    }
    return null;
  };

  const formatPhoneToE164 = (value: string): string | null => {
    if (!value || value.trim() === '') return null;
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }
    return null;
  };

  const handleRegistrationsImport = async () => {
    if (!registrationsFile) {
      setRegistrationsMessage({ type: 'error', text: 'Please select a registrations CSV file to import.' });
      return;
    }

    setRegistrationsMessage({ type: 'info', text: 'Processing registrations CSV...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          setRegistrationsMessage({ type: 'error', text: 'CSV file is empty or has no data rows.' });
          return;
        }

        // Parse CSV (handle quoted values)
        const parseCSVRow = (row: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;
          
          for (let i = 0; i < row.length; i++) {
            const char = row[i];
            const nextChar = row[i + 1];
            
            if (char === '"' && (i === 0 || row[i - 1] === ',')) {
              inQuotes = true;
            } else if (char === '"' && nextChar === ',' && inQuotes) {
              inQuotes = false;
            } else if (char === '"' && i === row.length - 1 && inQuotes) {
              inQuotes = false;
            } else if (char === ',' && !inQuotes) {
              result.push(current);
              current = '';
            } else {
              current += char;
            }
          }
          
          if (current || row.endsWith(',')) {
            result.push(current);
          }
          
          return result;
        };

        const headers = parseCSVRow(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''));
        const data = lines.slice(1).map(line => {
          const values = parseCSVRow(line);
          const row: Record<string, string> = {};
          headers.forEach((header, index) => {
            row[header] = values[index]?.trim().replace(/^"|"$/g, '') || '';
          });
          return row;
        });

        // Extract team data from registrations CSV
        const teams = data.map(row => {
          const teamNumber = validateTeamNumber(row['What is your Team Number (This number will be provided by your National or State/Provincial Governing Body)?']) || null;
          return {
            name: row['Team Name'],
            coachFirstName: row['Team Contact First Name'],
            coachLastName: row['Team Contact Last Name'],
            coachEmail: row['Team Contact Email'],
            phone: formatPhoneToE164(row['Team ContactPhone']) || null,
            division: row['Division'],
            registrationStatus: row['Registration Status'],
            paymentStatus: row['Total Payment Amount'] && parseFloat(row['Total Payment Amount'].replace(/[^0-9.]/g, '')) > 0 ? 'paid' : 'unpaid',
            teamNumber: teamNumber,
            rosterLink: teamNumber ? `https://www.playoba.ca/stats#/2111/team/${teamNumber}/roster` : null,
          };
        }).filter(team => team.name && team.division);

        console.log('Registrations import:', { teams: teams.length });

        registrationsImportMutation.mutate({ teams });

        setRegistrationsMessage({
          type: 'success',
          text: `Successfully parsed ${teams.length} teams from registrations CSV.`
        });

      } catch (error) {
        console.error("Error importing registrations CSV:", error);
        setRegistrationsMessage({ type: 'error', text: 'An error occurred during import. Check console for details.' });
      }
    };

    reader.readAsText(registrationsFile);
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

  // Generate seed label matchups for playoff games based on tournament format
  const generateSeedLabels = (playoffFormat: string | null, seedingPattern: string | null, numberOfPools: number): Map<number, { home: string; away: string }> => {
    const matchups = new Map<number, { home: string; away: string }>();
    
    if (!playoffFormat || !seedingPattern) return matchups;
    
    // For cross_pool_4 format with top_8
    if (seedingPattern === 'cross_pool_4' && playoffFormat === 'top_8') {
      // Quarterfinals (games 1-4): A1 vs C2, A2 vs C1, B1 vs D2, B2 vs D1
      matchups.set(1, { home: 'A1', away: 'C2' });
      matchups.set(2, { home: 'A2', away: 'C1' });
      matchups.set(3, { home: 'B1', away: 'D2' });
      matchups.set(4, { home: 'B2', away: 'D1' });
      // Semifinals (games 5-6): Winner matchups (will show as "Winner of Game X")
      matchups.set(5, { home: 'Winner of Game 1', away: 'Winner of Game 3' });
      matchups.set(6, { home: 'Winner of Game 2', away: 'Winner of Game 4' });
      // Finals (game 7)
      matchups.set(7, { home: 'Winner of Game 5', away: 'Winner of Game 6' });
    }
    // For cross_pool_3 format with top_6
    else if (seedingPattern === 'cross_pool_3' && playoffFormat === 'top_6') {
      matchups.set(1, { home: 'A1', away: 'C2' });
      matchups.set(2, { home: 'B1', away: 'A2' });
      matchups.set(3, { home: 'C1', away: 'B2' });
      matchups.set(4, { home: 'Winner of Game 1', away: 'Winner of Game 2' });
      matchups.set(5, { home: 'Winner of Game 3', away: 'Winner of Game 4' });
    }
    // For cross_pool_2 format with top_4
    else if (seedingPattern === 'cross_pool_2' && playoffFormat === 'top_4') {
      matchups.set(1, { home: 'A1', away: 'B2' });
      matchups.set(2, { home: 'B1', away: 'A2' });
      matchups.set(3, { home: 'Winner of Game 1', away: 'Winner of Game 2' });
    }
    // For standard seeding patterns
    else if (seedingPattern === 'standard') {
      if (playoffFormat === 'top_8') {
        matchups.set(1, { home: '1', away: '8' });
        matchups.set(2, { home: '4', away: '5' });
        matchups.set(3, { home: '2', away: '7' });
        matchups.set(4, { home: '3', away: '6' });
        matchups.set(5, { home: 'Winner of Game 1', away: 'Winner of Game 2' });
        matchups.set(6, { home: 'Winner of Game 3', away: 'Winner of Game 4' });
        matchups.set(7, { home: 'Winner of Game 5', away: 'Winner of Game 6' });
      } else if (playoffFormat === 'top_4') {
        matchups.set(1, { home: '1', away: '4' });
        matchups.set(2, { home: '2', away: '3' });
        matchups.set(3, { home: 'Winner of Game 1', away: 'Winner of Game 2' });
      }
    }
    
    return matchups;
  };

  const handleMatchesImport = async () => {
    if (!matchesFile) {
      setMatchesMessage({ type: 'error', text: 'Please select a matches CSV file to import.' });
      return;
    }

    setMatchesMessage({ type: 'info', text: 'Processing matches CSV file...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          setMatchesMessage({ type: 'error', text: 'CSV file is empty or has no data rows.' });
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
          setMatchesMessage({ 
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

        // Validate data - playoff games can have blank teams (we'll populate with seed labels)
        const validData = data.filter(row => {
          // Must have division
          if (!row.division) return false;
          
          // Playoff games identified by matchType - teams can be blank
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff';
          
          // Pool games must have pool and actual team names
          if (!isPlayoffGame) {
            return row.pool && row.homeTeam && row.awayTeam;
          }
          
          // Playoff games are valid even without team names (we'll add seed labels)
          return true;
        });

        if (validData.length === 0) {
          setMatchesMessage({ 
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

        // Generate seed labels for playoff games based on tournament format
        const seedLabelMatchups = selectedTournament 
          ? generateSeedLabels(
              selectedTournament.playoffFormat, 
              selectedTournament.seedingPattern,
              selectedTournament.numberOfPools || 4
            )
          : new Map();

        // Collect and sort playoff games to assign sequential matchup numbers
        const playoffGames = validData
          .filter(row => row.matchType?.toLowerCase() === 'playoff')
          .sort((a, b) => parseInt(a.matchNumber) - parseInt(b.matchNumber));

        // Map playoff game CSV rows to seed label matchups
        const playoffGameToMatchup = new Map();
        playoffGames.forEach((row, index) => {
          const matchup = seedLabelMatchups.get(index + 1);
          if (matchup) {
            playoffGameToMatchup.set(row.matchNumber, matchup);
          }
        });

        // Build structure with tournament-specific IDs
        for (const row of validData) {
          let divisionId = divisionsMap.get(row.division);
          if (!divisionId) {
            divisionId = `${selectedTournamentId}_div_${row.division.replace(/\s+/g, '-')}`;
            divisionsMap.set(row.division, divisionId);
            ageDivisions.push({ id: divisionId, name: row.division });
          }

          // Check if this is a playoff game (identified by Match Type column)
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff';

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

          // Create teams - use seed labels for playoff games, actual names for pool play
          const matchup = playoffGameToMatchup.get(row.matchNumber);
          
          // Determine actual team names to use (seed labels for playoffs, CSV names for pool play)
          const homeTeamName = isPlayoffGame && matchup ? matchup.home : row.homeTeam;
          const awayTeamName = isPlayoffGame && matchup ? matchup.away : row.awayTeam;
          
          // Use division name (not divisionId) to match Registrations import format
          const homeTeamKey = `${row.division}-${homeTeamName}`;
          if (!teamsMap.has(homeTeamKey)) {
            const teamId = `${selectedTournamentId}_team_${homeTeamKey.replace(/\s+/g, '-')}`;
            teamsMap.set(homeTeamKey, teamId);
            // For playoff teams, assign to playoff pool
            const teamPoolId = isPlayoffGame
              ? poolsMap.get(`${divisionId}-Playoff`) || poolId 
              : poolId;
            teams.push({ id: teamId, name: homeTeamName, division: row.division, poolId: teamPoolId });
          }

          const awayTeamKey = `${row.division}-${awayTeamName}`;
          if (!teamsMap.has(awayTeamKey)) {
            const teamId = `${selectedTournamentId}_team_${awayTeamKey.replace(/\s+/g, '-')}`;
            teamsMap.set(awayTeamKey, teamId);
            // For playoff teams, assign to playoff pool
            const teamPoolId = isPlayoffGame
              ? poolsMap.get(`${divisionId}-Playoff`) || poolId 
              : poolId;
            teams.push({ id: teamId, name: awayTeamName, division: row.division, poolId: teamPoolId });
          }
        }

        // Create games
        for (const row of validData) {
          const divisionId = divisionsMap.get(row.division);
          
          // Check if this is a playoff game (identified by Match Type column)
          const isPlayoffGame = row.matchType?.toLowerCase() === 'playoff';

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

          // Get team IDs - use seed labels for playoff games, actual names for pool play
          const matchup = playoffGameToMatchup.get(row.matchNumber);
          const homeTeamName = isPlayoffGame && matchup ? matchup.home : row.homeTeam;
          const awayTeamName = isPlayoffGame && matchup ? matchup.away : row.awayTeam;
          
          // Use division name (not divisionId) to match team key format
          const homeTeamId = teamsMap.get(`${row.division}-${homeTeamName}`);
          const awayTeamId = teamsMap.get(`${row.division}-${awayTeamName}`);

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
            time: adjustTimeToET(row.time), // Convert CST to EST (add 1 hour)
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

        setMatchesMessage({ 
          type: 'success', 
          text: `Successfully imported ${games.length} games (${poolGamesCount} pool games, ${playoffGamesCount} playoff games).`
        });

      } catch (error) {
        console.error("Error importing CSV:", error);
        setMatchesMessage({ type: 'error', text: 'An error occurred during import. Check console for details.' });
      }
    };

    reader.readAsText(matchesFile);
  };

  return (
    <Card className="bg-white border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Settings className="w-6 h-6 text-[var(--falcons-green)] mr-2" />
          CSV Data Import
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="tournamentSelect" className="text-sm font-medium">Select Tournament</Label>
          <Select value={selectedTournamentId} onValueChange={setSelectedTournamentId}>
            <SelectTrigger className="mt-2" data-testid="select-tournament">
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

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 bg-white text-gray-500">Step 1: Import Team Registrations</span>
          </div>
        </div>

        <div>
          <Label htmlFor="registrationsFile" className="text-sm font-medium">Registrations CSV</Label>
          <div className="mt-2 flex items-center space-x-4">
            <Input
              id="registrationsFile"
              type="file"
              accept=".csv"
              onChange={handleRegistrationsFileChange}
              className="flex-1"
              data-testid="input-registrations-csv"
            />
            <Button 
              onClick={handleRegistrationsImport} 
              disabled={!registrationsFile || !selectedTournamentId || registrationsImportMutation.isPending}
              className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
              data-testid="button-import-registrations"
            >
              {registrationsImportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Import Teams
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Upload the registrations CSV with team names, coach contact info, division, and team numbers
          </p>
        </div>

        {registrationsMessage.text && (
          <Alert className={`${
            registrationsMessage.type === 'success' ? 'border-green-500 bg-green-50' : 
            registrationsMessage.type === 'error' ? 'border-red-500 bg-red-50' : 
            'border-blue-500 bg-blue-50'
          }`}>
            <AlertDescription className={
              registrationsMessage.type === 'success' ? 'text-green-800' : 
              registrationsMessage.type === 'error' ? 'text-red-800' : 
              'text-blue-800'
            }>
              {registrationsMessage.text}
            </AlertDescription>
          </Alert>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 bg-white text-gray-500">Step 2: Import Game Schedule</span>
          </div>
        </div>

        <div>
          <Label htmlFor="matchesFile" className="text-sm font-medium">Matches CSV</Label>
          <div className="mt-2 flex items-center space-x-4">
            <Input
              id="matchesFile"
              type="file"
              accept=".csv"
              onChange={handleMatchesFileChange}
              className="flex-1"
              data-testid="input-matches-csv"
            />
            <Button 
              onClick={handleMatchesImport} 
              disabled={!matchesFile || !selectedTournamentId || bulkImportMutation.isPending}
              className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
              data-testid="button-import-matches"
            >
              {bulkImportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4 mr-2" />
                  Import Schedule
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Upload the matches CSV with game schedule, locations, and teams (CST times will be converted to EST)
          </p>
        </div>

        {matchesMessage.text && (
          <Alert className={`${
            matchesMessage.type === 'success' ? 'border-green-500 bg-green-50' : 
            matchesMessage.type === 'error' ? 'border-red-500 bg-red-50' : 
            'border-blue-500 bg-blue-50'
          }`}>
            <AlertDescription className={
              matchesMessage.type === 'success' ? 'text-green-800' : 
              matchesMessage.type === 'error' ? 'text-red-800' : 
              'text-blue-800'
            }>
              {matchesMessage.text}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};