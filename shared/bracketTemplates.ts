export interface BracketMatchup {
  round: number;
  gameNumber: number;
  bracket: 'winners' | 'losers' | 'championship';
  team1Seed: number | null;
  team2Seed: number | null;
  team1Source?: { gameNumber: number; position: 'winner' | 'loser' };
  team2Source?: { gameNumber: number; position: 'winner' | 'loser' };
}

export interface BracketTemplate {
  name: string;
  teamCount: number;
  eliminationType: 'single' | 'double';
  matchups: BracketMatchup[];
}

export const BRACKET_16_TEAM_SINGLE_ELIM: BracketTemplate = {
  name: '16-Team Single Elimination',
  teamCount: 16,
  eliminationType: 'single',
  matchups: [
    // Round 1 - Round of 16 (8 games)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 1, team2Seed: 16 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 8, team2Seed: 9 },
    { round: 1, gameNumber: 3, bracket: 'winners', team1Seed: 5, team2Seed: 12 },
    { round: 1, gameNumber: 4, bracket: 'winners', team1Seed: 4, team2Seed: 13 },
    { round: 1, gameNumber: 5, bracket: 'winners', team1Seed: 6, team2Seed: 11 },
    { round: 1, gameNumber: 6, bracket: 'winners', team1Seed: 3, team2Seed: 14 },
    { round: 1, gameNumber: 7, bracket: 'winners', team1Seed: 7, team2Seed: 10 },
    { round: 1, gameNumber: 8, bracket: 'winners', team1Seed: 2, team2Seed: 15 },
    
    // Round 2 - Quarterfinals (4 games)
    { round: 2, gameNumber: 9, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'winner' }, team2Source: { gameNumber: 2, position: 'winner' } },
    { round: 2, gameNumber: 10, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'winner' }, team2Source: { gameNumber: 4, position: 'winner' } },
    { round: 2, gameNumber: 11, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 5, position: 'winner' }, team2Source: { gameNumber: 6, position: 'winner' } },
    { round: 2, gameNumber: 12, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 7, position: 'winner' }, team2Source: { gameNumber: 8, position: 'winner' } },
    
    // Round 3 - Semifinals (2 games)
    { round: 3, gameNumber: 13, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 9, position: 'winner' }, team2Source: { gameNumber: 10, position: 'winner' } },
    { round: 3, gameNumber: 14, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 11, position: 'winner' }, team2Source: { gameNumber: 12, position: 'winner' } },
    
    // Round 4 - Finals (1 game)
    { round: 4, gameNumber: 15, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 13, position: 'winner' }, team2Source: { gameNumber: 14, position: 'winner' } },
  ]
};

