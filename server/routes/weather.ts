import { Router } from "express";
import { weatherService } from "../services/weatherService";
import { gameService } from "../services/gameService";
import { diamondService } from "../services/diamondService";
import { requireOrgAdmin } from "../auth";

const router = Router();

// Get weather settings for organization
router.get('/organizations/:orgId/weather-settings', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const settings = await weatherService.getWeatherSettings(orgId);
    
    if (!settings) {
      const now = new Date();
      return res.json({
        id: `temp-${orgId}`,
        organizationId: orgId,
        apiKey: "",
        isEnabled: true,
        lightningRadiusMiles: 10,
        heatIndexThresholdF: 94,
        windSpeedThresholdMph: 25,
        precipitationThresholdPct: 70,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        apiKeyConfigured: false,
      });
    }

    const { apiKey, ...safeSettings } = settings;
    res.json({ ...safeSettings, apiKeyConfigured: true });
  } catch (error) {
    console.error("Error fetching weather settings:", error);
    res.status(500).json({ error: "Failed to fetch weather settings" });
  }
});

// Save weather settings
router.post('/organizations/:orgId/weather-settings', requireOrgAdmin, async (req: any, res) => {
  try {
    const { orgId } = req.params;
    const { apiKey, isEnabled, lightningRadiusMiles, heatIndexThresholdF, windSpeedThresholdMph, precipitationThresholdPct } = req.body;

    const existingSettings = await weatherService.getWeatherSettings(orgId);
    
    if (!apiKey && !existingSettings) {
      return res.status(400).json({ error: "API key is required for first-time setup" });
    }

    const updateData: any = {
      isEnabled,
      lightningRadiusMiles,
      heatIndexThresholdF,
      windSpeedThresholdMph,
      precipitationThresholdPct,
    };
    
    if (apiKey) {
      updateData.apiKey = apiKey;
    }

    const settings = await weatherService.saveWeatherSettings(orgId, updateData);

    const { apiKey: _, ...safeSettings } = settings;
    res.json({ ...safeSettings, apiKeyConfigured: true });
  } catch (error) {
    console.error("Error saving weather settings:", error);
    res.status(500).json({ error: "Failed to save weather settings" });
  }
});

// Get weather forecast for a specific game
router.get("/games/:gameId/weather", async (req: any, res) => {
  try {
    const { gameId } = req.params;
    const forceRefresh = req.query.refresh === 'true';

    const game = await gameService.getGame(gameId);
    if (!game) {
      return res.status(404).json({ error: "Game not found" });
    }

    if (!game.diamondId) {
      return res.status(400).json({ error: "Game has no diamond assigned" });
    }

    const diamond = await diamondService.getDiamond(game.diamondId);
    if (!diamond || !diamond.latitude || !diamond.longitude) {
      return res.status(400).json({ error: "Diamond has no location coordinates" });
    }

    const gameDateTime = new Date(`${game.date}T${game.time}`);

    const forecast = await weatherService.getGameWeatherForecast(
      gameId,
      game.tournamentId,
      parseFloat(diamond.latitude),
      parseFloat(diamond.longitude),
      gameDateTime,
      forceRefresh
    );

    if (!forecast) {
      return res.status(404).json({ error: "Weather forecast not available" });
    }

    res.json(forecast);
  } catch (error) {
    console.error("Error fetching game weather:", error);
    res.status(500).json({ error: "Failed to fetch weather forecast" });
  }
});

// Bulk fetch weather for multiple games in a tournament
router.post("/tournaments/:tournamentId/weather/bulk-fetch", requireOrgAdmin, async (req: any, res) => {
  try {
    const { tournamentId } = req.params;

    const allGames = await gameService.getGames(tournamentId);
    
    const gamesWithLocation = [];
    const skippedGames = [];
    
    for (const game of allGames) {
      if (!game.diamondId) {
        skippedGames.push({
          gameId: game.id,
          reason: "No diamond assigned",
        });
        continue;
      }
      
      const diamond = await diamondService.getDiamond(game.diamondId);
      if (!diamond) {
        skippedGames.push({
          gameId: game.id,
          reason: "Diamond not found",
        });
        continue;
      }
      
      if (!diamond.latitude || !diamond.longitude) {
        skippedGames.push({
          gameId: game.id,
          reason: "Diamond has no GPS coordinates",
        });
        continue;
      }
      
      const gameDateTime = new Date(`${game.date}T${game.time}`);
      gamesWithLocation.push({
        id: game.id,
        organizationId: tournamentId,
        latitude: parseFloat(diamond.latitude),
        longitude: parseFloat(diamond.longitude),
        dateTime: gameDateTime,
      });
    }

    const forecasts = await weatherService.bulkFetchGameForecasts(gamesWithLocation);

    res.json({
      success: true,
      totalGames: allGames.length,
      gamesWithWeather: forecasts.length,
      gamesSkipped: skippedGames.length,
      skippedGames,
      forecasts,
    });
  } catch (error) {
    console.error("Error bulk fetching weather:", error);
    res.status(500).json({ error: "Failed to bulk fetch weather" });
  }
});

// Get all games with weather alerts for a tournament
router.get("/tournaments/:tournamentId/weather/alerts", async (req: any, res) => {
  try {
    const { tournamentId } = req.params;

    const allGames = await gameService.getGames(tournamentId);

    const gamesWithAlerts = [];
    for (const game of allGames) {
      const forecast = await weatherService.getCachedForecast(game.id);
      if (forecast && (
        forecast.hasLightningAlert ||
        forecast.hasHeatAlert ||
        forecast.hasWindAlert ||
        forecast.hasPrecipitationAlert ||
        forecast.hasSevereWeatherAlert
      )) {
        let diamond = null;
        if (game.diamondId) {
          diamond = await diamondService.getDiamond(game.diamondId);
        }
        
        gamesWithAlerts.push({
          game,
          forecast,
          diamond: diamond ? {
            id: diamond.id,
            name: diamond.name,
            latitude: diamond.latitude,
            longitude: diamond.longitude,
          } : null,
        });
      }
    }

    res.json(gamesWithAlerts);
  } catch (error) {
    console.error("Error fetching weather alerts:", error);
    res.status(500).json({ error: "Failed to fetch weather alerts" });
  }
});

export default router;
