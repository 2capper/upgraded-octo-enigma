import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Cloud, RefreshCw, Zap, Thermometer, Wind, CloudRain, AlertTriangle, Calendar, MapPin, Clock } from "lucide-react";
import { format } from "date-fns";
import type { Game, WeatherForecast } from "@shared/schema";

interface GameWithWeather {
  game: Game;
  forecast: WeatherForecast;
}

export default function WeatherDashboard() {
  const { orgId, tournamentId } = useParams<{ orgId: string; tournamentId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: gamesWithAlerts, isLoading } = useQuery<GameWithWeather[]>({
    queryKey: [`/api/tournaments/${tournamentId}/weather/alerts`],
    enabled: !!tournamentId,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const bulkFetchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/tournaments/${tournamentId}/weather/bulk-fetch`, {
        method: "POST",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/tournaments/${tournamentId}/weather/alerts`] });
      toast({
        title: "Weather updated",
        description: `Updated weather for ${data.gamesWithWeather} of ${data.totalGames} games`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update weather",
        variant: "destructive",
      });
    },
  });

  const getSeverityColor = (forecast: WeatherForecast) => {
    if (forecast.hasLightningAlert || forecast.hasSevereWeatherAlert) {
      return "border-red-500 bg-red-50 dark:bg-red-950/20";
    }
    if (forecast.hasHeatAlert) {
      return "border-orange-500 bg-orange-50 dark:bg-orange-950/20";
    }
    if (forecast.hasWindAlert || forecast.hasPrecipitationAlert) {
      return "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
    }
    return "border-gray-300";
  };

  const getSeverityBadge = (forecast: WeatherForecast) => {
    if (forecast.hasLightningAlert || forecast.hasSevereWeatherAlert) {
      return <Badge variant="destructive">Critical</Badge>;
    }
    if (forecast.hasHeatAlert) {
      return <Badge variant="destructive" className="bg-orange-500">Warning</Badge>;
    }
    if (forecast.hasWindAlert || forecast.hasPrecipitationAlert) {
      return <Badge variant="secondary">Watch</Badge>;
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Button
        variant="ghost"
        onClick={() => navigate(`/org/${orgId}/tournaments/tournament/${tournamentId}`)}
        className="mb-4"
        data-testid="button-back"
      >
        ← Back to Admin
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Cloud className="h-8 w-8" />
            Weather Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor weather conditions and safety alerts for all games
          </p>
        </div>
        <Button
          onClick={() => bulkFetchMutation.mutate()}
          disabled={bulkFetchMutation.isPending}
          data-testid="button-refresh-all"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${bulkFetchMutation.isPending ? 'animate-spin' : ''}`} />
          {bulkFetchMutation.isPending ? "Updating..." : "Update All"}
        </Button>
      </div>

      {!gamesWithAlerts || gamesWithAlerts.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Cloud className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold mb-2">No Active Weather Alerts</h3>
              <p className="text-gray-500 mb-4">
                All games have favorable weather conditions
              </p>
              <Button
                onClick={() => bulkFetchMutation.mutate()}
                disabled={bulkFetchMutation.isPending}
                data-testid="button-fetch-weather"
              >
                Fetch Weather for All Games
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              <div>
                <div className="font-semibold text-yellow-800 dark:text-yellow-200">
                  {gamesWithAlerts.length} {gamesWithAlerts.length === 1 ? "game" : "games"} with weather alerts
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Monitor conditions closely and be prepared to delay or cancel if necessary
                </div>
              </div>
            </div>
          </div>

          {gamesWithAlerts.map(({ game, forecast }) => (
            <Card key={game.id} className={getSeverityColor(forecast)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">
                        Game {game.id}
                      </CardTitle>
                      {getSeverityBadge(forecast)}
                    </div>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(game.date), "EEEE, MMMM d, yyyy")}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {game.time}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {game.location} {game.subVenue && `- ${game.subVenue}`}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <img 
                      src={`https:${forecast.conditionIcon}`} 
                      alt={forecast.condition || "Weather icon"} 
                      className="w-12 h-12"
                    />
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {Math.round(parseFloat(forecast.temperatureF || "0"))}°F
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {forecast.condition}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Alert Messages */}
                {forecast.alertMessage && (
                  <div className="mb-4 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1 text-sm">
                        {forecast.alertMessage.split(" | ").map((alert, idx) => (
                          <div key={idx} className="font-medium">{alert}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Weather Details */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CloudRain className={`h-4 w-4 ${forecast.hasPrecipitationAlert ? 'text-red-500' : 'text-blue-500'}`} />
                    <div>
                      <div className="text-xs text-gray-500">Precipitation</div>
                      <div className="font-semibold">{forecast.precipitationProbability}%</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Wind className={`h-4 w-4 ${forecast.hasWindAlert ? 'text-red-500' : 'text-cyan-500'}`} />
                    <div>
                      <div className="text-xs text-gray-500">Wind</div>
                      <div className="font-semibold">
                        {Math.round(parseFloat(forecast.windSpeedMph || "0"))} mph
                      </div>
                    </div>
                  </div>

                  {forecast.heatIndexF && parseFloat(forecast.heatIndexF) > parseFloat(forecast.temperatureF || "0") + 2 && (
                    <div className="flex items-center gap-2">
                      <Thermometer className={`h-4 w-4 ${forecast.hasHeatAlert ? 'text-red-500' : 'text-orange-500'}`} />
                      <div>
                        <div className="text-xs text-gray-500">Heat Index</div>
                        <div className="font-semibold">
                          {Math.round(parseFloat(forecast.heatIndexF))}°F
                        </div>
                      </div>
                    </div>
                  )}

                  {forecast.hasLightningAlert && (
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-red-500" />
                      <div>
                        <div className="text-xs text-gray-500">Lightning</div>
                        <div className="font-semibold text-red-600">Detected</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Last Updated */}
                {forecast.fetchedAt && (
                  <div className="mt-4 text-xs text-gray-500">
                    Last updated: {format(new Date(forecast.fetchedAt), "MMM d, h:mm a")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
