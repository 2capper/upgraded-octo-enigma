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
    description: 'Cross-pool matchups: A1 vs C2, A2 vs C1, B1 vs D2, B2 vs D1',
    requiredPools: 4,
    compatibleFormats: ['top_8'],
  },
  {
    value: 'cross_pool_3',
    label: 'Cross-Pool (Three Pools)',
    description: 'Cross-pool matchups: A1 vs C2, B1 vs A2, C1 vs B2, etc.',
    requiredPools: 3,
    compatibleFormats: ['top_6', 'top_8'],
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
      // A1 vs C2, A2 vs C1, B1 vs D2, B2 vs D1
      // Assumes seeds are ordered: A1, A2, B1, B2, C1, C2, D1, D2
      // Remap to: 1=A1, 2=A2, 3=B1, 4=B2, 5=C1, 6=C2, 7=D1, 8=D2
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
          team2Seed: 5,
          team1PoolInfo: { poolName: 'A', rank: 2 },
          team2PoolInfo: { poolName: 'C', rank: 1 },
          description: 'A2 vs C1'
        },
        { 
          team1Seed: 3, 
          team2Seed: 8,
          team1PoolInfo: { poolName: 'B', rank: 1 },
          team2PoolInfo: { poolName: 'D', rank: 2 },
          description: 'B1 vs D2'
        },
        { 
          team1Seed: 4, 
          team2Seed: 7,
          team1PoolInfo: { poolName: 'B', rank: 2 },
          team2PoolInfo: { poolName: 'D', rank: 1 },
          description: 'B2 vs D1'
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
