import { Router } from "express";
import { diamondService } from "../services/diamondService";
import { gameService } from "../services/gameService";
import { tournamentService } from "../services/tournamentService";
import { teamService } from "../services/teamService";
import { smsService } from "../services/smsService";
import { isAuthenticated, requireOrgAdmin } from "../auth";

const router = Router();

router.get("/organizations/:organizationId/diamonds", requireOrgAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const diamonds = await diamondService.getDiamonds(organizationId);
    res.json(diamonds);
  } catch (error) {
    console.error("Error fetching diamonds:", error);
    res.status(500).json({ error: "Failed to fetch diamonds" });
  }
});

router.post("/organizations/:organizationId/diamonds", requireOrgAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const diamond = await diamondService.createDiamond({ ...req.body, organizationId });
    res.status(201).json(diamond);
  } catch (error) {
    console.error("Error creating diamond:", error);
    res.status(500).json({ error: "Failed to create diamond" });
  }
});

router.put("/diamonds/:id", requireOrgAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const diamond = await diamondService.updateDiamond(id, req.body);
    res.json(diamond);
  } catch (error) {
    console.error("Error updating diamond:", error);
    res.status(500).json({ error: "Failed to update diamond" });
  }
});

router.delete("/diamonds/:id", requireOrgAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await diamondService.deleteDiamond(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting diamond:", error);
    res.status(500).json({ error: "Failed to delete diamond" });
  }
});

router.get("/diamonds/:id/affected-games", requireOrgAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const diamond = await diamondService.getDiamond(id);
    if (!diamond) {
      return res.status(404).json({ error: "Diamond not found" });
    }
    
    const allGames = await gameService.getAllGames();
    const filteredGames = allGames.filter(game => {
      if (game.diamondId !== id) return false;
      
      if (startDate && game.date < (startDate as string)) return false;
      if (endDate && game.date > (endDate as string)) return false;
      
      return true;
    });

    const tournaments = await tournamentService.getTournaments(diamond.organizationId);
    const tournamentMap = new Map(tournaments.map(t => [t.id, t]));
    
    const teamsPromises = filteredGames.map(game => teamService.getTeams(game.tournamentId));
    const allTeamsArrays = await Promise.all(teamsPromises);
    const allTeams = allTeamsArrays.flat();
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    const gamesWithDetails = filteredGames.map(game => ({
      ...game,
      tournament: tournamentMap.get(game.tournamentId),
      homeTeam: game.homeTeamId ? teamMap.get(game.homeTeamId) : null,
      awayTeam: game.awayTeamId ? teamMap.get(game.awayTeamId) : null,
    }));

    res.json(gamesWithDetails || []);
  } catch (error) {
    console.error("Error fetching affected games:", error);
    res.status(500).json({ error: "Failed to fetch affected games" });
  }
});

router.post("/diamonds/:id/send-field-alert", requireOrgAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { games, startDate, endDate } = req.body;
    
    const diamond = await diamondService.getDiamond(id);
    if (!diamond) {
      return res.status(404).json({ error: "Diamond not found" });
    }

    const results = await smsService.sendFieldStatusAlert(
      diamond.organizationId,
      diamond.name,
      diamond.status,
      diamond.statusMessage,
      games,
      req.user.id
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      totalSent: successCount,
      totalFailed: failureCount,
      results,
    });
  } catch (error) {
    console.error("Error sending field alert:", error);
    res.status(500).json({ error: "Failed to send field alert" });
  }
});

router.get("/organizations/:organizationId/diamond-restrictions", isAuthenticated, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const restrictions = await diamondService.getDiamondRestrictions(organizationId);
    res.json(restrictions);
  } catch (error) {
    console.error("Error fetching diamond restrictions:", error);
    res.status(500).json({ error: "Failed to fetch diamond restrictions" });
  }
});

router.post("/organizations/:organizationId/diamond-restrictions", requireOrgAdmin, async (req, res) => {
  try {
    const { organizationId } = req.params;
    const restriction = await diamondService.createDiamondRestriction({
      ...req.body,
      organizationId,
    });
    res.status(201).json(restriction);
  } catch (error) {
    console.error("Error creating diamond restriction:", error);
    res.status(500).json({ error: "Failed to create diamond restriction" });
  }
});

router.put("/diamond-restrictions/:id", requireOrgAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const restriction = await diamondService.updateDiamondRestriction(id, req.body);
    res.json(restriction);
  } catch (error) {
    console.error("Error updating diamond restriction:", error);
    res.status(500).json({ error: "Failed to update diamond restriction" });
  }
});

router.delete("/diamond-restrictions/:id", requireOrgAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await diamondService.deleteDiamondRestriction(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting diamond restriction:", error);
    res.status(500).json({ error: "Failed to delete diamond restriction" });
  }
});

export default router;
