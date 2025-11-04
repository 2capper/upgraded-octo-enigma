// Playoff format definitions and utilities

export type PlayoffFormat = 
  | 'top_4'
  | 'top_6'
  | 'top_8'
  | 'top_8_four_pools'
  | 'all_seeded'
  | 'championship_consolation'
  | 'single_elim_4'
  | 'single_elim_6'
  | 'single_elim_8'
  | 'single_elim_12'
  | 'single_elim_16'
  | 'double_elim_4'
  | 'double_elim_6'
  | 'double_elim_8'
  | 'double_elim_12'
  | 'double_elim_16';

export interface PlayoffFormatOption {
  value: PlayoffFormat;
  label: string;
  description: string;
  minTeams: number; // Minimum teams required for this format
  numberOfPlayoffTeams: number; // How many teams make playoffs
}

// Pool Play Playoff Formats
export const poolPlayFormats: PlayoffFormatOption[] = [
  {
    value: 'top_4',
    label: 'Top 4 Teams',
    description: 'Pool winners + top remaining teams (4 total)',
    minTeams: 8,
    numberOfPlayoffTeams: 4,
  },
  {
    value: 'top_6',
    label: 'Top 6 Teams',
    description: 'Pool winners + top remaining teams (6 total)',
    minTeams: 12,
    numberOfPlayoffTeams: 6,
  },
  {
    value: 'top_8',
    label: 'Top 8 Teams',
    description: 'Pool winners + top remaining teams (8 total)',
    minTeams: 16,
    numberOfPlayoffTeams: 8,
  },
  {
    value: 'all_seeded',
    label: 'All Teams - Single Bracket',
    description: 'All teams seeded into single elimination bracket',
    minTeams: 4,
    numberOfPlayoffTeams: 0, // All teams participate
  },
  // Note: Legacy formats below exist in type but are not exposed in UI:
  // - top_8_four_pools: Deprecated in favor of top_8 with cross_pool_4 seeding pattern
  // - championship_consolation: Requires dual-bracket generation logic (not implemented)
];

// Single Elimination Formats
export const singleElimFormats: PlayoffFormatOption[] = [
  {
    value: 'single_elim_4',
    label: '4-Team Single Elimination',
    description: 'Standard 4-team bracket (2 rounds)',
    minTeams: 4,
    numberOfPlayoffTeams: 4,
  },
  {
    value: 'single_elim_6',
    label: '6-Team Single Elimination',
    description: '6-team bracket with byes for top 2 seeds',
    minTeams: 6,
    numberOfPlayoffTeams: 6,
  },
  {
    value: 'single_elim_8',
    label: '8-Team Single Elimination',
    description: 'Standard 8-team bracket (3 rounds)',
    minTeams: 8,
    numberOfPlayoffTeams: 8,
  },
  {
    value: 'single_elim_16',
    label: '16-Team Single Elimination',
    description: 'Standard 16-team bracket (4 rounds)',
    minTeams: 16,
    numberOfPlayoffTeams: 16,
  },
  // Note: single_elim_12 format exists in type but is not exposed in UI
  // as bracket template has not been created yet
];

// Double Elimination Formats
export const doubleElimFormats: PlayoffFormatOption[] = [
  {
    value: 'double_elim_4',
    label: '4-Team Double Elimination',
    description: 'Winners and losers brackets (4-6 games)',
    minTeams: 4,
    numberOfPlayoffTeams: 4,
  },
  {
    value: 'double_elim_8',
    label: '8-Team Double Elimination',
    description: 'Full winners and losers brackets',
    minTeams: 8,
    numberOfPlayoffTeams: 8,
  },
  {
    value: 'double_elim_12',
    label: '12-Team Double Elimination',
    description: 'Complex double elimination bracket',
    minTeams: 12,
    numberOfPlayoffTeams: 12,
  },
  // Note: double_elim_6 and double_elim_16 formats exist in type but are not exposed in UI
  // as bracket templates have not been created yet (complex routing)
];

/**
 * Get available playoff formats based on tournament type and team count
 */
export function getAvailablePlayoffFormats(
  tournamentType: string,
  numberOfTeams: number
): PlayoffFormatOption[] {
  let availableFormats: PlayoffFormatOption[] = [];

  switch (tournamentType) {
    case 'pool_play':
      availableFormats = poolPlayFormats.filter(
        format => format.value === 'all_seeded' || numberOfTeams >= format.minTeams
      );
      break;
    case 'single_elimination':
      availableFormats = singleElimFormats.filter(
        format => numberOfTeams >= format.minTeams
      );
      break;
    case 'double_elimination':
      availableFormats = doubleElimFormats.filter(
        format => numberOfTeams >= format.minTeams
      );
      break;
  }

  return availableFormats;
}

/**
 * Get the number of playoff teams for a given format
 * Returns 0 if all teams participate (e.g., single/double elimination, all_seeded, championship_consolation)
 */
export function getPlayoffTeamCount(
  playoffFormat: PlayoffFormat | null | undefined,
  totalTeams: number
): number {
  if (!playoffFormat) return 0;

  const allFormats = [...poolPlayFormats, ...singleElimFormats, ...doubleElimFormats];
  const format = allFormats.find(f => f.value === playoffFormat);

  if (!format) return 0;

  // For formats where all teams participate
  if (format.numberOfPlayoffTeams === 0) {
    return totalTeams;
  }

  return format.numberOfPlayoffTeams;
}

/**
 * Determine the default playoff format based on tournament type and team count
 */
export function getDefaultPlayoffFormat(
  tournamentType: string,
  numberOfTeams: number
): PlayoffFormat | null {
  const available = getAvailablePlayoffFormats(tournamentType, numberOfTeams);
  
  if (available.length === 0) return null;

  // For pool play, prefer top_6 if available, otherwise first available
  if (tournamentType === 'pool_play') {
    const top6 = available.find(f => f.value === 'top_6');
    return top6 ? top6.value : available[0].value;
  }

  // For elimination tournaments, find exact match for team count
  const exactMatch = available.find(f => f.numberOfPlayoffTeams === numberOfTeams);
  return exactMatch ? exactMatch.value : available[0].value;
}

/**
 * Validate that a playoff format is compatible with tournament settings
 */
export function isValidPlayoffFormat(
  playoffFormat: PlayoffFormat,
  tournamentType: string,
  numberOfTeams: number
): boolean {
  const available = getAvailablePlayoffFormats(tournamentType, numberOfTeams);
  return available.some(f => f.value === playoffFormat);
}
