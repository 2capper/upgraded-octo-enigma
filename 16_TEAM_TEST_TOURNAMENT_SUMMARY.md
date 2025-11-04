# TEST - 16 Team Top 8 Standard Tournament Summary

## Tournament Details
- **Tournament ID**: `test-16-team-top-8-standard-2025-11`
- **Name**: TEST - 16 Team Top 8 Standard
- **Type**: pool_play
- **Organization**: Ontario Baseball Association (OBA)
- **Number of Teams**: 16
- **Number of Pools**: 4 (Pool A, Pool B, Pool C, Pool D)
- **Playoff Format**: top_8
- **Seeding Pattern**: standard
- **Start Date**: 2025-08-01
- **End Date**: 2025-08-03
- **Location**: Standard 16-Team Complex, Ontario

## Teams by Pool

### Pool A
1. **Ajax Aces** - Ajax, Coach: Tom Henderson
2. **Pickering Panthers** - Pickering, Coach: Sandra Mitchell
3. **Whitby Wolves** - Whitby, Coach: Derek Campbell
4. **Oshawa Owls** - Oshawa, Coach: Patricia Lee

### Pool B
5. **Richmond Hill Rangers** - Richmond Hill, Coach: Michael Chang
6. **Newmarket Navigators** - Newmarket, Coach: Jennifer Walsh
7. **Aurora Aviators** - Aurora, Coach: Steve Peterson
8. **Bradford Bulls** - Bradford, Coach: Maria Santos

### Pool C
9. **Milton Mustangs** - Milton, Coach: Andrew Miller
10. **Halton Hawks** - Halton Hills, Coach: Rebecca Turner
11. **Georgetown Giants** - Georgetown, Coach: Daniel Kim
12. **Acton Arrows** - Acton, Coach: Laura Cooper

### Pool D
13. **Peterborough Pirates** - Peterborough, Coach: Richard Davis
14. **Cobourg Cougars** - Cobourg, Coach: Michelle Brown
15. **Port Hope Pelicans** - Port Hope, Coach: Jason Taylor
16. **Belleville Blaze** - Belleville, Coach: Angela White

## Pool Play Results & Standings

### Pool A - 3-Way Tie for 1st Place
**Complex Tie-Breaker Scenario: Circular Head-to-Head**

| Team | Record | RS | RA | RD |
|------|--------|----|----|-----|
| Ajax Aces | 2-1 | 18 | 11 | +7 |
| Pickering Panthers | 2-1 | 18 | 11 | +7 |
| Whitby Wolves | 2-1 | 15 | 10 | +5 |
| Oshawa Owls | 0-3 | 5 | 24 | -19 |

**Tie-Breaker Analysis**:
- All three teams (Aces, Panthers, Wolves) finish 2-1
- Circular head-to-head: Aces beat Panthers, Panthers beat Wolves, Wolves beat Aces
- Head-to-head doesn't break the tie, requires runs allowed among tied teams
- Final seeding determined by runs allowed in games among the three tied teams

### Pool B - Clear Standings (No Ties)
| Team | Record | RS | RA | RD |
|------|--------|----|----|-----|
| Richmond Hill Rangers | 3-0 | 18 | 8 | +10 |
| Newmarket Navigators | 2-1 | 16 | 11 | +5 |
| Aurora Aviators | 1-2 | 10 | 13 | -3 |
| Bradford Bulls | 0-3 | 6 | 18 | -12 |

**Tie-Breaker Analysis**: None needed - all teams have unique records

### Pool C - 3-Way Tie for 1st Place
**Complex Tie-Breaker Scenario: Another Circular Head-to-Head**

| Team | Record | RS | RA | RD |
|------|--------|----|----|-----|
| Milton Mustangs | 2-1 | 17 | 11 | +6 |
| Halton Hawks | 2-1 | 15 | 10 | +5 |
| Georgetown Giants | 2-1 | 15 | 11 | +4 |
| Acton Arrows | 0-3 | 5 | 20 | -15 |

