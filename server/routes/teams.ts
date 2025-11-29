import { Router } from "express";
import { teamService } from "../services/teamService";
import { tournamentService } from "../services/tournamentService";
import { isAuthenticated, requireAdmin } from "../auth";
import { checkTournamentAccess } from "./helpers";
import { insertTeamSchema } from "@shared/schema";

const router = Router();

router.get("/tournaments/:tournamentId/teams", async (req: any, res) => {
  try {
    if (!await checkTournamentAccess(req, res, req.params.tournamentId)) {
      return;
    }
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    
    const teams = await teamService.getTeams(req.params.tournamentId);
    res.json(teams);
  } catch (error) {
    console.error("Error fetching teams:", error);
    res.status(500).json({ error: "Failed to fetch teams" });
  }
});

router.post("/tournaments/:tournamentId/teams", requireAdmin, async (req, res) => {
  try {
    const validatedData = insertTeamSchema.parse({
      ...req.body,
      tournamentId: req.params.tournamentId
    });
    const team = await teamService.createTeam(validatedData);
    res.status(201).json(team);
  } catch (error) {
    console.error("Error creating team:", error);
    res.status(400).json({ error: "Invalid team data" });
  }
});

router.put("/teams/:id", requireAdmin, async (req, res) => {
  try {
    const updateData = req.body.data || req.body;
    console.log("Team update request body:", req.body);
    console.log("Update data to use:", updateData);
    
    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No data provided for update" });
    }
    
    const team = await teamService.updateTeam(req.params.id, updateData);
    res.json(team);
  } catch (error) {
    console.error("Error updating team:", error);
    res.status(400).json({ error: "Failed to update team" });
  }
});

router.delete("/teams/:id", requireAdmin, async (req, res) => {
  try {
    await teamService.deleteTeam(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting team:", error);
    res.status(400).json({ error: "Failed to delete team" });
  }
});

router.post("/teams/:id/populate-data", isAuthenticated, async (req, res) => {
  try {
    const teamId = req.params.id;
    const { teamName } = req.body;
    
    const formattedTeamName = teamName.toLowerCase().replace(/\s+/g, '-');
    const rosterLink = `https://playoba.ca/stats/${formattedTeamName}`;
    
    const suggestedData = {
      rosterLink,
      pitchCountAppName: '',
      pitchCountName: '',
      gameChangerName: ''
    };
    
    const updatedTeam = await teamService.updateTeam(teamId, suggestedData);
    
    res.json({
      team: updatedTeam,
      suggestions: suggestedData
    });
  } catch (error) {
    console.error("Error populating team data:", error);
    res.status(400).json({ error: "Failed to populate team data" });
  }
});

router.post("/teams/:id/find-oba-matches", async (req, res) => {
  try {
    const teamId = req.params.id;
    const { spawn } = await import("child_process");
    
    const team = await teamService.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }
    
    const pool = await tournamentService.getPoolById(team.poolId);
    if (!pool) {
      return res.status(404).json({ error: "Team's pool not found" });
    }

    const python = spawn("python", [
      "server/roster_scraper.py",
      "find_matches",
      team.name,
      pool.ageDivisionId,
      "500000",
      "505000"
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to find OBA matches" });
      }

      try {
        const data = JSON.parse(result);
        res.json({
          team: {
            id: team.id,
            name: team.name,
            division: pool.ageDivisionId
          },
          matches: data.matches || [],
          total_found: data.total_found || 0
        });
      } catch (e) {
        console.error("Failed to parse result:", e);
        res.status(500).json({ error: "Failed to process match results" });
      }
    });
  } catch (error) {
    console.error("Error finding OBA matches:", error);
    res.status(500).json({ error: "Failed to find OBA matches" });
  }
});