export const BRACKET_12_TEAM_DOUBLE_ELIM: BracketTemplate = {
  name: '12-Team Double Elimination',
  teamCount: 12,
  eliminationType: 'double',
  matchups: [
    // Winners Bracket Round 1 (4 games)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 5, team2Seed: 12 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 6, team2Seed: 11 },
    { round: 1, gameNumber: 3, bracket: 'winners', team1Seed: 7, team2Seed: 10 },
    { round: 1, gameNumber: 4, bracket: 'winners', team1Seed: 8, team2Seed: 9 },
    
    // Winners Bracket Round 2 (4 games) - Top 4 seeds get byes
    { round: 2, gameNumber: 5, bracket: 'winners', team1Seed: 1, team2Seed: null, team2Source: { gameNumber: 1, position: 'winner' } },
    { round: 2, gameNumber: 6, bracket: 'winners', team1Seed: 2, team2Seed: null, team2Source: { gameNumber: 2, position: 'winner' } },
    { round: 2, gameNumber: 7, bracket: 'winners', team1Seed: 3, team2Seed: null, team2Source: { gameNumber: 3, position: 'winner' } },
    { round: 2, gameNumber: 8, bracket: 'winners', team1Seed: 4, team2Seed: null, team2Source: { gameNumber: 4, position: 'winner' } },
    
    // Losers Bracket Round 1 (4 games) - Losers from WB R1 vs losers from WB R2
    { round: 1, gameNumber: 9, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'loser' }, team2Source: { gameNumber: 5, position: 'loser' } },
    { round: 1, gameNumber: 10, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 2, position: 'loser' }, team2Source: { gameNumber: 6, position: 'loser' } },
    { round: 1, gameNumber: 11, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'loser' }, team2Source: { gameNumber: 7, position: 'loser' } },
    { round: 1, gameNumber: 12, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 4, position: 'loser' }, team2Source: { gameNumber: 8, position: 'loser' } },
    
    // Winners Bracket Semifinals (2 games)
    { round: 3, gameNumber: 13, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 5, position: 'winner' }, team2Source: { gameNumber: 6, position: 'winner' } },
    { round: 3, gameNumber: 14, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 7, position: 'winner' }, team2Source: { gameNumber: 8, position: 'winner' } },
    
    // Losers Bracket Round 2 (2 games)
    { round: 2, gameNumber: 15, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 9, position: 'winner' }, team2Source: { gameNumber: 10, position: 'winner' } },
    { round: 2, gameNumber: 16, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 11, position: 'winner' }, team2Source: { gameNumber: 12, position: 'winner' } },
    
    // Losers Bracket Round 3 (2 games) - Winners from LB R2 vs losers from WB SF
    { round: 3, gameNumber: 17, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 15, position: 'winner' }, team2Source: { gameNumber: 13, position: 'loser' } },
    { round: 3, gameNumber: 18, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 16, position: 'winner' }, team2Source: { gameNumber: 14, position: 'loser' } },
    
    // Winners Bracket Finals (1 game)
    { round: 4, gameNumber: 19, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 13, position: 'winner' }, team2Source: { gameNumber: 14, position: 'winner' } },
    
    // Losers Bracket Finals (1 game)
    { round: 4, gameNumber: 20, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 17, position: 'winner' }, team2Source: { gameNumber: 18, position: 'winner' } },
    
    // Championship (1-2 games)
    { round: 5, gameNumber: 21, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 19, position: 'winner' }, team2Source: { gameNumber: 20, position: 'winner' } },
    { round: 5, gameNumber: 22, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 21, position: 'loser' }, team2Source: { gameNumber: 21, position: 'winner' } }, // If-necessary game
  ]
};

export const BRACKET_4_TEAM_SINGLE_ELIM: BracketTemplate = {
  name: '4-Team Single Elimination',
  teamCount: 4,
  eliminationType: 'single',
  matchups: [
    // Semifinals - Round 1 (2 games)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 1, team2Seed: 4 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 2, team2Seed: 3 },
    
    // Finals - Round 2 (1 game)
    { round: 2, gameNumber: 3, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'winner' }, team2Source: { gameNumber: 2, position: 'winner' } },
  ]
};

export const BRACKET_6_TEAM_SINGLE_ELIM: BracketTemplate = {
  name: '6-Team Single Elimination',
  teamCount: 6,
  eliminationType: 'single',
  matchups: [
    // Round 1 - Quarterfinals (2 games, seeds 1-2 get byes)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 3, team2Seed: 6 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 4, team2Seed: 5 },
    
    // Round 2 - Semifinals (2 games)
    { round: 2, gameNumber: 3, bracket: 'winners', team1Seed: 1, team2Seed: null, team2Source: { gameNumber: 2, position: 'winner' } },
    { round: 2, gameNumber: 4, bracket: 'winners', team1Seed: 2, team2Seed: null, team2Source: { gameNumber: 1, position: 'winner' } },
    
    // Round 3 - Finals (1 game)
    { round: 3, gameNumber: 5, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'winner' }, team2Source: { gameNumber: 4, position: 'winner' } },
  ]
};