**Tie-Breaker Analysis**:
- All three teams (Mustangs, Hawks, Giants) finish 2-1
- Circular head-to-head: Mustangs beat Hawks, Hawks beat Giants, Giants beat Mustangs
- Another complex tie-breaker scenario requiring runs allowed among tied teams

### Pool D - Multiple Tie Scenarios
**2-Way Tie at 2-1 AND 2-Way Tie at 1-2**

| Team | Record | RS | RA | RD |
|------|--------|----|----|-----|
| Port Hope Pelicans | 2-1 | 15 | 10 | +5 |
| Cobourg Cougars | 2-1 | 16 | 13 | +3 |
| Belleville Blaze | 1-2 | 13 | 16 | -3 |
| Peterborough Pirates | 1-2 | 10 | 15 | -5 |

**Tie-Breaker Analysis**:
- 2-way tie for 1st: Pelicans and Cougars both 2-1 (Pelicans beat Cougars head-to-head)
- 2-way tie for 3rd: Blaze and Pirates both 1-2 (broken by run differential)
- Multiple tie-breaker scenarios in a single pool

## Tournament Statistics
- **Total Games**: 24 pool play games (all completed)
- **Games per Team**: 3 (round-robin within pools)
- **Games per Pool**: 6
- **All games scheduled**: August 1-2, 2025

## Tie-Breaker Scenario Summary
This tournament includes the following complex tie-breaker scenarios:

1. **Pool A**: 3-way circular tie at 2-1 (requires RA among tied teams)
2. **Pool B**: Clean standings (no ties needed for testing)
3. **Pool C**: 3-way circular tie at 2-1 (another complex scenario)
4. **Pool D**: Two separate 2-way ties (both at 2-1 and 1-2)

## Top 8 Playoff Seeds (Based on Pool Play)
1. Whitby Wolves (Pool A, 2-1)
2. Richmond Hill Rangers (Pool B, 3-0)
3. Milton Mustangs (Pool C, 2-1)
4. Port Hope Pelicans (Pool D, 2-1)
5. Ajax Aces (Pool A, 2-1)
6. Newmarket Navigators (Pool B, 2-1)
7. Georgetown Giants (Pool C, 2-1)
8. Belleville Blaze (Pool D, 2-1)

## Usage for Testing
Use this tournament ID for validation report testing and tie-breaker algorithm verification:

```
TOURNAMENT_ID: test-16-team-top-8-standard-2025-11
```

## Database Verification Commands

```sql
-- View tournament details
SELECT * FROM tournaments WHERE id = 'test-16-team-top-8-standard-2025-11';

-- View all teams
SELECT name, city, coach FROM teams 
WHERE tournament_id = 'test-16-team-top-8-standard-2025-11'
ORDER BY pool_id, name;

-- View pool standings
SELECT 
  SUBSTRING(t.pool_id, LENGTH(t.pool_id) - 5, 6) as pool,
  t.name,
  SUM(CASE WHEN (g.home_team_id = t.id AND g.home_score > g.away_score) 
           OR (g.away_team_id = t.id AND g.away_score > g.home_score) 
       THEN 1 ELSE 0 END) as wins,
  SUM(CASE WHEN (g.home_team_id = t.id AND g.home_score < g.away_score) 
           OR (g.away_team_id = t.id AND g.away_score < g.home_score) 
       THEN 1 ELSE 0 END) as losses
FROM teams t
LEFT JOIN games g ON (t.id = g.home_team_id OR t.id = g.away_team_id) 
  AND g.is_playoff = false
WHERE t.tournament_id = 'test-16-team-top-8-standard-2025-11'
GROUP BY t.pool_id, t.name
ORDER BY pool, wins DESC;
```

## Script Location
The tournament creation script is located at: `create-16-team-test-tournament.ts`

To recreate this tournament:
```bash
npx tsx create-16-team-test-tournament.ts
```
