import { useState, useMemo, type CSSProperties } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Plus, MapPin, Navigation, Cloud, Zap, Thermometer, Wind, CloudRain, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import type { Team, Game, Pool, AgeDivision, Diamond, WeatherForecast } from '@shared/schema';

interface GamesTabProps {
  games: Game[];
  teams: Team[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
  diamonds: Diamond[];
  tournamentId?: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

interface GameWithWeather {
  game: Game;
  forecast: WeatherForecast;
}

export const GamesTab = ({ 
  games, 
  teams, 
  pools, 
  ageDivisions, 
  diamonds, 
  tournamentId,
  primaryColor,
  secondaryColor
}: GamesTabProps) => {
  const [divisionFilter, setDivisionFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  const brandStyle = {
    "--brand-primary": primaryColor || "#1a4d2e",
    "--brand-secondary": secondaryColor || "#ffffff",
  } as CSSProperties;

  const { data: gamesWithWeather = [] } = useQuery<GameWithWeather[]>({
    queryKey: tournamentId ? ['/api/tournaments', tournamentId, 'weather', 'alerts'] : ['weather-disabled'],
    enabled: !!tournamentId,
    refetchInterval: 10 * 60 * 1000,
  });

  const weatherMap = useMemo(() => {
    const map = new Map<string, WeatherForecast>();
    gamesWithWeather.forEach(({ game, forecast }) => {
      map.set(game.id, forecast);
    });
    return map;
  }, [gamesWithWeather]);

  const getSeverityBadge = (forecast: WeatherForecast) => {
    if (forecast.hasLightningAlert || forecast.hasSevereWeatherAlert) {
      return <Badge variant="destructive" className="text-xs">Critical</Badge>;
    }
    if (forecast.hasHeatAlert) {
      return <Badge variant="destructive" className="bg-orange-500 text-xs">Warning</Badge>;
    }
    if (forecast.hasWindAlert || forecast.hasPrecipitationAlert) {
      return <Badge variant="secondary" className="text-xs">Watch</Badge>;
    }
    return null;
  };

  const getDiamondStatusBadge = (diamond: Diamond | undefined) => {
    if (!diamond || diamond.status === 'open') return null;
    
    const statusConfig = {
      closed: { color: 'bg-red-500 text-white', label: 'Field Closed' },
      delayed: { color: 'bg-yellow-500 text-white', label: 'Delayed' },
      tbd: { color: 'bg-gray-500 text-white', label: 'Status TBD' },
    };
    
    const config = statusConfig[diamond.status as keyof typeof statusConfig];
    if (!config) return null;
    
    return (
      <div className="flex flex-col gap-1" data-testid={`diamond-status-${diamond.status}`}>
        <Badge className={`${config.color} text-xs`}>
          {config.label}
        </Badge>
        {diamond.statusMessage && (
          <span className="text-xs text-gray-600 italic">{diamond.statusMessage}</span>
        )}
      </div>
    );
  };

  const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || 'Unknown';
  
  const getTeamDivision = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return null;
    const pool = pools.find(p => p.id === team.poolId);
    if (!pool) return null;
    return ageDivisions.find(d => d.id === pool.ageDivisionId);
  };

  const getGameDivision = (game: Game) => {
    if (!game.homeTeamId) return null;
    return getTeamDivision(game.homeTeamId);
  };

  const divisionTeams = useMemo(() => {
    if (divisionFilter === 'all') return teams.sort((a, b) => a.name.localeCompare(b.name));
    
    const divisionPools = pools.filter(p => p.ageDivisionId === divisionFilter);
    const divisionTeamIds = new Set<string>();
    
    teams.forEach(team => {
      if (divisionPools.some(p => p.id === team.poolId)) {
        divisionTeamIds.add(team.id);
      }
    });
    
    games.forEach(game => {
      const gameDivision = getGameDivision(game);
      if (gameDivision?.id === divisionFilter) {
        if (game.homeTeamId) divisionTeamIds.add(game.homeTeamId);
        if (game.awayTeamId) divisionTeamIds.add(game.awayTeamId);
      }
    });
    
    return Array.from(divisionTeamIds)
      .map(id => teams.find(t => t.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name));
  }, [games, teams, pools, divisionFilter]);

  const filteredAndSortedGames = useMemo(() => {
    let filtered = games;

    if (divisionFilter !== 'all') {
      filtered = filtered.filter(game => {
        const division = getGameDivision(game);
        return division?.id === divisionFilter;
      });
    }

    if (teamFilter !== 'all') {
      filtered = filtered.filter(game => 
        game.homeTeamId === teamFilter || game.awayTeamId === teamFilter
      );
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      const dateCompare = dateA.getTime() - dateB.getTime();
      
      if (dateCompare !== 0) return dateCompare;
      
      const parseTime = (timeStr: string) => {
        if (!timeStr) return 0;
        const [time, period] = timeStr.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        
        let hour24 = hours || 0;
        if (period?.toLowerCase() === 'pm' && hours !== 12) {
          hour24 += 12;
        } else if (period?.toLowerCase() === 'am' && hours === 12) {
          hour24 = 0;
        }
        
        return hour24 * 60 + (minutes || 0);
      };
      
      return parseTime(a.time) - parseTime(b.time);
    });
  }, [games, divisionFilter, teamFilter]);

  const gamesByDivision = useMemo(() => {
    const grouped = new Map<string, { division: AgeDivision; games: Game[] }>();
    
    filteredAndSortedGames.forEach(game => {
      const division = getGameDivision(game);
      if (!division) return;
      
      if (!grouped.has(division.id)) {
        grouped.set(division.id, { division, games: [] });
      }
      grouped.get(division.id)!.games.push(game);
    });

    return Array.from(grouped.values()).sort((a, b) => 
      a.division.name.localeCompare(b.division.name)
    );
  }, [filteredAndSortedGames]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return 'TBD';
    try {
      if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) {
        return timeStr;
      }
      const [hours, minutes] = timeStr.split(':').map(s => parseInt(s));
      const period = hours >= 12 ? 'PM' : 'AM';
      const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch (e) {
      return timeStr;
    }
  };

  const targetDivisions = ageDivisions;

  return (
    <div className="p-6" style={brandStyle}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">Game Schedule</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Teams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Teams</SelectItem>
              {divisionTeams.map(team => (
                <SelectItem key={team!.id} value={team!.id}>
                  {team!.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="all" value={divisionFilter} onValueChange={(value) => {
        setDivisionFilter(value);
        setTeamFilter('all');
      }} className="w-full">
        <TabsList className="grid w-full bg-gray-100" style={{ gridTemplateColumns: `repeat(${targetDivisions.length + 1}, minmax(0, 1fr))` }}>
          <TabsTrigger 
            value="all" 
            className="text-sm md:text-base data-[state=active]:text-white"
            style={{ '--tw-bg-opacity': 1 } as CSSProperties}
            data-brand-primary={primaryColor || "#1a4d2e"}
          >
            All Divisions
          </TabsTrigger>
          {targetDivisions.map((division) => (
            <TabsTrigger 
              key={division.id} 
              value={division.id} 
              className="text-sm md:text-base data-[state=active]:text-white"
            >
              {division.name}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value={divisionFilter} className="mt-6">
          {gamesByDivision.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No games found for the selected filters.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {gamesByDivision.map(({ division, games }) => (
                <div key={division.id}>
                  <h4 
                    className="text-lg font-semibold mb-4 p-3 rounded-lg border-l-4"
                    style={{ 
                      backgroundColor: `color-mix(in srgb, ${primaryColor || "#1a4d2e"} 10%, white)`,
                      color: primaryColor || "#1a4d2e",
                      borderColor: primaryColor || "#1a4d2e"
                    }}
                  >
                    {division.name} Division
                  </h4>
                  <div className="space-y-2">
                    {games.map(game => {
                      const homeTeamName = getTeamName(game.homeTeamId);
                      const awayTeamName = getTeamName(game.awayTeamId);
                      const forecast = weatherMap.get(game.id);
                      
                      return (
                        <div key={game.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex flex-col space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{formatDate(game.date)}</p>
                                <p className="text-xs text-gray-600">
                                  {formatTime(game.time || game.location)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {forecast && getSeverityBadge(forecast)}
                                {game.status === 'completed' ? (
                                  <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                                    FINAL
                                  </span>
                                ) : (
                                  <span 
                                    className="px-2 py-1 text-xs font-medium rounded-full"
                                    style={{ 
                                      backgroundColor: `color-mix(in srgb, ${primaryColor || "#1a4d2e"} 15%, white)`,
                                      color: primaryColor || "#1a4d2e"
                                    }}
                                  >
                                    SCHEDULED
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {forecast && (
                              <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md border border-gray-200">
                                <div className="flex items-center gap-2">
                                  <img 
                                    src={`https:${forecast.conditionIcon}`} 
                                    alt={forecast.condition || "Weather"} 
                                    className="w-8 h-8"
                                  />
                                  <div>
                                    <div className="font-semibold text-sm">
                                      {Math.round(parseFloat(forecast.temperatureF || "0"))}°F
                                    </div>
                                    <div className="text-xs text-gray-600">{forecast.condition}</div>
                                  </div>
                                </div>
                                <div className="flex-1 flex items-center gap-3 text-xs text-gray-600">
                                  {forecast.hasPrecipitationAlert && (
                                    <div className="flex items-center gap-1" title={`${forecast.precipitationProbability}% chance of rain`}>
                                      <CloudRain className="w-3 h-3" />
                                      <span>{forecast.precipitationProbability}%</span>
                                    </div>
                                  )}
                                  {forecast.hasWindAlert && (
                                    <div className="flex items-center gap-1" title={`Wind: ${forecast.windSpeed} mph`}>
                                      <Wind className="w-3 h-3" />
                                      <span>{forecast.windSpeed} mph</span>
                                    </div>
                                  )}
                                  {forecast.hasLightningAlert && (
                                    <div className="flex items-center gap-1 text-red-600 font-medium" title="Lightning detected">
                                      <Zap className="w-3 h-3" />
                                      <span>Lightning</span>
                                    </div>
                                  )}
                                  {forecast.hasHeatAlert && (
                                    <div className="flex items-center gap-1 text-orange-600 font-medium" title={`Heat Index: ${forecast.heatIndex}°F`}>
                                      <Thermometer className="w-3 h-3" />
                                      <span>{forecast.heatIndex}°F</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {(() => {
                              const diamond = diamonds.find(d => d.id === game.diamondId);
                              const statusBadge = getDiamondStatusBadge(diamond);
                              if (!statusBadge) return null;
                              
                              return (
                                <div className="py-2 px-3 bg-red-50 border border-red-200 rounded-md">
                                  <div className="flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                    {statusBadge}
                                  </div>
                                </div>
                              );
                            })()}
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm truncate mr-2">{game.homeTeamId ? homeTeamName : 'TBD'}</span>
                                {game.status === 'completed' && (
                                  <span className="font-bold text-lg">{game.homeScore}</span>
                                )}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm truncate mr-2">{game.awayTeamId ? awayTeamName : 'TBD'}</span>
                                {game.status === 'completed' && (
                                  <span className="font-bold text-lg">{game.awayScore}</span>
                                )}
                              </div>
                            </div>
                            
                            {(() => {
                              const diamond = diamonds.find(d => d.id === game.diamondId);
                              const location = diamond?.location || game.location || "Location TBD";
                              const diamondName = game.subVenue || diamond?.name || 'Diamond TBD';

                              let directionsUrl = '';
                              let travelMode = '';

                              if (diamond && diamond.latitude && diamond.longitude) {
                                travelMode = 'walking';
                                directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${diamond.latitude},${diamond.longitude}&travelmode=${travelMode}`;
                              } else if (diamond && diamond.location) {
                                travelMode = 'driving';
                                directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(diamond.location)}&travelmode=${travelMode}`;
                              } else if (game.subVenue) {
                                travelMode = 'walking';
                                directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(game.subVenue)}&travelmode=${travelMode}`;
                              } else if (game.location) {
                                travelMode = 'driving';
                                directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(game.location)}&travelmode=${travelMode}`;
                              }

                              return (
                                <div className="pt-2 border-t border-gray-100">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <MapPin className="w-4 h-4 flex-shrink-0" />
                                      <div>
                                        <span className="font-medium">{diamondName}</span>
                                        <span className="text-xs text-gray-500 block">{location}</span>
                                      </div>
                                    </div>
                                    {directionsUrl && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs px-3 hover:opacity-80"
                                        style={{ 
                                          color: primaryColor || "#1a4d2e",
                                          borderColor: primaryColor || "#1a4d2e"
                                        }}
                                        onClick={() => window.open(directionsUrl, '_blank')}
                                      >
                                        <Navigation className="w-3 h-3 mr-1" />
                                        {travelMode === 'walking' ? "Walking" : "Driving"} Directions
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