export const BRACKET_8_TEAM_SINGLE_ELIM: BracketTemplate = {
  name: '8-Team Single Elimination',
  teamCount: 8,
  eliminationType: 'single',
  matchups: [
    // Round 1 - Quarterfinals (4 games)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 1, team2Seed: 8 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 4, team2Seed: 5 },
    { round: 1, gameNumber: 3, bracket: 'winners', team1Seed: 3, team2Seed: 6 },
    { round: 1, gameNumber: 4, bracket: 'winners', team1Seed: 2, team2Seed: 7 },
    
    // Round 2 - Semifinals (2 games)
    { round: 2, gameNumber: 5, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'winner' }, team2Source: { gameNumber: 2, position: 'winner' } },
    { round: 2, gameNumber: 6, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'winner' }, team2Source: { gameNumber: 4, position: 'winner' } },
    
    // Round 3 - Finals (1 game)
    { round: 3, gameNumber: 7, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 5, position: 'winner' }, team2Source: { gameNumber: 6, position: 'winner' } },
  ]
};

export const BRACKET_4_TEAM_DOUBLE_ELIM: BracketTemplate = {
  name: '4-Team Double Elimination',
  teamCount: 4,
  eliminationType: 'double',
  matchups: [
    // Winners Bracket Round 1 (2 games)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 1, team2Seed: 4 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 2, team2Seed: 3 },
    
    // Winners Bracket Finals (1 game)
    { round: 2, gameNumber: 3, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'winner' }, team2Source: { gameNumber: 2, position: 'winner' } },
    
    // Losers Bracket Round 1 (1 game)
    { round: 1, gameNumber: 4, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'loser' }, team2Source: { gameNumber: 2, position: 'loser' } },
    
    // Losers Bracket Finals (1 game)
    { round: 2, gameNumber: 5, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 4, position: 'winner' }, team2Source: { gameNumber: 3, position: 'loser' } },
    
    // Championship (1-2 games)
    { round: 3, gameNumber: 6, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'winner' }, team2Source: { gameNumber: 5, position: 'winner' } },
    { round: 3, gameNumber: 7, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 6, position: 'loser' }, team2Source: { gameNumber: 6, position: 'winner' } }, // If-necessary game
  ]
};

export const BRACKET_8_TEAM_DOUBLE_ELIM: BracketTemplate = {
  name: '8-Team Double Elimination',
  teamCount: 8,
  eliminationType: 'double',
  matchups: [
    // Winners Bracket Round 1 (4 games)
    { round: 1, gameNumber: 1, bracket: 'winners', team1Seed: 1, team2Seed: 8 },
    { round: 1, gameNumber: 2, bracket: 'winners', team1Seed: 4, team2Seed: 5 },
    { round: 1, gameNumber: 3, bracket: 'winners', team1Seed: 3, team2Seed: 6 },
    { round: 1, gameNumber: 4, bracket: 'winners', team1Seed: 2, team2Seed: 7 },
    
    // Winners Bracket Semifinals (2 games)
    { round: 2, gameNumber: 5, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'winner' }, team2Source: { gameNumber: 2, position: 'winner' } },
    { round: 2, gameNumber: 6, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'winner' }, team2Source: { gameNumber: 4, position: 'winner' } },
    
    // Losers Bracket Round 1 (2 games)
    { round: 1, gameNumber: 7, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 1, position: 'loser' }, team2Source: { gameNumber: 2, position: 'loser' } },
    { round: 1, gameNumber: 8, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 3, position: 'loser' }, team2Source: { gameNumber: 4, position: 'loser' } },
    
    // Losers Bracket Round 2 (2 games) - LB R1 winners vs WB SF losers
    { round: 2, gameNumber: 9, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 7, position: 'winner' }, team2Source: { gameNumber: 5, position: 'loser' } },
    { round: 2, gameNumber: 10, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 8, position: 'winner' }, team2Source: { gameNumber: 6, position: 'loser' } },
    
    // Winners Bracket Finals (1 game)
    { round: 3, gameNumber: 11, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 5, position: 'winner' }, team2Source: { gameNumber: 6, position: 'winner' } },
    
    // Losers Bracket Semifinals (1 game)
    { round: 3, gameNumber: 12, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 9, position: 'winner' }, team2Source: { gameNumber: 10, position: 'winner' } },
    
    // Losers Bracket Finals (1 game)
    { round: 4, gameNumber: 13, bracket: 'losers', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 12, position: 'winner' }, team2Source: { gameNumber: 11, position: 'loser' } },
    
    // Championship (1-2 games)
    { round: 5, gameNumber: 14, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 11, position: 'winner' }, team2Source: { gameNumber: 13, position: 'winner' } },
    { round: 5, gameNumber: 15, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 14, position: 'loser' }, team2Source: { gameNumber: 14, position: 'winner' } }, // If-necessary game
  ]
};

