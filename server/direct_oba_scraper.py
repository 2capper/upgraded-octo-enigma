#!/usr/bin/env python3
"""
Direct OBA Scraper - Uses known team patterns and direct API calls
Based on the successful discovery of Forest Glade teams: 500718, 500719, 500726
"""

import requests
import json
import sys
import time
from typing import Dict, List, Optional
from thefuzz import fuzz, process
import sqlite3
from datetime import datetime

class DirectOBAScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://www.playoba.ca/',
        })
        
        # Known working teams for validation
        self.known_teams = {
            "500718": "11U HS Forest Glade",
            "500719": "13U HS Forest Glade", 
            "500726": "18U HS Forest Glade"
        }
        
        # Common affiliates and their IDs
        self.affiliates = {
            "SPBA": "2111",
            "COBA": "2102", 
            "LDBA": "2106",
            "NCOBA": "2107"
        }
        
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database for caching"""
        self.conn = sqlite3.connect('oba_teams.db')
        self.cursor = self.conn.cursor()
        
        # Create teams table
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS teams (
                team_id TEXT PRIMARY KEY,
                team_name TEXT,
                affiliate TEXT,
                age_group TEXT,
                roster_data TEXT,
                last_updated DATETIME
            )
        ''')
        
        # Insert known teams
        for team_id, team_name in self.known_teams.items():
            self.cursor.execute(
                'INSERT OR REPLACE INTO teams (team_id, team_name, affiliate, age_group, last_updated) VALUES (?, ?, ?, ?, ?)',
                (team_id, team_name, 'SPBA', self.extract_age_group(team_name), datetime.now().isoformat())
            )
        
        self.conn.commit()
    
    def extract_age_group(self, team_name: str) -> str:
        """Extract age group from team name"""
        import re
        age_match = re.search(r'(\d+U)', team_name.upper())
        return age_match.group(1) if age_match else 'Unknown'
    
    def test_direct_api_endpoints(self, team_id: str) -> Optional[Dict]:
        """Test various API endpoints that might return team data"""
        
        api_patterns = [
            f"https://www.playoba.ca/api/teams/{team_id}",
            f"https://www.playoba.ca/api/team/{team_id}/roster",
            f"https://www.playoba.ca/stats/api/teams/{team_id}",
            f"https://www.playoba.ca/stats/api/team/{team_id}",
        ]
        
        for affiliate_id in ["2111", "2102", "2106", "2107"]:
            api_patterns.extend([
                f"https://www.playoba.ca/api/{affiliate_id}/team/{team_id}",
                f"https://www.playoba.ca/api/{affiliate_id}/team/{team_id}/roster",
                f"https://www.playoba.ca/stats/api/{affiliate_id}/team/{team_id}",
            ])
        
        for url in api_patterns:
            try:
                response = self.session.get(url, timeout=10)
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if data and 'team' in str(data).lower():
                            return {
                                'success': True,
                                'api_url': url,
                                'data': data
                            }
                    except:
                        # Not JSON, but successful response
                        if 'team' in response.text.lower() and len(response.text) > 100:
                            return {
                                'success': True,
                                'api_url': url,
                                'html_data': response.text[:500]
                            }
                        
            except Exception as e:
                continue
        
        return None
    
    def scan_team_range(self, start_id: int, end_id: int, max_requests: int = 50) -> List[Dict]:
        """Scan a range of team IDs more efficiently"""
        
        results = []
        requests_made = 0
        
        print(f"Scanning team IDs {start_id} to {end_id} (max {max_requests} requests)")
        
        for team_id in range(start_id, end_id + 1):
            if requests_made >= max_requests:
                print(f"Reached maximum requests limit ({max_requests})")
                break
                
            team_id_str = str(team_id)
            
            # Check if this is a known team first
            if team_id_str in self.known_teams:
                results.append({
                    'team_id': team_id_str,
                    'team_name': self.known_teams[team_id_str],
                    'status': 'known_team',
                    'confidence': 100
                })
                continue
            
            # Test a few key endpoints for this team
            test_urls = [
                f"https://www.playoba.ca/stats#/2111/team/{team_id}/roster",
                f"https://www.playoba.ca/api/2111/team/{team_id}",
            ]
            
            for url in test_urls:
                try:
                    response = self.session.get(url, timeout=8)
                    requests_made += 1
                    
                    if response.status_code == 200 and len(response.text) > 200:
                        # Look for team indicators
                        text_lower = response.text.lower()
                        if any(indicator in text_lower for indicator in ['roster', 'player', 'team', 'coach']):
                            
                            # Try to extract team name
                            team_name = self.extract_team_name_from_response(response.text)
                            
                            results.append({
                                'team_id': team_id_str,
                                'team_name': team_name or f'Team {team_id}',
                                'status': 'discovered',
                                'url': url,
                                'confidence': 80
                            })
                            
                            # Cache this discovery
                            self.cache_team(team_id_str, team_name or f'Team {team_id}', 'SPBA')
                            break
                            
                except Exception as e:
                    continue
            
            # Rate limiting
            time.sleep(0.3)
            
            if team_id % 5 == 0:
                print(f"  Processed up to team {team_id}...")
        
        return results
    
    def extract_team_name_from_response(self, response_text: str) -> Optional[str]:
        """Extract team name from response text using patterns"""
        import re
        
        # Look for common team name patterns
        patterns = [
            r'<title[^>]*>([^<]*)</title>',
            r'"team_name"\s*:\s*"([^"]*)"',
            r'"teamName"\s*:\s*"([^"]*)"',
            r'<h1[^>]*>([^<]*)</h1>',
            r'class="team-name"[^>]*>([^<]*)<',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, response_text, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if name and name.lower() not in ['stats', 'team', 'roster', '']:
                    return name
        
        return None
    
    def add_team_to_database(self, team_id: str, team_name: str, affiliate: str, age_group: str = None):
        """Add discovered team to database"""
        if age_group is None:
            age_group = self.extract_age_group(team_name)
        self.cursor.execute(
            'INSERT OR REPLACE INTO teams (team_id, team_name, affiliate, age_group, last_updated) VALUES (?, ?, ?, ?, ?)',
            (team_id, team_name, affiliate, age_group, datetime.now().isoformat())
        )
        self.conn.commit()
    
    def cache_team(self, team_id: str, team_name: str, affiliate: str):
        """Cache discovered team - legacy method"""
        self.add_team_to_database(team_id, team_name, affiliate)
    
    def get_cached_teams(self) -> List[Dict]:
        """Get all cached teams"""
        self.cursor.execute(
            'SELECT team_id, team_name, affiliate, age_group FROM teams ORDER BY team_id'
        )
        return [
            {
                'team_id': row[0],
                'team_name': row[1], 
                'affiliate': row[2],
                'age_group': row[3]
            }
            for row in self.cursor.fetchall()
        ]
    
    def find_teams_by_name(self, search_name: str, min_confidence: int = 60) -> Dict:
        """Find teams matching the search name"""
        teams = self.get_cached_teams()
        
        if not teams:
            return {
                'success': False,
                'error': 'No teams in cache. Run discovery first.',
                'teams': []
            }
        
        team_names = [team['team_name'] for team in teams]
        matches = process.extract(search_name, team_names, scorer=fuzz.ratio, limit=5)
        
        good_matches = [match for match in matches if match[1] >= min_confidence]
        
        if good_matches:
            result_teams = []
            for match_name, confidence in good_matches:
                team = next(t for t in teams if t['team_name'] == match_name)
                team['confidence'] = confidence
                result_teams.append(team)
            
            return {
                'success': True,
                'search_term': search_name,
                'teams': result_teams
            }
        else:
            return {
                'success': False,
                'error': 'No teams found with sufficient confidence',
                'search_term': search_name,
                'available_teams': team_names[:10]  # Show first 10
            }

def main():
    scraper = DirectOBAScraper()
    
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python direct_oba_scraper.py scan <start_id> <end_id>")
        print("  python direct_oba_scraper.py search <team_name>")
        print("  python direct_oba_scraper.py list")
        print("  python direct_oba_scraper.py test <team_id>")
        return
    
    command = sys.argv[1]
    
    if command == "scan":
        if len(sys.argv) < 4:
            print("Usage: python direct_oba_scraper.py scan <start_id> <end_id>")
            return
        
        start_id = int(sys.argv[2])
        end_id = int(sys.argv[3])
        
        results = scraper.scan_team_range(start_id, end_id)
        
        print(f"\nScan Results ({len(results)} teams found):")
        for result in results:
            print(f"  {result['team_id']}: {result['team_name']} [{result['status']}]")
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: python direct_oba_scraper.py search <team_name>")
            return
        
        search_name = " ".join(sys.argv[2:])
        result = scraper.find_teams_by_name(search_name)
        print(json.dumps(result, indent=2))
    
    elif command == "list":
        teams = scraper.get_cached_teams()
        print(f"Cached Teams ({len(teams)}):")
        for team in teams:
            print(f"  {team['team_id']}: {team['team_name']} ({team['age_group']}, {team['affiliate']})")
    
    elif command == "test":
        if len(sys.argv) < 3:
            print("Usage: python direct_oba_scraper.py test <team_id>")
            return
        
        team_id = sys.argv[2]
        result = scraper.test_direct_api_endpoints(team_id)
        print(json.dumps(result, indent=2))
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()