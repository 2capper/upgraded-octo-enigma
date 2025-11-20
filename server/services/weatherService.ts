import { db } from "../db";
import {
  organizationWeatherSettings,
  weatherForecasts,
  type OrganizationWeatherSettings,
  type WeatherForecast,
  type InsertWeatherForecast,
} from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";

// WeatherAPI.com response types
interface WeatherAPIResponse {
  location: {
    name: string;
    region: string;
    country: string;
    lat: number;
    lon: number;
    tz_id: string;
    localtime_epoch: number;
    localtime: string;
  };
  current?: {
    temp_f: number;
    condition: {
      text: string;
      icon: string;
      code: number;
    };
    wind_mph: number;
    wind_gust_mph: number;
    precip_in: number;
    humidity: number;
    feelslike_f: number;
    vis_miles: number;
    uv: number;
  };
  forecast?: {
    forecastday: Array<{
      date: string;
      date_epoch: number;
      day: {
        maxtemp_f: number;
        mintemp_f: number;
        avgtemp_f: number;
        maxwind_mph: number;
        totalprecip_in: number;
        avghumidity: number;
        daily_chance_of_rain: number;
        uv: number;
        condition: {
          text: string;
          icon: string;
          code: number;
        };
      };
      hour: Array<{
        time_epoch: number;
        time: string;
        temp_f: number;
        condition: {
          text: string;
          icon: string;
          code: number;
        };
        wind_mph: number;
        wind_gust_mph: number;
        precip_in: number;
        humidity: number;
        feelslike_f: number;
        vis_miles: number;
        uv: number;
        chance_of_rain: number;
      }>;
      astro: {
        sunrise: string;
        sunset: string;
      };
    }>;
  };
  alerts?: {
    alert: Array<{
      headline: string;
      msgtype: string;
      severity: string;
      urgency: string;
      areas: string;
      category: string;
      certainty: string;
      event: string;
      note: string;
      effective: string;
      expires: string;
      desc: string;
      instruction: string;
    }>;
  };
}

export class WeatherService {
  // Get weather settings for organization
  async getWeatherSettings(organizationId: string): Promise<OrganizationWeatherSettings | undefined> {
    const [settings] = await db
      .select()
      .from(organizationWeatherSettings)
      .where(eq(organizationWeatherSettings.organizationId, organizationId));
    return settings || undefined;
  }