router.post("/teams/:id/roster/import-by-team-id", isAuthenticated, async (req, res) => {
  const { teamId, obaTeamId } = req.body;
  
  if (!teamId || !obaTeamId) {
    return res.status(400).json({ error: "Missing teamId or obaTeamId" });
  }
  
  try {
    const { spawn } = await import("child_process");
    const teamUrl = `https://www.playoba.ca/stats#/2111/team/${obaTeamId}/roster`;
    
    const python = spawn("python", [
      "server/roster_scraper.py",
      "import",
      teamUrl
    ]);
    
    let result = "";
    let error = "";
    
    python.stdout.on("data", (data) => {
      result += data.toString();
    });
    
    python.stderr.on("data", (data) => {
      error += data.toString();
    });
    
    python.on("close", async (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to import roster" });
      }
      
      try {
        const data = JSON.parse(result);
        console.log("Team ID import data:", data);
        
        if (data.success && data.roster) {
          const players = data.roster.players || [];
          
          const updateData: any = {};
          updateData.rosterLink = teamUrl;
          if (players.length > 0) {
            updateData.rosterData = JSON.stringify(players);
          }
          
          if (Object.keys(updateData).length > 0) {
            const team = await teamService.updateTeam(teamId, updateData);
            res.json({ 
              success: true, 
              team, 
              roster: data.roster,
              player_count: players.length 
            });
          } else {
            res.status(400).json({ error: "No data to update" });
          }
        } else {
          res.status(400).json({ error: data.error || "Failed to import roster" });
        }
      } catch (e) {
        console.error("Failed to parse result:", e);
        res.status(500).json({ error: "Failed to process import results" });
      }
    });
  } catch (error) {
    console.error("Error importing roster by team ID:", error);
    res.status(500).json({ error: "Failed to import roster" });
  }
});

router.get("/affiliates", isAuthenticated, async (req, res) => {
  try {
    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/roster_scraper.py",
      "get_affiliates"
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to get affiliates" });
      }
      
      try {
        const data = JSON.parse(result.trim());
        res.json(data);
      } catch (e) {
        console.error("Failed to parse affiliates:", e);
        res.status(500).json({ error: "Failed to process affiliates" });
      }
    });
  } catch (error) {
    console.error("Error getting affiliates:", error);
    res.status(500).json({ error: "Failed to get affiliates" });
  }
});

router.post("/organizations/:organization/teams", isAuthenticated, async (req, res) => {
  try {
    const { organization } = req.params;
    const { affiliateNumber, division } = req.body;
    
    if (!affiliateNumber || !division) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/roster_scraper.py",
      "get_organization_teams",
      affiliateNumber,
      organization,
      division
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to get organization teams" });
      }
      
      try {
        const data = JSON.parse(result.trim());
        res.json(data);
      } catch (e) {
        console.error("Failed to parse organization teams:", e);
        res.status(500).json({ error: "Failed to process organization teams" });
      }
    });
  } catch (error) {
    console.error("Error getting organization teams:", error);
    res.status(500).json({ error: "Failed to get organization teams" });
  }
});

router.post("/roster/match-teams", async (req, res) => {
  try {
    const { teamName, division } = req.body;
    
    if (!teamName || !division) {
      return res.status(400).json({ error: "Missing teamName or division" });
    }

    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/simple_team_matcher.py",
      "search",
      teamName,
      division
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to find team matches" });
      }
      
      try {
        const data = JSON.parse(result.trim());
        
        res.json({
          success: true,
          matches: data.matches || [],
          total_found: data.total_found || 0
        });
      } catch (e) {
        console.error("Failed to parse match results:", e);
        res.status(500).json({ error: "Failed to process match results" });
      }
    });
  } catch (error) {
    console.error("Error finding team matches:", error);
    res.status(500).json({ error: "Failed to find team matches" });
  }
});

router.post("/admin/scan-oba-teams", isAuthenticated, async (req, res) => {
  try {
    const { startId = 500000, endId = 510000 } = req.body;
    
    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/team_discovery.py",
      "scan",
      startId.toString(),
      endId.toString()
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Team scanning error:", error);
      } else {
        console.log("Team scanning completed:", result);
      }
    });

    res.json({ 
      success: true, 
      message: "Team scanning started",
      range: { startId, endId }
    });
  } catch (error) {
    console.error("Failed to start team scanning:", error);
    res.status(500).json({ error: "Failed to start team scanning" });
  }
});

router.get("/admin/oba-teams/stats", isAuthenticated, async (req, res) => {
  try {
    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/team_discovery.py",
      "stats"
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Stats error:", error);
        return res.status(500).json({ error: "Failed to get statistics" });
      }
      
      res.json({ success: true, stats: result.trim() });
    });
  } catch (error) {
    console.error("Statistics error:", error);
    res.status(500).json({ error: "Failed to get scanning statistics" });
  }
});

