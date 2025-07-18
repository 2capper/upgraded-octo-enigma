import { useState, useMemo } from 'react';
import { Calendar, Plus, MapPin, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Team, Game, Pool, AgeDivision } from '@/hooks/use-tournament-data';

interface GamesTabProps {
  games: Game[];
  teams: Team[];
  pools: Pool[];
  ageDivisions: AgeDivision[];
}

// Diamond coordinates for precise navigation within the complex
const DIAMOND_COORDINATES = {
  // CSV format names - these match exactly what's in the database
  'Bernie Amlin Field (BAF)': { lat: 42.208056, lng: -83.009443 },
  'Tom Wilson Field (TWF)': 'https://maps.app.goo.gl/uyVpvb9JM6nGs8M97', // Google Maps link
  'Optimist 1 (OPT1)': { lat: 42.208169, lng: -83.008209 },
  'Optimist 2 (OPT2)': { lat: 42.208594, lng: -83.007789 },
  'Donna Bombardier Diamond (DBD)': { lat: 42.209259, lng: -83.009798 },
};

export const GamesTab = ({ games, teams, pools, ageDivisions }: GamesTabProps) => {
  const [divisionFilter, setDivisionFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');

  const getTeamName = (teamId: string) => teams.find(t => t.id === teamId)?.name || 'Unknown';
  
  const getTeamDivision = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return null;
    const pool = pools.find(p => p.id === team.poolId);
    if (!pool) return null;
    return ageDivisions.find(d => d.id === pool.ageDivisionId);
  };

  const getGameDivision = (game: Game) => {
    // Get division from home team (both teams should be in same division)
    return getTeamDivision(game.homeTeamId);
  };

  // Get teams for selected division
  const divisionTeams = useMemo(() => {
    if (!divisionFilter) return [];
    
    // Get all teams in the selected division
    const divisionPools = pools.filter(p => p.ageDivisionId === divisionFilter);
    const divisionTeamIds = new Set<string>();
    
    // Get teams from pools
    teams.forEach(team => {
      if (divisionPools.some(p => p.id === team.poolId)) {
        divisionTeamIds.add(team.id);
      }
    });
    
    // Also include teams that play games in this division
    games.forEach(game => {
      const gameDivision = getGameDivision(game);
      if (gameDivision?.id === divisionFilter) {
        divisionTeamIds.add(game.homeTeamId);
        divisionTeamIds.add(game.awayTeamId);
      }
    });
    
    return Array.from(divisionTeamIds)
      .map(id => teams.find(t => t.id === id))
      .filter(Boolean)
      .sort((a, b) => a!.name.localeCompare(b!.name));
  }, [games, teams, pools, divisionFilter]);

  // Filter and sort games
  const filteredAndSortedGames = useMemo(() => {
    let filtered = games;

    // Filter by division (required)
    if (divisionFilter) {
      filtered = filtered.filter(game => {
        const division = getGameDivision(game);
        return division?.id === divisionFilter;
      });
    } else {
      // No division selected, show no games
      return [];
    }

    // Filter by team (optional)
    if (teamFilter !== 'all') {
      filtered = filtered.filter(game => 
        game.homeTeamId === teamFilter || game.awayTeamId === teamFilter
      );
    }

    // Sort by date and time
    return filtered.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.time.localeCompare(b.time);
    });
  }, [games, divisionFilter, teamFilter]);

  // Group games by division
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

  // Convert Central Time to Eastern Time
  const convertCentralToEastern = (timeStr: string) => {
    if (!timeStr) return 'TBD';
    
    try {
      // Parse the time (assuming format like "9:00 AM" or "14:30")
      const [time, period] = timeStr.split(' ');
      const timeParts = time.split(':');
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = timeParts[1] ? parseInt(timeParts[1]) : 0;
      
      let hour24 = hours;
      if (period?.toLowerCase() === 'pm' && hours !== 12) {
        hour24 += 12;
      } else if (period?.toLowerCase() === 'am' && hours === 12) {
        hour24 = 0;
      }
      
      // Add 1 hour for Eastern Time (Eastern is 1 hour ahead of Central)
      hour24 = (hour24 + 1) % 24;
      
      // Convert back to 12-hour format
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const newPeriod = hour24 >= 12 ? 'PM' : 'AM';
      
      return `${hour12}:${minutes.toString().padStart(2, '0')} ${newPeriod} ET`;
    } catch (e) {
      return timeStr; // Return original if parsing fails
    }
  };

  const getDirectionsUrl = (diamond: string) => {
    const location = DIAMOND_COORDINATES[diamond as keyof typeof DIAMOND_COORDINATES];
    if (!location) {
      // Fallback to diamond name if coordinates not found
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(diamond)}&travelmode=walking`;
    }
    
    // Handle both coordinate objects and Google Maps links
    if (typeof location === 'string') {
      // Direct Google Maps link
      return location;
    } else {
      // Coordinate object format
      return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}&travelmode=walking`;
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-4 md:mb-0">Game Schedule</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={divisionFilter} onValueChange={(value) => {
            setDivisionFilter(value);
            setTeamFilter('all'); // Reset team filter when division changes
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select Division" />
            </SelectTrigger>
            <SelectContent>
              {ageDivisions.map(division => (
                <SelectItem key={division.id} value={division.id}>
                  {division.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {divisionFilter && (
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
          )}

          <Button className="bg-[var(--falcons-green)] text-white hover:bg-[var(--falcons-dark-green)]">
            <Plus className="w-4 h-4 mr-2" />
            Add Game
          </Button>
        </div>
      </div>

      {!divisionFilter ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Please select a division to view games.</p>
        </div>
      ) : gamesByDivision.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No games found for the selected filters.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {gamesByDivision.map(({ division, games }) => (
            <div key={division.id}>
              <h4 className="text-lg font-semibold text-gray-900 mb-4 bg-gray-50 p-3 rounded-lg">
                {division.name} Division
              </h4>
              <div className="space-y-2">
                {games.map(game => {
                  const homeTeamName = getTeamName(game.homeTeamId);
                  const awayTeamName = getTeamName(game.awayTeamId);
                  
                  return (
                    <div key={game.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex flex-col md:flex-row md:items-center gap-4">
                        {/* Date and Time */}
                        <div className="flex-shrink-0 w-32">
                          <p className="font-medium text-gray-900">{formatDate(game.date)}</p>
                          <p className="text-sm text-gray-600">
                            {/* Use game.time after reimport, game.location for old data */}
                            {convertCentralToEastern(game.time || game.location)}
                          </p>
                        </div>
                        
                        {/* Teams and Score */}
                        <div className="flex-grow">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{homeTeamName}</span>
                            {game.status === 'completed' ? (
                              <span className="font-bold text-lg">{game.homeScore}</span>
                            ) : (
                              <span className="text-gray-400">vs</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{awayTeamName}</span>
                            {game.status === 'completed' && (
                              <span className="font-bold text-lg">{game.awayScore}</span>
                            )}
                          </div>
                        </div>
                        
                        {/* Venue and Directions */}
                        <div className="flex-shrink-0 text-right">
                          <div className="text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-2 justify-end">
                              <MapPin className="w-4 h-4" />
                              <span className="font-medium">{game.subVenue || 'Diamond TBD'}</span>
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              3215 Forest Glade Dr
                            </div>
                          </div>
                          {game.subVenue && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              onClick={() => window.open(getDirectionsUrl(game.subVenue), '_blank')}
                            >
                              <Navigation className="w-3 h-3 mr-1" />
                              Get Directions
                            </Button>
                          )}
                        </div>

                        {/* Status */}
                        <div className="flex-shrink-0">
                          {game.status === 'completed' ? (
                            <span className="px-3 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                              FINAL
                            </span>
                          ) : (
                            <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                              SCHEDULED
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
