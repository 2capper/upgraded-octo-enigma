export type SeedingPattern = 
  | 'standard'
  | 'cross_pool_4'
  | 'cross_pool_3'
  | 'cross_pool_2'
  | 'custom';

export interface SeedingPatternOption {
  value: SeedingPattern;
  label: string;
  description: string;
  requiredPools?: number; // If pattern requires specific pool count
  compatibleFormats: string[]; // Which playoff formats this pattern works with
}

export const seedingPatternOptions: SeedingPatternOption[] = [
  {
    value: 'standard',
    label: 'Standard Bracket',
    description: 'Traditional seeding: 1v8, 2v7, 3v6, 4v5 (or similar for other sizes)',
    compatibleFormats: ['top_4', 'top_6', 'top_8', 'single_elim_4', 'single_elim_6', 'single_elim_8', 'single_elim_12', 'single_elim_16'],
  },
  {
    value: 'cross_pool_4',
    label: 'Cross-Pool (Four Pools)',
    description: 'Cross-pool matchups: A1 vs C2, B1 vs D2, A2 vs C1, B2 vs D1',
    requiredPools: 4,
    compatibleFormats: ['top_4', 'top_6', 'top_8'],
  },
  {
    value: 'cross_pool_3',
    label: 'Cross-Pool (Three Pools)',
    description: 'Cross-pool matchups: A1 vs C2, B1 vs A2, C1 vs B2, etc.',
    requiredPools: 3,
    compatibleFormats: ['top_4', 'top_6', 'top_8'],
  },
  {
    value: 'cross_pool_2',
    label: 'Cross-Pool (Two Pools)',
    description: 'Cross-pool matchups: A1 vs B2, B1 vs A2, etc.',
    requiredPools: 2,
    compatibleFormats: ['top_4', 'top_6', 'top_8'],
  },
];

export interface SeededTeam {
  seed: number;
  teamId: string;
  teamName: string;
  poolName?: string;
  poolRank?: number; // 1st, 2nd, etc. in their pool
}

export interface SeedingMatchup {
  team1Seed: number;
  team2Seed: number;
  team1PoolInfo?: { poolName: string; rank: number };
  team2PoolInfo?: { poolName: string; rank: number };
  description?: string; // e.g., "A1 vs C2"
}

/**
 * Get available seeding patterns based on playoff format and pool count
 */
export function getAvailableSeedingPatterns(
  playoffFormat: string | null | undefined,
  numberOfPools: number
): SeedingPatternOption[] {
  if (!playoffFormat) return [];

  return seedingPatternOptions.filter(pattern => {
    // Check if pattern is compatible with this playoff format
    if (!pattern.compatibleFormats.includes(playoffFormat)) {
      return false;
    }

    // Check if pattern requires specific pool count
    if (pattern.requiredPools && pattern.requiredPools !== numberOfPools) {
      return false;
    }

    return true;
  });
}

/**
 * Get default seeding pattern for a playoff format
 */
export function getDefaultSeedingPattern(
  playoffFormat: string | null | undefined,
  numberOfPools: number
): SeedingPattern {
  const available = getAvailableSeedingPatterns(playoffFormat, numberOfPools);
  
  // For pool play tournaments, prefer cross-pool patterns when available
  if (playoffFormat?.startsWith('top_')) {
    // Try to find a matching cross-pool pattern
    const crossPoolPattern = available.find(p => 
      p.value === `cross_pool_${numberOfPools}` as SeedingPattern
    );
    if (crossPoolPattern) {
      return crossPoolPattern.value;
    }
  }

  // Default to standard
  const standardPattern = available.find(p => p.value === 'standard');
  return standardPattern?.value || 'standard';
}

/**
 * Generate matchups for Top 8 based on seeding pattern
 */
