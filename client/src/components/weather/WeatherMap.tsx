import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Thermometer, Wind, CloudRain, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { Game, WeatherForecast } from "@shared/schema";
import 'leaflet/dist/leaflet.css';

interface Diamond {
  id: string;
  name: string;
  latitude: string | null;
  longitude: string | null;
}

interface GameWithWeather {
  game: Game;
  forecast: WeatherForecast;
  diamond: Diamond | null;
}

interface WeatherMapProps {
  gamesWithAlerts: GameWithWeather[];
}

export function WeatherMap({ gamesWithAlerts }: WeatherMapProps) {
  // Filter out games without diamond coordinates
  const gamesWithLocation = gamesWithAlerts.filter(
    item => item.diamond && item.diamond.latitude && item.diamond.longitude
  );

  if (gamesWithLocation.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold mb-2">No Locations Available</h3>
            <p className="text-gray-500">
              Games with weather alerts don't have GPS coordinates assigned to their diamonds.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate center point (average of all coordinates)
  const avgLat = gamesWithLocation.reduce(
    (sum, item) => sum + parseFloat(item.diamond!.latitude!), 0
  ) / gamesWithLocation.length;
  const avgLng = gamesWithLocation.reduce(
    (sum, item) => sum + parseFloat(item.diamond!.longitude!), 0
  ) / gamesWithLocation.length;

  // Helper to get severity color for markers
  const getMarkerColor = (forecast: WeatherForecast) => {
    if (forecast.hasLightningAlert || forecast.hasSevereWeatherAlert) {
      return '#dc2626'; // red-600
    }
    if (forecast.hasHeatAlert) {
      return '#ea580c'; // orange-600
    }
    if (forecast.hasWindAlert || forecast.hasPrecipitationAlert) {
      return '#ca8a04'; // yellow-600
    }
    return '#6b7280'; // gray-500
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

  return (
    <div className="h-[600px] w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <MapContainer
        center={[avgLat, avgLng]}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {gamesWithLocation.map((item) => {
          const lat = parseFloat(item.diamond!.latitude!);
          const lng = parseFloat(item.diamond!.longitude!);
          const color = getMarkerColor(item.forecast);
          
          // Create custom colored marker icon
          const markerIcon = new Icon({
            iconUrl: `data:image/svg+xml;base64,${btoa(`
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32">
                <path fill="${color}" stroke="white" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="3" fill="white"/>
              </svg>
            `)}`,
            iconSize: [32, 32],
            iconAnchor: [16, 32],
            popupAnchor: [0, -32],
          });

          return (
            <Marker
              key={item.game.id}
              position={[lat, lng]}
              icon={markerIcon}
            >
              <Popup>
                <div className="min-w-[250px] p-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h3 className="font-semibold text-base">{item.diamond!.name}</h3>
                      <p className="text-sm text-gray-600">
                        {format(new Date(`${item.game.date}T${item.game.time}`), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    {getSeverityBadge(item.forecast)}
                  </div>
                  
                  <div className="space-y-1 text-sm mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {item.forecast.temperatureF ? `${Math.round(parseFloat(item.forecast.temperatureF))}°F` : 'N/A'} / {item.forecast.condition || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {item.forecast.hasLightningAlert && (
                    <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
                      <Zap className="h-4 w-4" />
                      <span>Lightning Risk</span>
                    </div>
                  )}
                  {item.forecast.hasHeatAlert && (
                    <div className="flex items-center gap-2 text-orange-600 text-sm mb-1">
                      <Thermometer className="h-4 w-4" />
                      <span>
                        Heat Index: {item.forecast.heatIndexF != null 
                          ? `${Math.round(parseFloat(item.forecast.heatIndexF))}°F` 
                          : 'N/A'}
                      </span>
                    </div>
                  )}
                  {item.forecast.hasWindAlert && (
                    <div className="flex items-center gap-2 text-yellow-600 text-sm mb-1">
                      <Wind className="h-4 w-4" />
                      <span>
                        Wind: {item.forecast.windSpeedMph != null 
                          ? `${Math.round(parseFloat(item.forecast.windSpeedMph))} mph` 
                          : 'N/A'}
                      </span>
                    </div>
                  )}
                  {item.forecast.hasPrecipitationAlert && (
                    <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                      <CloudRain className="h-4 w-4" />
                      <span>
                        Rain: {item.forecast.precipitationProbability != null 
                          ? `${item.forecast.precipitationProbability}%` 
                          : 'N/A'}
                      </span>
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
