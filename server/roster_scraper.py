import requests
from bs4 import BeautifulSoup
from thefuzz import fuzz, process
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re

class OBARosterScraper:
    def __init__(self):
        self.base_url = "https://playoba.ca/stats"
        self.cache_duration_hours = 24
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for caching"""
        self.conn = sqlite3.connect('roster_cache.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS roster_cache (
                team_url TEXT PRIMARY KEY,
                roster_data TEXT,
                timestamp DATETIME
            )
        ''')
        self.conn.commit()
    
    def get_cached_roster(self, team_url: str) -> Optional[Dict]:
        """Check if we have a recent cached version of the roster"""
        self.cursor.execute(
            'SELECT roster_data, timestamp FROM roster_cache WHERE team_url = ?',
            (team_url,)
        )
        result = self.cursor.fetchone()
        
        if result:
            roster_data, timestamp = result
            cache_time = datetime.fromisoformat(timestamp)
            if datetime.now() - cache_time < timedelta(hours=self.cache_duration_hours):
                return json.loads(roster_data)
        
        return None
    
    def cache_roster(self, team_url: str, roster_data: Dict):
        """Cache the roster data"""
        self.cursor.execute(
            'INSERT OR REPLACE INTO roster_cache (team_url, roster_data, timestamp) VALUES (?, ?, ?)',
            (team_url, json.dumps(roster_data), datetime.now().isoformat())
        )
        self.conn.commit()
    
    def get_division_teams(self, affiliate: str, season: str, division: str) -> Dict[str, str]:
        """Get all teams in a division with their URLs"""
        # Construct the division URL
        # Example: https://playoba.ca/stats/sWE9qGCQ0r
        # This would need to be mapped from friendly names to actual IDs
        
        # For now, we'll return a mock implementation
        # In production, this would scrape the actual division page
        teams = {}
        
        # TODO: Implement actual scraping logic
        # This would involve:
        # 1. Navigating to the division page
        # 2. Finding all team links
        # 3. Extracting team names and URLs
        
        return teams
    
    def scrape_roster(self, team_url: str) -> Optional[Dict]:
        """Scrape the roster from a team page"""
        # Check cache first
        cached = self.get_cached_roster(team_url)
        if cached:
            return cached
        
        try:
            response = requests.get(team_url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find the roster table
            # This selector would need to be adjusted based on actual HTML structure
            roster_table = soup.find('table', {'class': 'roster-table'})
            if not roster_table:
                # Try alternative selectors
                roster_table = soup.find('table', id='roster')
                if not roster_table:
                    roster_table = soup.find('table')  # Last resort
            
            if not roster_table:
                return None
            
            players = []
            rows = roster_table.find_all('tr')[1:]  # Skip header row
            
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    # Extract player number and name
                    # Adjust indices based on actual table structure
                    player_number = cells[0].text.strip()
                    player_name = cells[1].text.strip()
                    
                    # Clean up the data
                    player_number = re.sub(r'\D', '', player_number)  # Keep only digits
                    
                    if player_name:  # Only add if name exists
                        players.append({
                            'number': player_number,
                            'name': player_name
                        })
            
            roster_data = {
                'team_url': team_url,
                'players': players,
                'scraped_at': datetime.now().isoformat()
            }
            
            # Cache the result
            self.cache_roster(team_url, roster_data)
            
            return roster_data
            
        except Exception as e:
            print(f"Error scraping roster: {e}")
            return None
    
    def find_best_team_match(self, teams: Dict[str, str], search_name: str) -> Optional[Tuple[str, str, float]]:
        """Find the best matching team name using fuzzy matching"""
        if not teams:
            return None
        
        # Use fuzzy matching to find the best match
        team_names = list(teams.keys())
        best_match = process.extractOne(search_name, team_names, scorer=fuzz.ratio)
        
        if best_match and best_match[1] >= 60:  # Minimum 60% similarity
            matched_name = best_match[0]
            return (matched_name, teams[matched_name], best_match[1])
        
        return None
    
    def get_roster_with_fuzzy_match(self, affiliate: str, season: str, division: str, team_name: str) -> Dict:
        """Main method to get roster with fuzzy team name matching"""
        # Get all teams in the division
        teams = self.get_division_teams(affiliate, season, division)
        
        if not teams:
            return {
                'success': False,
                'error': 'Could not retrieve teams for this division'
            }
        
        # Find the best match
        match_result = self.find_best_team_match(teams, team_name)
        
        if not match_result:
            return {
                'success': False,
                'error': 'No matching team found',
                'available_teams': list(teams.keys())
            }
        
        matched_name, team_url, confidence = match_result
        
        # Return match for confirmation
        return {
            'success': True,
            'needs_confirmation': True,
            'matched_team': matched_name,
            'confidence': confidence,
            'team_url': team_url,
            'search_term': team_name
        }
    
    def confirm_and_get_roster(self, team_url: str) -> Dict:
        """Get roster after user confirms the match"""
        roster_data = self.scrape_roster(team_url)
        
        if roster_data:
            return {
                'success': True,
                'roster': roster_data
            }
        else:
            return {
                'success': False,
                'error': 'Failed to scrape roster from the page'
            }

# Command-line interface
if __name__ == "__main__":
    import sys
    
    scraper = OBARosterScraper()
    
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No command specified"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 6:
            print(json.dumps({"success": False, "error": "Missing arguments for search"}))
            sys.exit(1)
        
        affiliate = sys.argv[2]
        season = sys.argv[3]
        division = sys.argv[4]
        team_name = sys.argv[5]
        
        result = scraper.get_roster_with_fuzzy_match(affiliate, season, division, team_name)
        print(json.dumps(result))
    
    elif command == "import":
        if len(sys.argv) < 3:
            print(json.dumps({"success": False, "error": "Missing team URL"}))
            sys.exit(1)
        
        team_url = sys.argv[2]
        result = scraper.confirm_and_get_roster(team_url)
        print(json.dumps(result))
    
    else:
        print(json.dumps({"success": False, "error": f"Unknown command: {command}"}))