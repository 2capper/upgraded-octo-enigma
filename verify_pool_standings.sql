-- Verify Pool B standings and runs allowed for tie-breaker
WITH pool_b_team_stats AS (
  SELECT 
    t.name,
    t.id as team_id,
    SUM(CASE 
      WHEN g.home_team_id = t.id AND g.home_score > g.away_score THEN 1
      WHEN g.away_team_id = t.id AND g.away_score > g.home_score THEN 1
      ELSE 0
    END) as wins,
    SUM(CASE 
      WHEN g.home_team_id = t.id AND g.home_score < g.away_score THEN 1
      WHEN g.away_team_id = t.id AND g.away_score < g.home_score THEN 1
      ELSE 0
    END) as losses,
    SUM(CASE 
      WHEN g.home_team_id = t.id THEN g.away_score
      WHEN g.away_team_id = t.id THEN g.home_score
      ELSE 0
    END) as runs_allowed
  FROM teams t
  JOIN pools p ON t.pool_id = p.id
  LEFT JOIN games g ON (g.home_team_id = t.id OR g.away_team_id = t.id) 
    AND g.tournament_id = t.tournament_id 
    AND g.is_playoff = false
  WHERE t.tournament_id = 'test-12-team-top-6-cross-pool-2025-11'
    AND p.name = 'Pool B'
  GROUP BY t.name, t.id
)
SELECT 
  name,
  wins || '-' || losses as record,
  runs_allowed
FROM pool_b_team_stats
ORDER BY wins DESC, runs_allowed ASC;
