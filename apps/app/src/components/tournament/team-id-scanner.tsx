import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Download } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface DiscoveredTeam {
  id: string;
  name: string;
  division: string;
  city?: string;
  classification?: string;
  url?: string;
}

export function TeamIdScanner() {
  const { toast } = useToast();
  const [startId, setStartId] = useState("500000");
  const [endId, setEndId] = useState("501000");
  const [batchSize, setBatchSize] = useState("100");
  const [scanning, setScanning] = useState(false);
  const [cobaScanning, setCobaScanning] = useState(false);
  const [discoveredTeams, setDiscoveredTeams] = useState<DiscoveredTeam[]>([]);
  const [currentRange, setCurrentRange] = useState("");
  const [progress, setProgress] = useState(0);

  const handleScan = async () => {
    setScanning(true);
    setDiscoveredTeams([]);
    setProgress(0);

    const start = parseInt(startId);
    const end = parseInt(endId);
    const batch = parseInt(batchSize);
    const totalBatches = Math.ceil((end - start) / batch);
    let completedBatches = 0;

    try {
      for (let current = start; current <= end; current += batch) {
        setCurrentRange(`${current}-${Math.min(current + batch - 1, end)}`);
        
        const response = await apiRequest('POST', '/api/roster/scan-range', {
          startId: current,
          endId: Math.min(current + batch - 1, end),
          batchSize: batch
        });

        const result = await response.json();
        if (result.success) {
          setDiscoveredTeams(prev => [...prev, ...result.discovered]);
        }

        completedBatches++;
        setProgress((completedBatches / totalBatches) * 100);

        // Add a small delay between batches to avoid overwhelming the server
        if (current + batch <= end) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      toast({
        title: "OBA Range Scan Complete",
        description: `Found ${discoveredTeams.length} teams`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan team IDs",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
      setCurrentRange("");
    }
  };

  const handleCobaScan = async () => {
    setCobaScanning(true);
    setProgress(0);
    setCurrentRange("COBA Teams");

    try {
      const response = await apiRequest('POST', '/api/roster/scan-coba');
      const result = await response.json();

      if (result.success) {
        setProgress(100);
        toast({
          title: "COBA Scan Complete",
          description: `Successfully processed ${result.teams_found} COBA teams, ${result.teams_saved} saved to database`,
        });
        
        // Optionally add the teams to the discovered teams list if available
        if (result.teams) {
          setDiscoveredTeams(prev => [...prev, ...result.teams]);
        }
      } else {
        throw new Error(result.error || "Failed to scan COBA teams");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to scan COBA teams",
        variant: "destructive",
      });
    } finally {
      setCobaScanning(false);
      setCurrentRange("");
      setProgress(0);
    }
  };

  const exportResults = () => {
    const csv = [
      "Team ID,Team Name,Division,City,Classification,OBA URL",
      ...discoveredTeams.map(team => 
        `${team.id},"${team.name}",${team.division},${team.city || ''},${team.classification || ''},${team.url || ''}`
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oba-teams-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const divisionColors: Record<string, string> = {
    "11U": "bg-blue-100 text-blue-800",
    "13U": "bg-green-100 text-green-800",
    "15U": "bg-purple-100 text-purple-800",
    "18U": "bg-orange-100 text-orange-800",
    "12U": "bg-pink-100 text-pink-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Discovery Scanner</CardTitle>
        <CardDescription>
          Discover participating teams across Ontario from multiple sources. Use OBA Range Scan to probe team IDs (500000-520000) or COBA Teams Scan to import all Central Ontario Baseball Association teams. This builds a comprehensive database for accurate roster imports.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="startId">Start ID</Label>
            <Input
              id="startId"
              type="number"
              value={startId}
              onChange={(e) => setStartId(e.target.value)}
              disabled={scanning}
              min="500000"
              max="520000"
            />
          </div>
          <div>
            <Label htmlFor="endId">End ID</Label>
            <Input
              id="endId"
              type="number"
              value={endId}
              onChange={(e) => setEndId(e.target.value)}
              disabled={scanning}
              min="500000"
              max="520000"
            />
          </div>
          <div>
            <Label htmlFor="batchSize">Batch Size</Label>
            <Input
              id="batchSize"
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              disabled={scanning}
              min="10"
              max="1000"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <Button
            onClick={handleScan}
            disabled={scanning || cobaScanning}
            className="flex items-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning {currentRange}...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Start OBA Range Scan
              </>
            )}
          </Button>

          <Button
            onClick={handleCobaScan}
            disabled={scanning || cobaScanning}
            variant="secondary"
            className="flex items-center gap-2"
          >
            {cobaScanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning COBA Teams...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Scan COBA Teams
              </>
            )}
          </Button>

          {discoveredTeams.length > 0 && (
            <Button
              variant="outline"
              onClick={exportResults}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>

        {scanning && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-gray-600">
              Scanning range: {currentRange}
            </p>
          </div>
        )}

        {discoveredTeams.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-semibold">
              Discovered Teams ({discoveredTeams.length})
            </h3>
            <div className="max-h-96 overflow-y-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team ID</TableHead>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Division</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discoveredTeams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-mono">{team.id}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={team.name}>
                        {team.name}
                      </TableCell>
                      <TableCell>
                        <Badge className={divisionColors[team.division] || "bg-gray-100 text-gray-800"}>
                          {team.division}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {team.city || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {team.url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(team.url, '_blank')}
                            className="text-xs"
                          >
                            View Roster
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}