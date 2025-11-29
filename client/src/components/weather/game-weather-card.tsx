import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudRain, Wind, Zap, Thermometer, Droplets, Eye, Sun, RefreshCw, AlertTriangle } from "lucide-react";
import type { WeatherForecast } from "@shared/schema";
import { format } from "date-fns";
import { queryClient } from "@/lib/queryClient";

interface GameWeatherCardProps {
  gameId: string;
  compact?: boolean;
  showRefresh?: boolean;
}

export function GameWeatherCard({ gameId, compact = false, showRefresh = false }: GameWeatherCardProps) {
  const { data: forecast, isLoading, error } = useQuery<WeatherForecast>({
    queryKey: [`/api/games/${gameId}/weather`],
    retry: false,
    refetchOnWindowFocus: false,
  });

  const handleRefresh = async () => {
    // Force refresh by calling the API with ?refresh=true parameter
    const response = await fetch(`/api/games/${gameId}/weather?refresh=true`, {
      credentials: 'include',
    });
    if (response.ok) {
      const data = await response.json();
      queryClient.setQueryData([`/api/games/${gameId}/weather`], data);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-gray-300">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            <span className="ml-2 text-sm text-gray-500">Loading weather...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !forecast) {
    return (
      <Card className="border-gray-300">
        <CardContent className="pt-6">
          <div className="text-center text-sm text-gray-500">
            <Cloud className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            Weather data unavailable
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasAnyAlert = forecast.hasLightningAlert || forecast.hasHeatAlert || forecast.hasWindAlert || forecast.hasPrecipitationAlert || forecast.hasSevereWeatherAlert;
  const temp = Math.round(parseFloat(forecast.temperatureF || "0"));
  const feelsLike = Math.round(parseFloat(forecast.feelsLikeF || "0"));
  const wind = Math.round(parseFloat(forecast.windSpeedMph || "0"));
  const windGust = Math.round(parseFloat(forecast.windGustMph || "0"));
  const precip = forecast.precipitationProbability || 0;
  const humidity = forecast.humidity || 0;

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-card dark:bg-gray-800 rounded-lg border">
        {hasAnyAlert && (
          <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
        )}
        <div className="flex items-center gap-2">
          <img 
            src={`https:${forecast.conditionIcon}`} 
            alt={forecast.condition || "Weather icon"} 
            className="w-10 h-10"
          />
          <div>
            <div className="font-semibold">{temp}°F</div>
            <div className="text-xs text-gray-500">{forecast.condition}</div>
          </div>
        </div>
        <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1">
            <CloudRain className="h-3 w-3" />
            {precip}%
          </span>
          <span className="flex items-center gap-1">
            <Wind className="h-3 w-3" />
            {wind}mph
          </span>
        </div>
        {showRefresh && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            className="ml-auto"
            data-testid="button-refresh-weather"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={`${hasAnyAlert ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' : 'border-gray-300'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Weather Forecast
          </CardTitle>
          {showRefresh && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRefresh}
              data-testid="button-refresh-weather"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        {forecast.fetchedAt && (
          <p className="text-xs text-gray-500">
            Updated: {format(new Date(forecast.fetchedAt), "MMM d, h:mm a")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Conditions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={`https:${forecast.conditionIcon}`} 
              alt={forecast.condition || "Weather icon"} 
              className="w-16 h-16"
            />
            <div>
              <div className="text-3xl font-bold">{temp}°F</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">{forecast.condition}</div>
              <div className="text-xs text-gray-500">Feels like {feelsLike}°F</div>
            </div>
          </div>
        </div>

        {/* Weather Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <CloudRain className="h-4 w-4 text-blue-500" />
            <div>
              <div className="text-xs text-gray-500">Precipitation</div>
              <div className="font-semibold">{precip}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Wind className="h-4 w-4 text-cyan-500" />
            <div>
              <div className="text-xs text-gray-500">Wind</div>
              <div className="font-semibold">{wind} mph</div>
              {windGust > wind && (
                <div className="text-xs text-gray-500">Gusts {windGust} mph</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-indigo-500" />
            <div>
              <div className="text-xs text-gray-500">Humidity</div>
              <div className="font-semibold">{humidity}%</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-gray-500" />
            <div>
              <div className="text-xs text-gray-500">Visibility</div>
              <div className="font-semibold">{parseFloat(forecast.visibility || "0").toFixed(1)} mi</div>
            </div>
          </div>

          {forecast.uvIndex && parseFloat(forecast.uvIndex) > 0 && (
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4 text-yellow-500" />
              <div>
                <div className="text-xs text-gray-500">UV Index</div>
                <div className="font-semibold">{parseFloat(forecast.uvIndex).toFixed(1)}</div>
              </div>
            </div>
          )}

          {forecast.heatIndexF && parseFloat(forecast.heatIndexF) > temp + 2 && (
            <div className="flex items-center gap-2">
              <Thermometer className="h-4 w-4 text-red-500" />
              <div>
                <div className="text-xs text-gray-500">Heat Index</div>
                <div className="font-semibold">{Math.round(parseFloat(forecast.heatIndexF))}°F</div>
              </div>
            </div>
          )}
        </div>

        {/* Safety Alerts */}
        {hasAnyAlert && forecast.alertMessage && (
          <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-semibold text-yellow-800 dark:text-yellow-200 mb-1">Safety Alerts</div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                  {forecast.alertMessage.split(" | ").map((alert, idx) => (
                    <div key={idx}>{alert}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Individual Alert Badges */}
        {hasAnyAlert && (
          <div className="flex flex-wrap gap-2">
            {forecast.hasLightningAlert && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Lightning Alert
              </Badge>
            )}
            {forecast.hasHeatAlert && (
              <Badge variant="destructive" className="flex items-center gap-1 bg-orange-500">
                <Thermometer className="h-3 w-3" />
                Heat Alert
              </Badge>
            )}
            {forecast.hasWindAlert && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Wind className="h-3 w-3" />
                High Wind
              </Badge>
            )}
            {forecast.hasPrecipitationAlert && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <CloudRain className="h-3 w-3" />
                Rain Likely
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
