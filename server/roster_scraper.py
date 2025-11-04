import sys
import requests
from bs4 import BeautifulSoup, Tag
from thefuzz import fuzz, process
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re
import urllib.parse
from playwright.sync_api import sync_playwright

class OBARosterScraper:
    def __init__(self):
        self.base_url = "https://www.playoba.ca/stats"
        self.teams_url = "https://www.playoba.ca/stats/teams"
        self.cache_duration_hours = 24
        self.init_database()

    def _get_affiliate_info(self, affiliate: str) -> Optional[Dict[str, str]]:
        """Get the OBA affiliate ID and season ID from the affiliate name."""
        affiliate_map = {
            "ABA": {"id": "2101", "season_id": "8239"},
            "COBA": {"id": "2102", "season_id": "8236"},
            "EOBA": {"id": "2103", "season_id": "8241"},
            "HDBA": {"id": "2104", "season_id": "8242"},
            "ICBA": {"id": "2105", "season_id": "8243"},
            "LDBA": {"id": "2106", "season_id": "8244"},
            "NBBA": {"id": "2415", "season_id": "8245"},
            "NCBA": {"id": "2108", "season_id": "8246"},
            "NCOBA": {"id": "2107", "season_id": "8247"},
            "NDBA": {"id": "2109", "season_id": "8248"},
            "SCBA": {"id": "2110", "season_id": "8249"},
            "SPBA": {"id": "2111", "season_id": "8250"},
            "TBA": {"id": "2112", "season_id": "8251"},
            "WCBA": {"id": "2113", "season_id": "8252"},
            "WOBA": {"id": "2114", "season_id": "8253"},
            "YSBA": {"id": "2115", "season_id": "8254"},
        }
        return affiliate_map.get(affiliate)
    
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
    

    def _get_page_content(self, url: str, wait_for_selector: Optional[str] = None) -> str:
        """Fetches the page content using a headless browser."""
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            try:
                page.goto(url, wait_until='networkidle', timeout=30000)
                if wait_for_selector:
                    page.wait_for_selector(wait_for_selector, timeout=20000)
                content = page.content()
            finally:
                browser.close()
        return content

    def scrape_roster(self, team_url: str) -> Optional[Dict]:
        """Scrape roster data using live web scraping with Playwright."""
        cached = self.get_cached_roster(team_url)
        if cached:
            return cached

        try:
            html_content = self._get_page_content(team_url)
            soup = BeautifulSoup(html_content, 'html.parser')

            # The playoba.ca site seems to use h1 for the team name.
            team_name_tag = soup.select_one('h1')
            team_name = team_name_tag.get_text(strip=True) if team_name_tag else "Unknown Team"
            
            players = []
            # The player data is in a grid, likely using ag-grid.
            # A common pattern is that player names are in links inside the grid.
            player_links = soup.select('a[href*="/player/"]')
            
            player_names = set() # Use a set to avoid duplicate names
            for link in player_links:
                name = link.get_text(strip=True)
                if name:
                    player_names.add(name)

            for i, name in enumerate(sorted(list(player_names)), 1):
                players.append({"number": str(i), "name": name})

            roster_data = {
                'team_url': team_url,
                'team_name': team_name,
                'players': players,
                'scraped_at': datetime.now().isoformat(),
                'authentic_data': True,
                'scrape_method': 'live_web_scraping_playwright'
            }

            if players:
                self.cache_roster(team_url, roster_data)
                
            return roster_data

        except Exception as e:
            print(f"Error scraping roster from {team_url}: {e}", file=sys.stderr)
            return None
    
    def get_division_teams(self, affiliate: str, season: str, division: str) -> Dict[str, str]:
        """Get all teams in a division by navigating to the affiliate's team list page."""
        affiliate_info = self._get_affiliate_info(affiliate)
        if not affiliate_info:
            print(f"Unknown affiliate: {affiliate}", file=sys.stderr)
            return {}

        affiliate_id = affiliate_info["id"]
        season_id = affiliate_info["season_id"]
        
        search_url = f"{self.base_url}#/{affiliate_id}/teams?season_id={season_id}"

        try:
            html_content = self._get_page_content(search_url, wait_for_selector='div.teams-grid')
            soup = BeautifulSoup(html_content, 'html.parser')
            
            teams = {}
            team_divs = soup.select('div.teams-grid .team')
            
            for team_div in team_divs:
                link_tag = team_div.select_one('a[href*="/team/"]')
                team_name_div = team_div.select_one('.team-name')

                if link_tag and team_name_div:
                    href = link_tag.get('href')
                    team_name = team_name_div.get_text(strip=True)
                    
                    if href and division.lower() in team_name.lower():
                        full_url = urllib.parse.urljoin(self.base_url, str(href))
                        teams[team_name] = full_url
            
            return teams

        except Exception as e:
            print(f"Error getting division teams from {search_url}: {e}", file=sys.stderr)
            return {}
    
    def get_roster_with_fuzzy_match(self, affiliate: str, season: str, division: str, team_name: str) -> Dict:
        """Main method to get roster with fuzzy team name matching"""
        teams = self.get_division_teams(affiliate, season, division)
        
        if not teams:
            return {
                'success': False,
                'error': 'Could not retrieve any teams for this division. The website structure might have changed.'
            }
        
        # Use fuzzy matching to find the best match
        team_names = list(teams.keys())
        best_match = process.extractOne(team_name, team_names, scorer=fuzz.ratio)
        
        if not best_match or best_match[1] < 60:
            return {
                'success': False,
                'error': 'No matching team found',
                'available_teams': team_names
            }
        
        matched_name = best_match[0]
        confidence = best_match[1]
        team_url = teams[matched_name]
        
        return {
            'success': True,
            'needs_confirmation': True,
            'matched_team': matched_name,
            'confidence': confidence,
            'team_url': team_url,
            'search_term': team_name,
            'affiliate_used': affiliate
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
        print(json.dumps({"success": False, "error": "No command specified. Use 'search' or 'import'"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        if len(sys.argv) < 6:
            print(json.dumps({"success": False, "error": "Usage: search <affiliate> <season> <division> <team_name>"}))
            sys.exit(1)
        
        affiliate = sys.argv[2]
        season = sys.argv[3]
        division = sys.argv[4]
        team_name = sys.argv[5]
        
        result = scraper.get_roster_with_fuzzy_match(affiliate, season, division, team_name)
        print(json.dumps(result, indent=2))

    elif command == "import":
        if len(sys.argv) < 3:
            print(json.dumps({"success": False, "error": "Usage: import <team_url>"}))
            sys.exit(1)
        
        team_url = sys.argv[2]
        result = scraper.confirm_and_get_roster(team_url)
        print(json.dumps(result, indent=2))
    
    else:
        print(json.dumps({"success": False, "error": f"Unknown command: {command}. Use 'search' or 'import'"}))