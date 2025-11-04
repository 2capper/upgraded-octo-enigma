import { useState } from 'react';
import { UploadCloud, Loader2, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { db, appId } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, setDoc, addDoc } from 'firebase/firestore';

interface AdminPortalProps {
  tournamentId: string;
  onImportSuccess?: () => void;
}

export const AdminPortal = ({ tournamentId, onImportSuccess }: AdminPortalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | ''; text: string }>({ type: '', text: '' });

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

    setIsProcessing(true);
    setMessage({ type: 'info', text: 'Processing CSV file...' });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const csvData = event.target?.result as string;
        const lines = csvData.split('\n').filter(line => line.trim() !== '');
        
        if (lines.length < 2) {
          setMessage({ type: 'error', text: 'CSV file is empty or has no data rows.' });
          setIsProcessing(false);
          return;
        }

        const normalizeHeader = (h: string) => h.trim().replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const rawHeaders = lines[0].split(',').map(h => h.trim());

        const headerMapping: Record<string, string[]> = {
          matchNumber: ['game', 'match', 'matchno'],
          date: ['date'],
          time: ['time'],
          location: ['location', 'diamond', 'venue'],
          subVenue: ['subvenue'],
          division: ['division'],
          pool: ['pool'],
          homeTeam: ['hometeam', 'home', 'team1'],
          awayTeam: ['awayteam', 'visitor', 'away', 'team2']
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

        const requiredCanonicalHeaders = ['matchNumber', 'date', 'time', 'location', 'division', 'pool', 'homeTeam', 'awayTeam'];
        const missingHeaders = requiredCanonicalHeaders.filter(h => !foundHeaders.has(h));

        if (missingHeaders.length > 0) {
          setMessage({ 
            type: 'error', 
            text: `CSV is missing required columns: ${missingHeaders.join(', ')}. Found headers: ${rawHeaders.join(', ')}` 
          });
          setIsProcessing(false);
          return;
        }

        const data = lines.slice(1).map(line => {
          const values = line.split(',');
          const rowData: Record<string, string> = {};
          for (const key in columnIndexMap) {
            rowData[key] = values[columnIndexMap[key]]?.trim().replace(/^"|"$/g, '') || '';
          }
          return rowData;
        });

        const validData = data.filter(row => row.division && row.pool && row.homeTeam && row.awayTeam);

        if (validData.length === 0) {
          setMessage({ 
            type: 'error', 
            text: `Found ${data.length} data rows, but 0 were valid. Please check the data in your CSV file.` 
          });
          setIsProcessing(false);
          return;
        }

        const tournamentPath = `/artifacts/${appId}/public/data/tournaments/${tournamentId}`;

        // Clear existing data
        const deleteBatch = writeBatch(db);
        const collectionsToClear = ['ageDivisions', 'pools', 'teams', 'games'];
        
        for (const coll of collectionsToClear) {
          const snapshot = await getDocs(collection(db, `${tournamentPath}/${coll}`));
          snapshot.docs.forEach(d => deleteBatch.delete(d.ref));
        }
        await deleteBatch.commit();

        // Add new data
        const addBatch = writeBatch(db);
        const divisionsMap = new Map<string, string>();
        const poolsMap = new Map<string, string>();
        const teamsMap = new Map<string, string>();

        // First pass: build structure
        for (const row of validData) {
          let divisionId = divisionsMap.get(row.division);
          if (!divisionId) {
            divisionId = `div_${row.division.replace(/\s+/g, '-')}`;
            divisionsMap.set(row.division, divisionId);
            const divRef = doc(db, `${tournamentPath}/ageDivisions`, divisionId);
            addBatch.set(divRef, { name: row.division });
          }

          let poolName = row.pool.replace(row.division, '').trim();
          if (!poolName) poolName = row.pool;
          let poolKey = `${divisionId}-${poolName}`;
          let poolId = poolsMap.get(poolKey);
          if (!poolId) {
            poolId = `pool_${poolKey.replace(/\s+/g, '-')}`;
            poolsMap.set(poolKey, poolId);
            const poolRef = doc(db, `${tournamentPath}/pools`, poolId);
            addBatch.set(poolRef, { name: poolName, ageDivisionId: divisionId });
          }

          const homeTeamKey = `${divisionId}-${row.homeTeam}`;
          if (!teamsMap.has(homeTeamKey)) {
            const newTeamRef = doc(collection(db, `${tournamentPath}/teams`));
            teamsMap.set(homeTeamKey, newTeamRef.id);
            addBatch.set(newTeamRef, { name: row.homeTeam, poolId: poolId });
          }

          const awayTeamKey = `${divisionId}-${row.awayTeam}`;
          if (!teamsMap.has(awayTeamKey)) {
            const newTeamRef = doc(collection(db, `${tournamentPath}/teams`));
            teamsMap.set(awayTeamKey, newTeamRef.id);
            addBatch.set(newTeamRef, { name: row.awayTeam, poolId: poolId });
          }
        }

        // Second pass: write games
        for (const row of validData) {
          const divisionId = divisionsMap.get(row.division);
          const poolName = row.pool.replace(row.division, '').trim();
          const poolKey = `${divisionId}-${poolName}`;
          const poolId = poolsMap.get(poolKey);
          const homeTeamId = teamsMap.get(`${divisionId}-${row.homeTeam}`);
          const awayTeamId = teamsMap.get(`${divisionId}-${row.awayTeam}`);

          if (!homeTeamId || !awayTeamId || !poolId) continue;

          const gameId = `g${row.matchNumber}`;
          const gameRef = doc(db, `${tournamentPath}/games`, gameId);
          addBatch.set(gameRef, {
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
            time: adjustTimeToET(row.time),
            location: row.location,
            subVenue: row.subVenue || ''
          });
        }

        await addBatch.commit();
        setMessage({ type: 'success', text: `Successfully imported ${validData.length} games!` });
        setFile(null);
        if (onImportSuccess) onImportSuccess();

      } catch (error) {
        console.error("Error importing CSV:", error);
        setMessage({ type: 'error', text: 'An error occurred during import. Check console for details.' });
      } finally {
        setIsProcessing(false);
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
              disabled={!file || isProcessing}
              className="bg-[var(--forest-green)] text-[var(--yellow)] hover:bg-[var(--yellow)] hover:text-[var(--forest-green)] transition-colors"
            >
              {isProcessing ? (
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
