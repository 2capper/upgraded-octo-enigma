#!/usr/bin/env python3

import requests
import re
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs
from thefuzz import fuzz, process
from bs4 import BeautifulSoup

class RealOBAScraper:
    """Real OBA scraper that fetches authentic data from playoba.ca"""
    
    def __init__(self, cache_file: str = "roster_cache.db"):
        self.cache_file = cache_file
        self.init_cache()
    
    def init_cache(self):
        """Initialize SQLite cache for roster data"""
        conn = sqlite3.connect(self.cache_file)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS roster_cache (
                team_url TEXT PRIMARY KEY,
                roster_data TEXT,
                scraped_at TEXT
            )
        ''')
        conn.commit()
        conn.close()
    
    def get_cached_roster(self, team_url: str) -> Optional[Dict]:
        """Get cached roster data"""
        conn = sqlite3.connect(self.cache_file)
        cursor = conn.cursor()
        cursor.execute('SELECT roster_data FROM roster_cache WHERE team_url = ?', (team_url,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return json.loads(result[0])
        return None
    
    def cache_roster(self, team_url: str, roster_data: Dict):
        """Cache roster data"""
        conn = sqlite3.connect(self.cache_file)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO roster_cache (team_url, roster_data, scraped_at)
            VALUES (?, ?, ?)
        ''', (team_url, json.dumps(roster_data), datetime.now().isoformat()))
        conn.commit()
        conn.close()
    
    def extract_team_id_from_url(self, url: str) -> Optional[str]:
        """Extract team ID from OBA URL"""
        match = re.search(r'/team/(\d+)/', url)
        return match.group(1) if match else None
    
    def scrape_roster_from_web(self, team_url: str) -> Optional[Dict]:
        """Scrape roster data directly from OBA website using requests and BeautifulSoup"""
        try:
            # Extract team ID from URL
            team_id = self.extract_team_id_from_url(team_url)
            if not team_id:
                return None
            
            # Convert hash URL to direct roster URL
            direct_url = f"https://www.playoba.ca/stats/teams/{team_id}/roster"
            
            # Make request with proper headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            response = requests.get(direct_url, headers=headers, timeout=10)
            response.raise_for_status()
            
            # Parse HTML content
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract team name from h1 or title
            team_name = "Unknown Team"
            h1_tag = soup.find('h1')
            if h1_tag:
                team_name = h1_tag.get_text(strip=True)
            
            # Extract player data from roster table
            players = []
            
            # Look for roster table - OBA uses different table structures
            tables = soup.find_all('table')
            
            for table in tables:
                rows = table.find_all('tr')
                for row in rows[1:]:  # Skip header row
                    cells = row.find_all(['td', 'th'])
                    if len(cells) >= 2:
                        # Extract player name (usually in second column)
                        name_cell = cells[1] if len(cells) > 1 else cells[0]
                        player_name = name_cell.get_text(strip=True)
                        
                        # Skip empty or header rows
                        if player_name and player_name not in ['Name', 'Player', '#']:
                            # Extract number if available (usually first column)
                            number = ""
                            if len(cells) > 0:
                                number_text = cells[0].get_text(strip=True)
                                if number_text.isdigit():
                                    number = number_text
                            
                            players.append({
                                "number": number,
                                "name": player_name
                            })
            
            return {
                'team_url': team_url,
                'team_name': team_name,
                'players': players,
                'scraped_at': datetime.now().isoformat(),
                'authentic_data': True,
                'scrape_method': 'web_requests'
            }
            
        except Exception as e:
            print(f"Error scraping {team_url}: {str(e)}")
            return None
    
    def scrape_roster(self, team_url: str) -> Optional[Dict]:
        """Main method to scrape roster data with caching"""
        # Check cache first
        cached_data = self.get_cached_roster(team_url)
        if cached_data:
            return cached_data
        
        # Try web scraping
        roster_data = self.scrape_roster_from_web(team_url)
        
        if roster_data and roster_data.get('players'):
            # Cache successful results
            self.cache_roster(team_url, roster_data)
            return roster_data
        
        # Return empty result for failed scrapes
        team_id = self.extract_team_id_from_url(team_url)
        return {
            'team_url': team_url,
            'team_name': f"Unable to scrape team {team_id}",
            'players': [],
            'scraped_at': datetime.now().isoformat(),
            'authentic_data': False,
            'error': 'Scraping failed'
        }

if __name__ == "__main__":
    # Test the scraper
    scraper = RealOBAScraper()
    
    test_urls = [
        "https://www.playoba.ca/stats#/2106/team/500413/roster",
        "https://www.playoba.ca/stats#/2106/team/500415/roster"
    ]
    
    for url in test_urls:
        print(f"\nTesting: {url}")
        result = scraper.scrape_roster(url)
        if result:
            print(f"Team: {result['team_name']}")
            print(f"Players: {len(result['players'])}")
            for player in result['players'][:3]:
                print(f"  {player}")