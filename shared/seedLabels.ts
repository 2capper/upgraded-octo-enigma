export function getSeedLabel(
  rank: number,
  seedingPattern: string | null,
  playoffFormat?: string | null
): string {
  if (!seedingPattern || seedingPattern === 'standard') {
    return `#${rank}`;
  }

  // For cross_pool_4: 4 pools (A, B, C, D) with top 2 from each
  if (seedingPattern === 'cross_pool_4') {
    const poolMap: Record<number, string> = {
      1: 'Pool A #1',
      2: 'Pool A #2',
      3: 'Pool B #1',
      4: 'Pool B #2',
      5: 'Pool C #1',
      6: 'Pool C #2',
      7: 'Pool D #1',
      8: 'Pool D #2',
    };
    return poolMap[rank] || `Seed #${rank}`;
  }

  // For cross_pool_3: 3 pools (A, B, C) with top 2 from each
  if (seedingPattern === 'cross_pool_3') {
    const poolMap: Record<number, string> = {
      1: 'Pool A #1',
      2: 'Pool A #2',
      3: 'Pool B #1',
      4: 'Pool B #2',
      5: 'Pool C #1',
      6: 'Pool C #2',
    };
    return poolMap[rank] || `Seed #${rank}`;
  }

  // For cross_pool_2: 2 pools (A, B) with interleaved seeding for cross-pool matchups
  if (seedingPattern === 'cross_pool_2') {
    // Explicit mappings based on seedingPatterns.ts matchup definitions
    const top4Map: Record<number, string> = {
      1: 'Pool A #1',
      2: 'Pool A #2',
      3: 'Pool B #1',
      4: 'Pool B #2',
    };
    const top6Map: Record<number, string> = {
      1: 'Pool A #1',  // A1 gets bye
      2: 'Pool A #2',  // A2 vs B3
      3: 'Pool A #3',  // A3 vs B2
      4: 'Pool B #2',  // B2 vs A3
      5: 'Pool B #1',  // B1 gets bye
      6: 'Pool B #3',  // B3 vs A2
    };
    const top8Map: Record<number, string> = {
      1: 'Pool A #1',  // A1 vs B2
      2: 'Pool A #2',  // A2 vs B3
      3: 'Pool B #1',  // B1 vs A4
      4: 'Pool B #2',  // B2 vs A1
      5: 'Pool A #3',  // A3 vs B4
      6: 'Pool A #4',  // A4 vs B1
      7: 'Pool B #3',  // B3 vs A2
      8: 'Pool B #4',  // B4 vs A3
    };
    
    // Select map based on playoff format
    if (playoffFormat === 'top_4') return top4Map[rank] || `Seed #${rank}`;
    if (playoffFormat === 'top_6') return top6Map[rank] || `Seed #${rank}`;
    if (playoffFormat === 'top_8') return top8Map[rank] || `Seed #${rank}`;
    
    // Require playoffFormat for cross_pool_2 to ensure correct labeling
    throw new Error(
      `cross_pool_2 seeding pattern requires playoffFormat parameter (top_4, top_6, or top_8) for rank ${rank}. ` +
      `Received: ${playoffFormat}`
    );
  }

  // Fallback for unknown seeding patterns
  return `#${rank}`;
}

export function getWinnerLabel(round: number, gameNumber: number, roundName?: string): string {
  const gameName = roundName || `R${round}G${gameNumber}`;
  
  if (roundName?.includes('Quarter')) {
    return `Winner of QF${gameNumber}`;
  }
  if (roundName?.includes('Semi')) {
    return `Winner of SF${gameNumber}`;
  }
  return `Winner of ${gameName}`;
}

export interface TeamSource {
  type: 'seed' | 'winner';
  rank?: number;
  round?: number;
  gameNumber?: number;
}

export function getTeamSourceLabel(
  source: TeamSource | null | undefined,
  seedingPattern: string | null,
  playoffFormat?: string | null,
  roundName?: string
): string {
  if (!source) return 'TBD';
  
  if (source.type === 'seed' && source.rank !== undefined) {
    return getSeedLabel(source.rank, seedingPattern, playoffFormat);
  }
  
  if (source.type === 'winner' && source.round !== undefined && source.gameNumber !== undefined) {
    return getWinnerLabel(source.round, source.gameNumber, roundName);
  }
  
  return 'TBD';
}
