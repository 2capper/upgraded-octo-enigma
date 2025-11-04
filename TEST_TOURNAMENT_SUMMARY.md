# TEST - 12 Team Top 6 Standard Tournament

## Tournament Details
- **Tournament ID**: `test-12-team-top-6-standard-2025-11`
- **Name**: TEST - 12 Team Top 6 Standard
- **Organization**: Ontario Baseball Association
- **Type**: Pool Play
- **Playoff Format**: Top 6
- **Seeding Pattern**: Standard
- **Start Date**: June 1, 2025
- **End Date**: June 3, 2025
- **Location**: Test Tournament Complex, Ontario
- **Number of Teams**: 12
- **Number of Pools**: 3

## Pool Structure

### Pool A (4 teams)
1. Toronto Titans (Toronto) - Coach: Mike Stevens
2. Mississauga Mustangs (Mississauga) - Coach: Sarah Johnson
3. Brampton Bulldogs (Brampton) - Coach: David Chen
4. Oakville Owls (Oakville) - Coach: Jennifer Martin

### Pool B (4 teams)
5. Hamilton Hawks (Hamilton) - Coach: Robert Brown
6. Burlington Bandits (Burlington) - Coach: Lisa Anderson
7. Kitchener Kings (Kitchener) - Coach: Mark Wilson
8. Waterloo Warriors (Waterloo) - Coach: Emily Davis

### Pool C (4 teams)
9. London Lightning (London) - Coach: James Thompson
10. Windsor Wildcats (Windsor) - Coach: Michelle Lee
11. Ottawa Outlaws (Ottawa) - Coach: Chris Taylor
12. Kingston Knights (Kingston) - Coach: Amanda White

## Pool Play Games (18 Total - All Completed)

### Pool A Games (6 games)
1. Toronto Titans 5, Mississauga Mustangs 3 (June 1, 09:00)
2. Brampton Bulldogs 6, Oakville Owls 2 (June 1, 09:30)
3. Toronto Titans 7, Brampton Bulldogs 4 (June 2, 10:00)
4. Mississauga Mustangs 8, Oakville Owls 1 (June 2, 10:30)
5. Toronto Titans 4, Oakville Owls 3 (June 2, 11:00)
6. Mississauga Mustangs 3, Brampton Bulldogs 5 (June 2, 11:30)

### Pool B Games (6 games)
1. Hamilton Hawks 6, Burlington Bandits 4 (June 1, 09:00)
2. Kitchener Kings 5, Waterloo Warriors 3 (June 1, 09:30)
3. Hamilton Hawks 5, Kitchener Kings 2 (June 2, 10:00)
4. Burlington Bandits 7, Waterloo Warriors 4 (June 2, 10:30)
5. Hamilton Hawks 8, Waterloo Warriors 1 (June 2, 11:00)
6. Burlington Bandits 4, Kitchener Kings 3 (June 2, 11:30)

### Pool C Games (6 games)
1. London Lightning 5, Windsor Wildcats 4 (June 1, 09:00)
2. Ottawa Outlaws 7, Kingston Knights 2 (June 1, 09:30)
3. London Lightning 3, Ottawa Outlaws 4 (June 2, 10:00)
4. Windsor Wildcats 6, Kingston Knights 1 (June 2, 10:30)
5. London Lightning 8, Kingston Knights 3 (June 2, 11:00)
6. Windsor Wildcats 2, Ottawa Outlaws 3 (June 2, 11:30)

## Expected Standings (Based on Scores)

### Pool A Standings
**Tie-Breaker Scenario: 2-way tie for 2nd place (Runs Allowed decides)**

1. **Toronto Titans**: 3-0 (W: 3, L: 0, RF: 16, RA: 10)
2. **Brampton Bulldogs**: 2-1 (W: 2, L: 1, RF: 15, RA: 12) ← **Better RA**
3. **Mississauga Mustangs**: 2-1 (W: 2, L: 1, RF: 14, RA: 14) ← **Worse RA**
4. **Oakville Owls**: 0-3 (W: 0, L: 3, RF: 6, RA: 25)

**Tie-Breaker Note**: Bulldogs and Mustangs both 2-1, but Bulldogs allowed only 12 runs vs Mustangs' 14 runs allowed.

### Pool B Standings
**Clear Winner Scenario: No ties**

