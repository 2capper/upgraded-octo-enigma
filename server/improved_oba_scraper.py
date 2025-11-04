#!/usr/bin/env python3
"""
Improved OBA Roster Scraper
A more robust scraping solution that handles the OBA website without browser dependencies
"""

import requests
from bs4 import BeautifulSoup
import json
import sys
import re
import time
from typing import Dict, List, Optional, Tuple
from thefuzz import fuzz, process
import sqlite3
from datetime import datetime, timedelta

class ImprovedOBAScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
        self.base_url = "https://www.playoba.ca"
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
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS team_discovery (
                team_id TEXT PRIMARY KEY,
                team_name TEXT,
                affiliate TEXT,
                url TEXT,
                discovered_at DATETIME
            )
        ''')
        self.conn.commit()

    def discover_teams_by_range(self, start_id: int, end_id: int, affiliate: str = "2111") -> List[Dict]:
        """
        Discover teams by testing a range of team IDs.
        This uses direct URL testing rather than JavaScript parsing.
        """
        discovered_teams = []
        
        for team_id in range(start_id, end_id + 1):
            try:
                # Test multiple URL patterns that might work
                urls_to_test = [
                    f"https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster",
                    f"https://www.playoba.ca/stats/{affiliate}/team/{team_id}/roster",
                    f"https://www.playoba.ca/team/{team_id}/roster"
                ]
                
                for test_url in urls_to_test:
                    response = self.session.get(test_url, timeout=10)
                    if response.status_code == 200:
                        team_info = self.extract_team_info_from_response(response.text, team_id)
                        if team_info:
                            discovered_teams.append({
                                "team_id": str(team_id),
                                "team_name": team_info.get('name', f'Team {team_id}'),
                                "affiliate": affiliate,
                                "url": test_url,
                                "discovery_method": "url_testing"
                            })
                            # Cache this discovery
                            self.cache_team_discovery(str(team_id), team_info.get('name', ''), affiliate, test_url)
                            break
                
                # Rate limiting
                time.sleep(0.5)
                
            except Exception as e:
                print(f"Error testing team {team_id}: {e}")
                continue
        
        return discovered_teams
    
    def extract_team_info_from_response(self, html_content: str, team_id: int) -> Optional[Dict]:
        """Extract team information from HTML response"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Look for team name in various possible locations
            team_name_selectors = [
                'h1.team-name',
                '.team-header h1',
                '.page-title',
                'h1',
                '.team-title'
            ]
            
            team_name = None
            for selector in team_name_selectors:
                element = soup.select_one(selector)
                if element:
                    text = element.get_text(strip=True)
                    if text and text.lower() not in ['stats', 'team', 'roster', '']:
                        team_name = text
                        break
            
            # Look for roster data indicators
            roster_indicators = [
                '.roster-table',
                '.player-list',
                '.team-roster',
                'table',
                '.players'
            ]
            
            has_roster = any(soup.select_one(indicator) for indicator in roster_indicators)
            
            if team_name and has_roster:
                return {
                    'name': team_name,
                    'has_roster': True,
                    'team_id': team_id
                }
            
            return None
            
        except Exception as e:
            print(f"Error parsing HTML for team {team_id}: {e}")
            return None
    
    def cache_team_discovery(self, team_id: str, team_name: str, affiliate: str, url: str):
        """Cache discovered team information"""
        self.cursor.execute(
            'INSERT OR REPLACE INTO team_discovery (team_id, team_name, affiliate, url, discovered_at) VALUES (?, ?, ?, ?, ?)',
            (team_id, team_name, affiliate, url, datetime.now().isoformat())
        )
        self.conn.commit()
    
    def get_cached_teams(self) -> List[Dict]:
        """Get all cached team discoveries"""
        self.cursor.execute(
            'SELECT team_id, team_name, affiliate, url FROM team_discovery ORDER BY team_id'
        )
        results = self.cursor.fetchall()
        
        return [
            {
                'team_id': row[0],
                'team_name': row[1],
                'affiliate': row[2],
                'url': row[3]
            }
            for row in results
        ]
    
    def find_team_by_name(self, search_name: str, min_confidence: int = 60) -> Optional[Dict]:
        """Find a team by name using fuzzy matching against cached teams"""
        cached_teams = self.get_cached_teams()
        
        if not cached_teams:
            print("No cached teams found. Please run team discovery first.")
            return None
        
        team_names = [team['team_name'] for team in cached_teams]
        best_match = process.extractOne(search_name, team_names, scorer=fuzz.ratio)
        
        if best_match and best_match[1] >= min_confidence:
            matched_name = best_match[0]
            matched_team = next(team for team in cached_teams if team['team_name'] == matched_name)
            return {
                'success': True,
                'team': matched_team,
                'confidence': best_match[1],
                'search_term': search_name
            }
        
        return {
            'success': False,
            'error': 'No matching team found',
            'available_teams': team_names,
            'search_term': search_name
        }
    
    def extract_roster_data(self, team_url: str) -> Optional[Dict]:
        """Extract roster data from a team URL"""
        try:
            response = self.session.get(team_url, timeout=15)
            if response.status_code != 200:
                return None
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract team name
            team_name = self.extract_team_name_from_soup(soup)
            
            # Extract players
            players = self.extract_players_from_soup(soup)
            
            if not players:
                return None
            
            return {
                'success': True,
                'team_name': team_name,
                'url': team_url,
                'players': players,
                'extracted_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"Error extracting roster from {team_url}: {e}")
            return None
    
    def extract_team_name_from_soup(self, soup: BeautifulSoup) -> str:
        """Extract team name from BeautifulSoup object"""
        selectors = [
            'h1.team-name',
            '.team-header h1',
            '.page-title',
            'title',
            'h1'
        ]
        
        for selector in selectors:
            element = soup.select_one(selector)
            if element:
                text = element.get_text(strip=True)
                if text and text.lower() not in ['stats', 'team', 'roster', '']:
                    return text
        
        return "Unknown Team"
    
    def extract_players_from_soup(self, soup: BeautifulSoup) -> List[Dict]:
        """Extract player data from BeautifulSoup object"""
        players = []
        
        # Try different table structures
        table_selectors = [
            '.roster-table tbody tr',
            '.player-list .player',
            'table tbody tr',
            '.players .player-row'
        ]
        
        for selector in table_selectors:
            rows = soup.select(selector)
            if rows:
                for row in rows:
                    player_data = self.parse_player_row(row)
                    if player_data:
                        players.append(player_data)
                break
        
        return players
    
    def parse_player_row(self, row) -> Optional[Dict]:
        """Parse player data from a table row or player element"""
        try:
            # Try to extract common player fields
            cells = row.find_all(['td', 'div', 'span'])
            
            if len(cells) >= 2:
                # Basic extraction - adapt based on actual structure
                player_data = {
                    'name': '',
                    'number': '',
                    'position': ''
                }
                
                # Simple text extraction
                texts = [cell.get_text(strip=True) for cell in cells if cell.get_text(strip=True)]
                
                if texts:
                    # Assume first non-empty text is name or number
                    for text in texts:
                        if text.isdigit() and not player_data['number']:
                            player_data['number'] = text
                        elif not player_data['name'] and not text.isdigit():
                            player_data['name'] = text
                        elif not player_data['position'] and text not in [player_data['name'], player_data['number']]:
                            player_data['position'] = text
                
                if player_data['name'] or player_data['number']:
                    return player_data
            
            return None
            
        except Exception as e:
            print(f"Error parsing player row: {e}")
            return None

# Command line interface
def main():
    scraper = ImprovedOBAScraper()
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python improved_oba_scraper.py discover <start_id> <end_id> [affiliate]")
        print("  python improved_oba_scraper.py search <team_name>")
        print("  python improved_oba_scraper.py roster <team_url>")
        print("  python improved_oba_scraper.py list")
        return
    
    command = sys.argv[1]
    
    if command == "discover":
        if len(sys.argv) < 4:
            print("Usage: python improved_oba_scraper.py discover <start_id> <end_id> [affiliate]")
            return
        
        start_id = int(sys.argv[2])
        end_id = int(sys.argv[3])
        affiliate = sys.argv[4] if len(sys.argv) > 4 else "2111"
        
        print(f"Discovering teams in range {start_id}-{end_id} for affiliate {affiliate}...")
        teams = scraper.discover_teams_by_range(start_id, end_id, affiliate)
        
        print(f"\nDiscovered {len(teams)} teams:")
        for team in teams:
            print(f"  {team['team_id']}: {team['team_name']}")
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: python improved_oba_scraper.py search <team_name>")
            return
        
        team_name = " ".join(sys.argv[2:])
        result = scraper.find_team_by_name(team_name)
        print(json.dumps(result, indent=2))
    
    elif command == "roster":
        if len(sys.argv) < 3:
            print("Usage: python improved_oba_scraper.py roster <team_url>")
            return
        
        team_url = sys.argv[2]
        roster = scraper.extract_roster_data(team_url)
        print(json.dumps(roster, indent=2))
    
    elif command == "list":
        teams = scraper.get_cached_teams()
        print(f"Cached teams ({len(teams)}):")
        for team in teams:
            print(f"  {team['team_id']}: {team['team_name']}")
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()