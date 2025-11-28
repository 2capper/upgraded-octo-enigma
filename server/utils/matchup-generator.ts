import type { Team } from "@shared/schema";

interface Matchup {
  homeTeamId: string;
  awayTeamId: string;
  poolId: string;
  isCrossPool: boolean;
}

export function generateGuaranteedMatchups(
  teams: Team[], 
  minGames: number = 3
): Matchup[] {
  const matchups: Matchup[] = [];
  const gamesPlayed: Record<string, number> = {};
  const playedAgainst: Record<string, Set<string>> = {};
  
  // Initialize
  teams.forEach(t => {
    gamesPlayed[t.id] = 0;
    playedAgainst[t.id] = new Set();
  });

  // Sort teams to prioritize those who need games the most
  // Secondary sort: "Willing to play extra" go last (as potential fillers)
  const sortedTeams = [...teams].sort((a, b) => {
    if (a.willingToPlayExtra !== b.willingToPlayExtra) return a.willingToPlayExtra ? 1 : -1;
    return 0;
  });

  // Safety break
  let attempts = 0;
  const maxAttempts = teams.length * minGames * 2;

  while (attempts < maxAttempts) {
    // 1. Identify "Needy" teams (Have not hit minGames)
    const needyTeams = sortedTeams.filter(t => gamesPlayed[t.id] < minGames);
    
    if (needyTeams.length === 0) break; // All constraints satisfied

    // Sort by most desperate
    needyTeams.sort((a, b) => gamesPlayed[a.id] - gamesPlayed[b.id]);
    const teamA = needyTeams[0];

    // 2. Find an Opponent
    let opponent: Team | null = null;

    // Preference 1: Another "Needy" team they haven't played yet (same pool first)
    for (const candidate of needyTeams) {
      if (candidate.id !== teamA.id && !playedAgainst[teamA.id].has(candidate.id)) {
        // Prefer internal pool play first
        if (candidate.poolId === teamA.poolId) {
          opponent = candidate;
          break;
        }
      }
    }

    // Preference 2: Any "Needy" team (Cross-pool)
    if (!opponent) {
      for (const candidate of needyTeams) {
        if (candidate.id !== teamA.id && !playedAgainst[teamA.id].has(candidate.id)) {
          opponent = candidate;
          break;
        }
      }
    }

    // Preference 3: A "Willing" team (even if they have enough games) - The "Bridge Game"
    if (!opponent) {
      const fillers = sortedTeams.filter(t => 
        t.id !== teamA.id && 
        t.willingToPlayExtra && 
        !playedAgainst[teamA.id].has(t.id)
      );
      // Pick the one with the FEWEST extra games so far
      fillers.sort((a, b) => gamesPlayed[a.id] - gamesPlayed[b.id]);
      if (fillers.length > 0) opponent = fillers[0];
    }

    // 3. Record Matchup
    if (opponent) {
      const isCrossPool = teamA.poolId !== opponent.poolId;
      
      matchups.push({
        homeTeamId: teamA.id,
        awayTeamId: opponent.id,
        poolId: teamA.poolId || "unassigned", // Assign to home team's pool for display
        isCrossPool
      });

      gamesPlayed[teamA.id]++;
      gamesPlayed[opponent.id]++;
      playedAgainst[teamA.id].add(opponent.id);
      playedAgainst[opponent.id].add(teamA.id);
    } else {
      // Dead end for this specific team (likely due to odd numbers and no volunteers)
      // Skip them to prevent infinite loop, manual intervention required
      gamesPlayed[teamA.id] = minGames + 1; 
    }

    attempts++;
  }

  return matchups;
}