1. **Hamilton Hawks**: 3-0 (W: 3, L: 0, RF: 19, RA: 7)
2. **Burlington Bandits**: 2-1 (W: 2, L: 1, RF: 15, RA: 11)
3. **Kitchener Kings**: 1-2 (W: 1, L: 2, RF: 10, RA: 16)
4. **Waterloo Warriors**: 0-3 (W: 0, L: 3, RF: 8, RA: 18)

### Pool C Standings
**Tie-Breaker Scenario: 3-way tie for 1st place (Head-to-head RA among tied teams)**

All three teams are 2-1. Head-to-head records:
- Lightning vs Wildcats: W 5-4, L 3-4 (Lightning won)
- Lightning vs Outlaws: L 3-4 (Outlaws won)
- Wildcats vs Outlaws: L 2-3 (Outlaws won)

Among tied teams (games between Lightning, Wildcats, Outlaws):
- **Ottawa Outlaws**: 2-0 in head-to-head (beat Lightning 4-3, beat Wildcats 3-2)
- **London Lightning**: 1-1 in head-to-head (beat Wildcats 5-4, lost to Outlaws 3-4)
- **Windsor Wildcats**: 0-2 in head-to-head (lost to Lightning 4-5, lost to Outlaws 2-3)

Final Pool C Standings:
1. **Ottawa Outlaws**: 2-1 (W: 2, L: 1, RF: 14, RA: 10) ← **Best head-to-head**
2. **London Lightning**: 2-1 (W: 2, L: 1, RF: 16, RA: 11) ← **Middle head-to-head**
3. **Windsor Wildcats**: 2-1 (W: 2, L: 1, RF: 12, RA: 12) ← **Worst head-to-head**
4. **Kingston Knights**: 0-3 (W: 0, L: 3, RF: 6, RA: 21)

## Top 6 Playoff Seeding (Expected)

Based on the standings, the top 6 teams advancing to playoffs with standard seeding would be:

1. **Seed 1**: Toronto Titans (Pool A - 1st, 3-0)
2. **Seed 2**: Hamilton Hawks (Pool B - 1st, 3-0)
3. **Seed 3**: Ottawa Outlaws (Pool C - 1st, 2-1)
4. **Seed 4**: Brampton Bulldogs (Pool A - 2nd, 2-1, RA: 12)
5. **Seed 5**: Burlington Bandits (Pool B - 2nd, 2-1, RA: 11)
6. **Seed 6**: London Lightning (Pool C - 2nd, 2-1, RA: 11)

## Usage for Validation Report Testing

Use this tournament ID for testing the validation report:

```
TOURNAMENT_ID: test-12-team-top-6-standard-2025-11
```

The tournament includes:
- ✅ 12 teams across 3 pools
- ✅ 18 completed pool play games with realistic scores
- ✅ 2-way tie scenario in Pool A (runs allowed tie-breaker)
- ✅ Clear winner scenario in Pool B (no ties)
- ✅ 3-way tie scenario in Pool C (head-to-head record tie-breaker)
- ✅ All games have proper dates, times, and locations
- ✅ Realistic baseball scores (1-8 runs per team)

## Verification

To verify the tournament in the database:

```sql
-- Check tournament details
SELECT * FROM tournaments WHERE id = 'test-12-team-top-6-standard-2025-11';

-- Check all teams
SELECT t.name, t.city, t.coach, p.name as pool
FROM teams t
JOIN pools p ON t.pool_id = p.id
WHERE t.tournament_id = 'test-12-team-top-6-standard-2025-11'
ORDER BY p.name, t.name;

-- Check all games
SELECT 
  p.name as pool,
  ht.name as home_team,
  g.home_score,
  g.away_score,
  at.name as away_team,
  g.date,
  g.time
FROM games g
JOIN teams ht ON g.home_team_id = ht.id
JOIN teams at ON g.away_team_id = at.id
JOIN pools p ON g.pool_id = p.id
WHERE g.tournament_id = 'test-12-team-top-6-standard-2025-11'
ORDER BY p.name, g.date, g.time;
```

## Next Steps

This tournament is ready to be used for:
1. Testing the validation report generation
2. Testing playoff bracket generation with top_6 format
3. Testing tie-breaker calculations
4. Testing standings display with complex scenarios
5. Testing tournament dashboard features

---

**Created**: November 2, 2025
**Status**: Complete and Ready for Testing