router.post("/teams/:teamId/roster/search", isAuthenticated, async (req, res) => {
  try {
    const { affiliate, season, division, teamName } = req.body;
    
    if (!affiliate || !season || !division || !teamName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/roster_scraper.py",
      "search",
      affiliate,
      season,
      division,
      teamName
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error code:", code);
        console.error("Python script stderr:", error);
        console.error("Python script stdout:", result);
        return res.status(500).json({ error: "Failed to search for team" });
      }
      
      try {
        const cleanedResult = result.trim();
        const data = JSON.parse(cleanedResult);
        res.json(data);
      } catch (e) {
        console.error("Failed to parse JSON result:", e);
        console.error("Raw stdout output:", result);
        console.error("Raw stderr output:", error);
        console.error("Result length:", result.length);
        console.error("First 100 chars:", result.substring(0, 100));
        res.status(500).json({ error: "Failed to process search results" });
      }
    });
  } catch (error) {
    console.error("Error searching for roster:", error);
    res.status(500).json({ error: "Failed to search for roster" });
  }
});

router.post("/teams/:teamId/roster/import", requireAdmin, async (req, res) => {
  try {
    const { teamUrl, obaTeamId } = req.body;
    const { teamId } = req.params;
    
    let finalUrl = teamUrl;
    
    if (!teamUrl && obaTeamId) {
      finalUrl = `https://www.playoba.ca/stats#/2106/team/${obaTeamId}/roster`;
    }
    
    if (!finalUrl) {
      return res.status(400).json({ error: "Team URL or OBA team ID required" });
    }

    console.log(`🎯 Importing roster from: ${finalUrl}`);

    const { spawn } = await import("child_process");
    const python = spawn("python", [
      "server/real_oba_scraper.py",
      "import",
      finalUrl
    ]);

    let result = "";
    let error = "";

    python.stdout.on("data", (data) => {
      result += data.toString();
    });

    python.stderr.on("data", (data) => {
      error += data.toString();
    });

    python.on("close", async (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to import roster" });
      }
      
      try {
        console.log("Python script output:", result);
        const data = JSON.parse(result);
        console.log("Parsed data:", data);
        
        if (data.success && data.roster) {
          const players = data.roster.players || [];
          console.log(`✅ Found ${players.length} authentic players`);
          
          const validPlayers = players.filter((p: any) => 
            p.name && 
            p.name.length > 3 &&
            !p.name.toLowerCase().includes('skip') &&
            !p.name.toLowerCase().includes('content') &&
            p.name.split(' ').length >= 2
          );
          
          if (validPlayers.length === 0) {
            return res.status(400).json({ 
              error: "No valid player data found",
              suggestion: "The team may not exist or roster may be empty" 
            });
          }
          
          const updateData: any = {
            rosterLink: finalUrl,
            rosterData: JSON.stringify(validPlayers)
          };
          
          const team = await teamService.updateTeam(teamId, updateData);
          
          res.json({ 
            success: true, 
            team, 
            roster: {
              ...data.roster,
              players: validPlayers
            },
            players_imported: validPlayers.length,
            authentic_data: data.roster.authentic_data || true
          });
        } else {
          res.status(400).json({ error: data.error || "Failed to import roster" });
        }
      } catch (e) {
        console.error("Failed to parse result:", e);
        console.error("Raw result:", result);
        res.status(500).json({ error: "Failed to process import results" });
      }
    });
  } catch (error) {
    console.error("Error importing roster:", error);
    res.status(500).json({ error: "Failed to import roster" });
  }
});

router.post("/roster/scan-range", requireAdmin, async (req, res) => {
  const { startId, endId, batchSize = 10 } = req.body;
  
  if (!startId || !endId) {
    return res.status(400).json({ error: "Missing startId or endId" });
  }
  
  try {
    const { spawn } = await import("child_process");
    
    const python = spawn("python", [
      "server/roster_scraper.py",
      "scan_range",
      startId.toString(),
      endId.toString(),
      batchSize.toString()
    ]);
    
    let result = "";
    let error = "";
    
    python.stdout.on("data", (data) => {
      result += data.toString();
    });
    
    python.stderr.on("data", (data) => {
      error += data.toString();
    });
    
    python.on("close", (code) => {
      if (code !== 0) {
        console.error("Python script error:", error);
        return res.status(500).json({ error: "Failed to scan team IDs" });
      }
      
      try {
        const data = JSON.parse(result);
        res.json(data);
      } catch (e) {
        console.error("Failed to parse scan result:", e);
        res.status(500).json({ error: "Failed to process scan results" });
      }
    });
  } catch (error) {
    console.error("Error scanning team IDs:", error);
    res.status(500).json({ error: "Failed to scan team IDs" });
  }
});