export function generateTop8Matchups(
  seedingPattern: SeedingPattern,
  seededTeams: SeededTeam[]
): SeedingMatchup[] {
  if (seededTeams.length !== 8) {
    throw new Error('generateTop8Matchups requires exactly 8 seeded teams');
  }

  switch (seedingPattern) {
    case 'standard':
      return [
        { team1Seed: 1, team2Seed: 8, description: '1 vs 8' },
        { team1Seed: 4, team2Seed: 5, description: '4 vs 5' },
        { team1Seed: 2, team2Seed: 7, description: '2 vs 7' },
        { team1Seed: 3, team2Seed: 6, description: '3 vs 6' },
      ];

    case 'cross_pool_4':
      // Cross-pool matchups: A1 vs C2, B1 vs D2, C1 vs A2, D1 vs B2
      // Seeds ordered: A1, B1, C1, D1, A2, C2, D2, B2
      // Mapping: 1=A1, 2=B1, 3=C1, 4=D1, 5=A2, 6=C2, 7=D2, 8=B2
      return [
        { 
          team1Seed: 1, 
          team2Seed: 6,
          team1PoolInfo: { poolName: 'A', rank: 1 },
          team2PoolInfo: { poolName: 'C', rank: 2 },
          description: 'A1 vs C2'
        },
        { 
          team1Seed: 2, 
          team2Seed: 7,
          team1PoolInfo: { poolName: 'B', rank: 1 },
          team2PoolInfo: { poolName: 'D', rank: 2 },
          description: 'B1 vs D2'
        },
        { 
          team1Seed: 3, 
          team2Seed: 5,
          team1PoolInfo: { poolName: 'C', rank: 1 },
          team2PoolInfo: { poolName: 'A', rank: 2 },
          description: 'C1 vs A2'
        },
        { 
          team1Seed: 4, 
          team2Seed: 8,
          team1PoolInfo: { poolName: 'D', rank: 1 },
          team2PoolInfo: { poolName: 'B', rank: 2 },
          description: 'D1 vs B2'
        },
      ];

    case 'cross_pool_2':
      // A1 vs B2, A2 vs B3, A3 vs B4, A4 vs B1
      // For 2 pools with 4 teams advancing from each
      return [
        { team1Seed: 1, team2Seed: 4, description: 'A1 vs B2' },
        { team1Seed: 2, team2Seed: 7, description: 'A2 vs B3' },
        { team1Seed: 5, team2Seed: 8, description: 'A3 vs B4' },
        { team1Seed: 6, team2Seed: 3, description: 'A4 vs B1' },
      ];

    default:
      // Fallback to standard
      return generateTop8Matchups('standard', seededTeams);
  }
}

/**
 * Generate matchups for Top 6 based on seeding pattern
 */
export function generateTop6Matchups(
  seedingPattern: SeedingPattern,
  seededTeams: SeededTeam[]
): SeedingMatchup[] {
  if (seededTeams.length !== 6) {
    throw new Error('generateTop6Matchups requires exactly 6 seeded teams');
  }

  switch (seedingPattern) {
    case 'standard':
      // Top 2 seeds get byes
      return [
        { team1Seed: 3, team2Seed: 6, description: '3 vs 6' },
        { team1Seed: 4, team2Seed: 5, description: '4 vs 5' },
      ];

    case 'cross_pool_3':
      // Top 2 seeds get byes (A1, A2), seeds 3-6 play in first round (2 games)
      // Assumes seeds ordered by pool then rank: A1=1, A2=2, B1=3, B2=4, C1=5, C2=6
      // First round: B1 vs C2, B2 vs C1
      return [
        { 
          team1Seed: 3, 
          team2Seed: 6,
          team1PoolInfo: { poolName: 'B', rank: 1 },
          team2PoolInfo: { poolName: 'C', rank: 2 },
          description: 'B1 vs C2'
        },
        { 
          team1Seed: 4, 
          team2Seed: 5,
          team1PoolInfo: { poolName: 'B', rank: 2 },
          team2PoolInfo: { poolName: 'C', rank: 1 },
          description: 'B2 vs C1'
        },
      ];

    case 'cross_pool_2':
      // A1, B1 get byes; A2 vs B3, B2 vs A3
      return [
        { team1Seed: 2, team2Seed: 6, description: 'A2 vs B3' },
        { team1Seed: 4, team2Seed: 3, description: 'B2 vs A3' },
      ];

    case 'cross_pool_4':
      // 16 Teams - 4 Pools, Top 6: 4 pool winners + 2 best 2nd place (wildcards)
      // Standard seeding: Pool winners 1-4, then wildcards 5-6 (by record)
      // Seeds 1-2 get byes to semis
      // NOTE: If wildcards (seeds 5-6) are from same pools as seeds 3-4, this creates rematches.
      // Future enhancement: Add dynamic pool checking to swap matchups when needed.
      return [
        { 
          team1Seed: 3, 
          team2Seed: 6,
          description: '#3 Seed vs #6 Seed'
        },
        { 
          team1Seed: 4, 
          team2Seed: 5,
          description: '#4 Seed vs #5 Seed'
        },
      ];

    default:
      return generateTop6Matchups('standard', seededTeams);
  }
}