  // Save or update weather settings
  async saveWeatherSettings(
    organizationId: string,
    settings: {
      apiKey: string;
      isEnabled?: boolean;
      lightningRadiusMiles?: number;
      heatIndexThresholdF?: number;
      windSpeedThresholdMph?: number;
      precipitationThresholdPct?: number;
    }
  ): Promise<OrganizationWeatherSettings> {
    const existing = await this.getWeatherSettings(organizationId);

    if (existing) {
      const [updated] = await db
        .update(organizationWeatherSettings)
        .set({
          ...settings,
          updatedAt: new Date(),
        })
        .where(eq(organizationWeatherSettings.organizationId, organizationId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(organizationWeatherSettings)
        .values({
          organizationId,
          apiKey: settings.apiKey,
          isEnabled: settings.isEnabled ?? true,
          lightningRadiusMiles: settings.lightningRadiusMiles ?? 10,
          heatIndexThresholdF: settings.heatIndexThresholdF ?? 94,
          windSpeedThresholdMph: settings.windSpeedThresholdMph ?? 25,
          precipitationThresholdPct: settings.precipitationThresholdPct ?? 70,
        })
        .returning();
      return created;
    }
  }

  // Fetch weather forecast from WeatherAPI.com
  async fetchForecast(
    apiKey: string,
    latitude: number,
    longitude: number,
    dateTime: Date
  ): Promise<WeatherAPIResponse> {
    const dateStr = dateTime.toISOString().split("T")[0]; // YYYY-MM-DD
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${latitude},${longitude}&dt=${dateStr}&alerts=yes&aqi=no`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`WeatherAPI error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // Calculate heat index (feels like temperature including humidity)
  calculateHeatIndex(tempF: number, humidity: number): number {
    // Simplified heat index calculation for temperatures above 80°F
    if (tempF < 80) return tempF;

    const T = tempF;
    const RH = humidity;

    // Rothfusz regression formula
    let HI = -42.379 + 
             2.04901523 * T + 
             10.14333127 * RH - 
             0.22475541 * T * RH - 
             6.83783e-3 * T * T - 
             5.481717e-2 * RH * RH + 
             1.22874e-3 * T * T * RH + 
             8.5282e-4 * T * RH * RH - 
             1.99e-6 * T * T * RH * RH;

    return Math.round(HI);
  }

  // Determine safety alerts based on thresholds
  determineSafetyAlerts(
    weatherData: WeatherAPIResponse,
    hourData: WeatherAPIResponse['forecast']['forecastday'][0]['hour'][0],
    thresholds: OrganizationWeatherSettings
  ): {
    hasLightningAlert: boolean;
    hasHeatAlert: boolean;
    hasWindAlert: boolean;
    hasPrecipitationAlert: boolean;
    hasSevereWeatherAlert: boolean;
    alertMessage: string;
  } {
    const alerts: string[] = [];
    let hasLightningAlert = false;
    let hasHeatAlert = false;
    let hasWindAlert = false;
    let hasPrecipitationAlert = false;
    let hasSevereWeatherAlert = false;

    // Check for weather alerts (thunderstorms, severe weather)
    if (weatherData.alerts?.alert && weatherData.alerts.alert.length > 0) {
      hasSevereWeatherAlert = true;
      for (const alert of weatherData.alerts.alert) {
        if (alert.event.toLowerCase().includes("thunderstorm") || 
            alert.event.toLowerCase().includes("lightning")) {
          hasLightningAlert = true;
          alerts.push(`⚡ LIGHTNING ALERT: ${alert.event} - Evacuate to safe shelter immediately`);
        } else {
          alerts.push(`⚠️ ${alert.event}: ${alert.headline}`);
        }
      }
    }

    // Check condition codes for lightning/thunderstorms
    const conditionCode = hourData.condition.code;
    const thunderstormCodes = [1087, 1273, 1276, 1279, 1282]; // Thunderstorm condition codes
    if (thunderstormCodes.includes(conditionCode)) {
      hasLightningAlert = true;
      if (!alerts.some(a => a.includes("LIGHTNING"))) {
        alerts.push(`⚡ LIGHTNING RISK: Thunderstorms forecast - Monitor conditions closely`);
      }
    }

    // Check heat index
    const heatIndex = this.calculateHeatIndex(hourData.temp_f, hourData.humidity);
    if (heatIndex >= thresholds.heatIndexThresholdF) {
      hasHeatAlert = true;
      alerts.push(`🌡️ HEAT ALERT: Heat index ${heatIndex}°F - High risk of heat illness. Increase hydration and breaks.`);
    }

    // Check wind speed
    const windSpeed = hourData.wind_gust_mph || hourData.wind_mph;
    if (windSpeed >= thresholds.windSpeedThresholdMph) {
      hasWindAlert = true;
      alerts.push(`💨 WIND ALERT: Gusts up to ${Math.round(windSpeed)} mph - Difficult playing conditions`);
    }

    // Check precipitation probability
    if (hourData.chance_of_rain >= thresholds.precipitationThresholdPct) {
      hasPrecipitationAlert = true;
      alerts.push(`🌧️ RAIN ALERT: ${hourData.chance_of_rain}% chance of rain - Monitor for delays`);
    }

    return {
      hasLightningAlert,
      hasHeatAlert,
      hasWindAlert,
      hasPrecipitationAlert,
      hasSevereWeatherAlert,
      alertMessage: alerts.join(" | "),
    };
  }

  // Find the closest hourly forecast to game time
  findClosestHourForecast(
    forecastDay: WeatherAPIResponse['forecast']['forecastday'][0],
    gameDateTime: Date
  ): WeatherAPIResponse['forecast']['forecastday'][0]['hour'][0] {
    const gameEpoch = Math.floor(gameDateTime.getTime() / 1000);
    
    let closestHour = forecastDay.hour[0];
    let minDiff = Math.abs(forecastDay.hour[0].time_epoch - gameEpoch);

    for (const hour of forecastDay.hour) {
      const diff = Math.abs(hour.time_epoch - gameEpoch);
      if (diff < minDiff) {
        minDiff = diff;
        closestHour = hour;
      }
    }

    return closestHour;
  }

  // Get or fetch weather forecast for a game
  async getGameWeatherForecast(
    gameId: string,
    organizationId: string,
    latitude: number,
    longitude: number,
    gameDateTime: Date,
    forceRefresh: boolean = false
  ): Promise<WeatherForecast | null> {
    // Check for cached forecast (within last 2 hours)
    if (!forceRefresh) {
      const twoHoursAgo = new Date();
      twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);

      const [cached] = await db
        .select()
        .from(weatherForecasts)
        .where(
          and(
            eq(weatherForecasts.gameId, gameId),
            gte(weatherForecasts.fetchedAt, twoHoursAgo)
          )
        )
        .orderBy(weatherForecasts.fetchedAt)
        .limit(1);

      if (cached) {
        return cached;
      }
    }

    // Get organization weather settings
    const settings = await this.getWeatherSettings(organizationId);
    if (!settings || !settings.isEnabled) {
      return null;
    }

    try {
      // Fetch fresh forecast from WeatherAPI
      const weatherData = await this.fetchForecast(
        settings.apiKey,
        latitude,
        longitude,
        gameDateTime
      );

      // Find the forecast day that matches game date
      const forecastDay = weatherData.forecast?.forecastday?.[0];
      if (!forecastDay) {
        throw new Error("No forecast data available for the specified date");
      }

      // Find the closest hourly forecast to game time
      const hourData = this.findClosestHourForecast(forecastDay, gameDateTime);

      // Calculate heat index
      const heatIndex = this.calculateHeatIndex(hourData.temp_f, hourData.humidity);

      // Determine safety alerts
      const safetyAlerts = this.determineSafetyAlerts(weatherData, hourData, settings);

      // Save forecast to database
      const forecastData: InsertWeatherForecast = {
        gameId,
        organizationId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        forecastTime: gameDateTime,
        temperatureF: hourData.temp_f.toString(),
        feelsLikeF: hourData.feelslike_f.toString(),
        heatIndexF: heatIndex.toString(),
        precipitationProbability: hourData.chance_of_rain,
        precipitationInches: hourData.precip_in.toString(),
        windSpeedMph: hourData.wind_mph.toString(),
        windGustMph: (hourData.wind_gust_mph || hourData.wind_mph).toString(),
        humidity: hourData.humidity,
        uvIndex: hourData.uv.toString(),
        visibility: hourData.vis_miles.toString(),
        condition: hourData.condition.text,
        conditionIcon: hourData.condition.icon,
        ...safetyAlerts,
        rawResponse: weatherData,
      };

      // Delete old forecasts for this game
      await db.delete(weatherForecasts).where(eq(weatherForecasts.gameId, gameId));

      // Insert new forecast
      const [forecast] = await db.insert(weatherForecasts).values(forecastData).returning();
      return forecast;
    } catch (error) {
      console.error("Error fetching weather forecast:", error);
      throw error;
    }
  }

  // Get cached weather forecast for a game
  async getCachedForecast(gameId: string): Promise<WeatherForecast | undefined> {
    const [forecast] = await db
      .select()
      .from(weatherForecasts)
      .where(eq(weatherForecasts.gameId, gameId))
      .orderBy(weatherForecasts.fetchedAt)
      .limit(1);
    return forecast || undefined;
  }

  // Bulk fetch weather for multiple games
  async bulkFetchGameForecasts(
    games: Array<{
      id: string;
      organizationId: string;
      latitude: number;
      longitude: number;
      dateTime: Date;
    }>
  ): Promise<WeatherForecast[]> {
    const forecasts: WeatherForecast[] = [];

    for (const game of games) {
      try {
        const forecast = await this.getGameWeatherForecast(
          game.id,
          game.organizationId,
          game.latitude,
          game.longitude,
          game.dateTime,
          false // Use cached if available
        );
        if (forecast) {
          forecasts.push(forecast);
        }
      } catch (error) {
        console.error(`Error fetching forecast for game ${game.id}:`, error);
        // Continue with other games
      }
    }

    return forecasts;
  }
}

export const weatherService = new WeatherService();
