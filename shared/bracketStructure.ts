export interface PlayoffSlot {
  round: number;
  gameNumber: number;
  name: string;
  homeSource: { type: 'seed'; rank: number } | { type: 'winner'; gameNumber: number; round: number };
  awaySource: { type: 'seed'; rank: number } | { type: 'winner'; gameNumber: number; round: number };
}

export function getBracketStructure(playoffFormat: string): PlayoffSlot[] {
  switch (playoffFormat) {
    case 'top_4':
      return [
        {
          round: 1,
          gameNumber: 1,
          name: 'Semi-Final 1',
          homeSource: { type: 'seed', rank: 1 },
          awaySource: { type: 'seed', rank: 4 }
        },
        {
          round: 1,
          gameNumber: 2,
          name: 'Semi-Final 2',
          homeSource: { type: 'seed', rank: 2 },
          awaySource: { type: 'seed', rank: 3 }
        },
        {
          round: 2,
          gameNumber: 1,
          name: 'Final',
          homeSource: { type: 'winner', gameNumber: 1, round: 1 },
          awaySource: { type: 'winner', gameNumber: 2, round: 1 }
        }
      ];

    case 'top_6':
      return [
        {
          round: 1,
          gameNumber: 1,
          name: 'Quarter-Final 1',
          homeSource: { type: 'seed', rank: 3 },
          awaySource: { type: 'seed', rank: 6 }
        },
        {
          round: 1,
          gameNumber: 2,
          name: 'Quarter-Final 2',
          homeSource: { type: 'seed', rank: 4 },
          awaySource: { type: 'seed', rank: 5 }
        },
        {
          round: 2,
          gameNumber: 1,
          name: 'Semi-Final 1',
          homeSource: { type: 'seed', rank: 1 },
          awaySource: { type: 'winner', gameNumber: 1, round: 1 }
        },
        {
          round: 2,
          gameNumber: 2,
          name: 'Semi-Final 2',
          homeSource: { type: 'seed', rank: 2 },
          awaySource: { type: 'winner', gameNumber: 2, round: 1 }
        },
        {
          round: 3,
          gameNumber: 1,
          name: 'Final',
          homeSource: { type: 'winner', gameNumber: 1, round: 2 },
          awaySource: { type: 'winner', gameNumber: 2, round: 2 }
        }
      ];

    case 'top_8':
      return [
        {
          round: 1,
          gameNumber: 1,
          name: 'Quarter-Final 1',
          homeSource: { type: 'seed', rank: 1 },
          awaySource: { type: 'seed', rank: 8 }
        },
        {
          round: 1,
          gameNumber: 2,
          name: 'Quarter-Final 2',
          homeSource: { type: 'seed', rank: 2 },
          awaySource: { type: 'seed', rank: 7 }
        },
        {
          round: 1,
          gameNumber: 3,
          name: 'Quarter-Final 3',
          homeSource: { type: 'seed', rank: 3 },
          awaySource: { type: 'seed', rank: 6 }
        },
        {
          round: 1,
          gameNumber: 4,
          name: 'Quarter-Final 4',
          homeSource: { type: 'seed', rank: 4 },
          awaySource: { type: 'seed', rank: 5 }
        },
        {
          round: 2,
          gameNumber: 1,
          name: 'Semi-Final 1',
          homeSource: { type: 'winner', gameNumber: 1, round: 1 },
          awaySource: { type: 'winner', gameNumber: 4, round: 1 }
        },
        {
          round: 2,
          gameNumber: 2,
          name: 'Semi-Final 2',
          homeSource: { type: 'winner', gameNumber: 2, round: 1 },
          awaySource: { type: 'winner', gameNumber: 3, round: 1 }
        },
        {
          round: 3,
          gameNumber: 1,
          name: 'Final',
          homeSource: { type: 'winner', gameNumber: 1, round: 2 },
          awaySource: { type: 'winner', gameNumber: 2, round: 2 }
        }
      ];

    case 'cross_pool_4':
      return [
        {
          round: 1,
          gameNumber: 1,
          name: 'Quarter-Final 1 (A1 vs C2)',
          homeSource: { type: 'seed', rank: 1 },
          awaySource: { type: 'seed', rank: 6 }
        },
        {
          round: 1,
          gameNumber: 2,
          name: 'Quarter-Final 2 (A2 vs C1)',
          homeSource: { type: 'seed', rank: 2 },
          awaySource: { type: 'seed', rank: 5 }
        },
        {
          round: 1,
          gameNumber: 3,
          name: 'Quarter-Final 3 (B1 vs D2)',
          homeSource: { type: 'seed', rank: 3 },
          awaySource: { type: 'seed', rank: 8 }
        },
        {
          round: 1,
          gameNumber: 4,
          name: 'Quarter-Final 4 (B2 vs D1)',
          homeSource: { type: 'seed', rank: 4 },
          awaySource: { type: 'seed', rank: 7 }
        },
        {
          round: 2,
          gameNumber: 1,
          name: 'Semi-Final 1',
          homeSource: { type: 'winner', gameNumber: 1, round: 1 },
          awaySource: { type: 'winner', gameNumber: 2, round: 1 }
        },
        {
          round: 2,
          gameNumber: 2,
          name: 'Semi-Final 2',
          homeSource: { type: 'winner', gameNumber: 3, round: 1 },
          awaySource: { type: 'winner', gameNumber: 4, round: 1 }
        },
        {
          round: 3,
          gameNumber: 1,
          name: 'Final',
          homeSource: { type: 'winner', gameNumber: 1, round: 2 },
          awaySource: { type: 'winner', gameNumber: 2, round: 2 }
        }
      ];

    default:
      return [];
  }
}
