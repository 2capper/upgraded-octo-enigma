import type { Team, Diamond, Game, TournamentDiamondAllocation } from "@shared/schema";

interface ValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export const validateGameSlot = (
  homeTeam: Team | undefined,
  awayTeam: Team | undefined,
  diamond: Diamond | undefined,
  date: string,
  time: string,
  durationMinutes: number = 90,
  existingGamesOnDiamond: Game[],
  allocations: TournamentDiamondAllocation[] = [],
  options?: {
    skipGameId?: string;
    teamDivisionId?: string;
  }
): ValidationResult => {
  const result: ValidationResult = { valid: true, warnings: [], errors: [] };

  const parseMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  const gameStart = parseMinutes(time);
  const gameEnd = gameStart + durationMinutes;

  if (diamond) {
    if (diamond.status === 'closed') {
      result.errors.push(`Diamond ${diamond.name} is marked as CLOSED globally.`);
      result.valid = false;
    }
  }

  if (allocations.length > 0 && diamond) {
    const matchingAllocation = allocations.find(a => 
      a.diamondId === diamond.id && 
      a.date === date &&
      parseMinutes(a.startTime) <= gameStart &&
      parseMinutes(a.endTime) >= gameEnd
    );

    if (!matchingAllocation) {
      result.errors.push(`This tournament does not have a reserved time block for ${diamond.name} at ${time}.`);
      result.valid = false;
    } else {
      if (matchingAllocation.divisionId && options?.teamDivisionId) {
        if (matchingAllocation.divisionId !== options.teamDivisionId) {
          result.errors.push(`This time block is reserved for a different division.`);
          result.valid = false;
        }
      }
    }
  }

  const hasOverlap = existingGamesOnDiamond.some(g => {
    if (!g.time || g.date !== date) return false;
    if (options?.skipGameId && g.id === options.skipGameId) return false;
    
    const existingStart = parseMinutes(g.time);
    const existingEnd = existingStart + (g.durationMinutes || 90);
    
    return (gameStart < existingEnd && gameEnd > existingStart);
  });

  if (hasOverlap) {
    result.errors.push(`Conflict: Another game is already scheduled on this diamond.`);
    result.valid = false;
  }

  const checkRequests = (team: Team) => {
    if (!team.schedulingRequests) return;
    const req = team.schedulingRequests.toLowerCase();
    
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    if (req.includes(`no ${dayName}`)) {
      result.warnings.push(`${team.name}: Requested to avoid ${dayName}s`);
    }
    if (req.includes("no morning") && gameStart < 720) {
      result.warnings.push(`${team.name}: Requested to avoid mornings`);
    }
    if (req.includes("no afternoon") && gameStart >= 720 && gameStart < 1020) {
      result.warnings.push(`${team.name}: Requested to avoid afternoons`);
    }
    if (req.includes("no evening") && gameStart >= 1020) {
      result.warnings.push(`${team.name}: Requested to avoid evenings`);
    }
  };

  if (homeTeam) checkRequests(homeTeam);
  if (awayTeam) checkRequests(awayTeam);

  return result;
};

export const validateBulkGames = (
  games: Array<{
    homeTeam?: Team;
    awayTeam?: Team;
    diamond?: Diamond;
    date: string;
    time: string;
    durationMinutes?: number;
    teamDivisionId?: string;
  }>,
  allGamesOnDiamonds: Map<string, Game[]>,
  allocations: TournamentDiamondAllocation[] = []
): { valid: boolean; results: Array<ValidationResult & { index: number }> } => {
  const results: Array<ValidationResult & { index: number }> = [];
  let allValid = true;

  games.forEach((game, index) => {
    const diamondGames = game.diamond 
      ? allGamesOnDiamonds.get(game.diamond.id) || []
      : [];

    const result = validateGameSlot(
      game.homeTeam,
      game.awayTeam,
      game.diamond,
      game.date,
      game.time,
      game.durationMinutes || 90,
      diamondGames,
      allocations,
      { teamDivisionId: game.teamDivisionId }
    );

    if (!result.valid) {
      allValid = false;
    }

    results.push({ ...result, index });
  });

  return { valid: allValid, results };
};