export const BRACKET_8_TEAM_FOUR_POOLS: BracketTemplate = {
  name: '8-Team Four Pools',
  teamCount: 8,
  eliminationType: 'single',
  matchups: [
    // Quarter Finals - Round 1 (4 games)
    // Seeding: 1=Pool A 1st, 2=Pool A 2nd, 3=Pool B 1st, 4=Pool B 2nd, 5=Pool C 1st, 6=Pool C 2nd, 7=Pool D 1st, 8=Pool D 2nd
    { round: 1, gameNumber: 17, bracket: 'winners', team1Seed: 1, team2Seed: 6 },
    { round: 1, gameNumber: 18, bracket: 'winners', team1Seed: 7, team2Seed: 4 },
    { round: 1, gameNumber: 19, bracket: 'winners', team1Seed: 2, team2Seed: 5 },
    { round: 1, gameNumber: 20, bracket: 'winners', team1Seed: 8, team2Seed: 3 },
    
    // Semi-Finals - Round 2 (2 games)
    { round: 2, gameNumber: 21, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 17, position: 'winner' }, team2Source: { gameNumber: 18, position: 'winner' } },
    { round: 2, gameNumber: 22, bracket: 'winners', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 19, position: 'winner' }, team2Source: { gameNumber: 20, position: 'winner' } },
    
    // Finals - Round 3 (1 game)
    { round: 3, gameNumber: 23, bracket: 'championship', team1Seed: null, team2Seed: null, team1Source: { gameNumber: 21, position: 'winner' }, team2Source: { gameNumber: 22, position: 'winner' } },
  ]
};

export const BRACKET_TEMPLATES: Record<string, BracketTemplate> = {
  'se-4': BRACKET_4_TEAM_SINGLE_ELIM,
  'single_elim_4': BRACKET_4_TEAM_SINGLE_ELIM,
  'se-6': BRACKET_6_TEAM_SINGLE_ELIM,
  'single_elim_6': BRACKET_6_TEAM_SINGLE_ELIM,
  'se-8': BRACKET_8_TEAM_SINGLE_ELIM,
  'single_elim_8': BRACKET_8_TEAM_SINGLE_ELIM,
  'se-16': BRACKET_16_TEAM_SINGLE_ELIM,
  'single_elim_16': BRACKET_16_TEAM_SINGLE_ELIM,
  'de-4': BRACKET_4_TEAM_DOUBLE_ELIM,
  'double_elim_4': BRACKET_4_TEAM_DOUBLE_ELIM,
  'de-8': BRACKET_8_TEAM_DOUBLE_ELIM,
  'double_elim_8': BRACKET_8_TEAM_DOUBLE_ELIM,
  'de-12': BRACKET_12_TEAM_DOUBLE_ELIM,
  'double_elim_12': BRACKET_12_TEAM_DOUBLE_ELIM,
  'top_8_four_pools': BRACKET_8_TEAM_FOUR_POOLS,
};

export function getBracketTemplate(playoffFormat: string, teamCount: number): BracketTemplate | null {
  // Check for exact format match first
  if (BRACKET_TEMPLATES[playoffFormat]) {
    return BRACKET_TEMPLATES[playoffFormat];
  }
  
  // Try legacy format key construction
  const eliminationType = playoffFormat.includes('double') ? 'de' : 'se';
  const key = `${eliminationType}-${teamCount}`;
  return BRACKET_TEMPLATES[key] || null;
}