/**
 * Generate matchups for Top 4 based on seeding pattern
 */
export function generateTop4Matchups(
  seedingPattern: SeedingPattern,
  seededTeams: SeededTeam[]
): SeedingMatchup[] {
  if (seededTeams.length !== 4) {
    throw new Error('generateTop4Matchups requires exactly 4 seeded teams');
  }

  switch (seedingPattern) {
    case 'standard':
      return [
        { team1Seed: 1, team2Seed: 4, description: '1 vs 4' },
        { team1Seed: 2, team2Seed: 3, description: '2 vs 3' },
      ];

    case 'cross_pool_2':
      // A1 vs B2, B1 vs A2
      return [
        { 
          team1Seed: 1, 
          team2Seed: 4,
          team1PoolInfo: { poolName: 'A', rank: 1 },
          team2PoolInfo: { poolName: 'B', rank: 2 },
          description: 'A1 vs B2'
        },
        { 
          team1Seed: 3, 
          team2Seed: 2,
          team1PoolInfo: { poolName: 'B', rank: 1 },
          team2PoolInfo: { poolName: 'A', rank: 2 },
          description: 'B1 vs A2'
        },
      ];

    case 'cross_pool_3':
      // 12 Teams - 3 Pools, Top 4: 3 pool winners + 1 best 2nd place (wildcard)
      // Standard seeding: A1=1, B1=2, C1=3, Best2nd=4
      // NOTE: If wildcard (seed 4) is from same pool as seed 1, this creates a rematch.
      // Future enhancement: Add dynamic pool checking to swap matchups when needed.
      return [
        { 
          team1Seed: 1, 
          team2Seed: 4,
          description: '#1 Seed vs #4 Seed (Wildcard)'
        },
        { 
          team1Seed: 2, 
          team2Seed: 3,
          description: '#2 Seed vs #3 Seed'
        },
      ];

    case 'cross_pool_4':
      // 16 Teams - 4 Pools, Top 4: All 4 pool winners only (no wildcards)
      // Standard seeding: A1=1, B1=2, C1=3, D1=4 (by record/tiebreaker)
      // Cross-pool matchups: #1 vs #3, #2 vs #4 (guaranteed different pools)
      return [
        { 
          team1Seed: 1, 
          team2Seed: 3,
          description: '#1 Seed vs #3 Seed'
        },
        { 
          team1Seed: 2, 
          team2Seed: 4,
          description: '#2 Seed vs #4 Seed'
        },
      ];

    default:
      return generateTop4Matchups('standard', seededTeams);
  }
}

/**
 * Validate that a seeding pattern is compatible with playoff format and pool count
 */
export function isValidSeedingPattern(
  seedingPattern: SeedingPattern,
  playoffFormat: string | null | undefined,
  numberOfPools: number
): boolean {
  const available = getAvailableSeedingPatterns(playoffFormat, numberOfPools);
  return available.some(p => p.value === seedingPattern);
}
