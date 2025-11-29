import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trophy, AlertCircle } from 'lucide-react';
import { PlayoffSlotManager } from './PlayoffSlotManager';
import { PlayoffBracketGenerator } from './playoff-bracket-generator';
import type { Tournament, AgeDivision, Diamond } from '@shared/schema';

interface PlayoffDashboardTabProps {
  tournament: Tournament;
  ageDivisions: AgeDivision[];
  diamonds: Diamond[];
}

export function PlayoffDashboardTab({ tournament, ageDivisions, diamonds }: PlayoffDashboardTabProps) {
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('');

  const selectedDivision = ageDivisions.find(d => d.id === selectedDivisionId);

  if (ageDivisions.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No age divisions found for this tournament.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5" />
            Playoff Management
          </CardTitle>
          <CardDescription>
            Manage playoff schedules and brackets for this tournament. Select an age division to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="division-selector">Select Age Division</Label>
            <Select
              value={selectedDivisionId}
              onValueChange={setSelectedDivisionId}
            >
              <SelectTrigger id="division-selector" data-testid="select-age-division">
                <SelectValue placeholder="Choose a division..." />
              </SelectTrigger>
              <SelectContent>
                {ageDivisions.map(division => (
                  <SelectItem key={division.id} value={division.id}>
                    {division.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedDivision && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-700 my-8" />
          
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground dark:text-gray-100">
                Step 1: Schedule Playoff Games (When & Where)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Pre-schedule playoff games by assigning dates, times, and diamonds to bracket slots.
                Teams will be assigned when you generate the bracket.
              </p>
              <PlayoffSlotManager
                tournament={tournament}
                ageDivision={selectedDivision}
                diamonds={diamonds}
              />
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700" />

            <div>
              <h3 className="text-lg font-semibold mb-2 text-foreground dark:text-gray-100">
                Step 2: Generate Playoff Bracket (Who Plays)
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Generate the playoff bracket based on pool standings. Pre-scheduled times and locations will be preserved.
              </p>
              <PlayoffBracketGenerator 
                tournamentId={tournament.id} 
                divisionId={selectedDivision.id}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