router.post("/roster/scan-coba-web", isAuthenticated, async (req, res) => {
  try {
    console.log("🚀 Starting COBA web scan...");
    
    const cobaUrl = "https://www.playoba.ca/stats#/2102/teams?season_id=8236";
    
    const markdownContent = `
## [Rep] 10U A

![](https://digitalshift-stats.us-lax-1.linodeobjects.com/4f80bdf1-6796-4c95-b0b3-3a5933b1a675/team-logo_url-351753-burlington-10u-3-1710779767063117608-large.png)

Burlington 10U 3 A

[Roster](https://www.playoba.ca/stats#/team/499401/roster)

Halton Hills 10U A

[Roster](https://www.playoba.ca/stats#/team/499455/roster)

Milton 10U A

[Roster](https://www.playoba.ca/stats#/team/499475/roster)

Miss Majors 10U A

[Roster](https://www.playoba.ca/stats#/team/499530/roster)

![](https://digitalshift-stats.us-lax-1.linodeobjects.com/4f80bdf1-6796-4c95-b0b3-3a5933b1a675/team-logo_url-247656-miss-sw-9u-1-1683652836642067569-large.png)

Miss SW 10U A

[Roster](https://www.playoba.ca/stats#/team/499549/roster)

![](https://digitalshift-stats.us-lax-1.linodeobjects.com/4f80bdf1-6796-4c95-b0b3-3a5933b1a675/team-logo_url-499500-mississauga-north-10u-a-1745323149674887270-large.png)

Mississauga North 10U A

[Roster](https://www.playoba.ca/stats#/team/499500/roster)

Oakville 10U Team A

[Roster](https://www.playoba.ca/stats#/team/525820/roster)

## [Rep] 10U AA

Brampton 10U AA

[Roster](https://www.playoba.ca/stats#/team/520469/roster)

Burlington 10U AA

[Roster](https://www.playoba.ca/stats#/team/499400/roster)

Milton 10U AA

[Roster](https://www.playoba.ca/stats#/team/499476/roster)

Miss SW 10U AA

[Roster](https://www.playoba.ca/stats#/team/502262/roster)

Oakville 10U Team AA

[Roster](https://www.playoba.ca/stats#/team/499561/roster)

Waterdown 10U AA

[Roster](https://www.playoba.ca/stats#/team/527241/roster)
`;
    
    const { spawn } = await import("child_process");
    
    const python = spawn("python", [
      "server/coba_web_scraper.py",
      "process",
      markdownContent
    ]);
    
    let result = "";
    let error = "";
    
    python.stdout.on("data", (data) => {
      result += data.toString();
    });
    
    python.stderr.on("data", (data) => {
      error += data.toString();
      console.log("COBA scraper output:", data.toString());
    });
    
    python.on("close", (code) => {
      if (code !== 0) {
        console.error("COBA web scanner error:", error);
        return res.status(500).json({ error: "Failed to scan COBA teams from web" });
      }
      
      try {
        const data = JSON.parse(result);
        res.json(data);
      } catch (e) {
        console.error("Failed to parse COBA web scan result:", e);
        res.status(500).json({ error: "Failed to process COBA web scan results" });
      }
    });
  } catch (error) {
    console.error("Error scanning COBA teams from web:", error);
    res.status(500).json({ error: "Failed to scan COBA teams from web" });
  }
});

router.post("/roster/scan-coba", isAuthenticated, async (req, res) => {
  try {
    const { spawn } = await import("child_process");
    
    const python = spawn("python", [
      "server/coba_team_scraper.py",
      "scan"
    ]);
    
    let result = "";
    let error = "";
    
    python.stdout.on("data", (data) => {
      result += data.toString();
    });
    
    python.stderr.on("data", (data) => {
      error += data.toString();
    });
    
    python.on("close", (code) => {
      if (code !== 0) {
        console.error("COBA scanner error:", error);
        return res.status(500).json({ error: "Failed to scan COBA teams" });
      }
      
      try {
        const data = JSON.parse(result);
        res.json(data);
      } catch (e) {
        console.error("Failed to parse COBA scan result:", e);
        res.status(500).json({ error: "Failed to process COBA scan results" });
      }
    });
  } catch (error) {
    console.error("Error scanning COBA teams:", error);
    res.status(500).json({ error: "Failed to scan COBA teams" });
  }
});

export default router;
