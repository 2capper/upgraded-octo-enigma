#!/usr/bin/env python3
"""
OBA Roster Service
Fast roster matching and importing using the local OBA teams database.
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from typing import Dict, List, Optional
from fuzzywuzzy import fuzz, process
import requests
import re

class OBARosterService:
    def __init__(self):
        self.db_url = os.environ.get('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
    
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def search_teams_fast(self, query: str, division: str = None, limit: int = 10) -> List[Dict]:
        """Fast team search using local database with fuzzy matching"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Get all potential matches from database
            search_query = """
                SELECT team_id, team_name, organization, division, level, affiliate, has_roster, player_count
                FROM oba_teams 
                WHERE is_active = true
            """
            params = []
            
            if division:
                search_query += " AND division = %s"
                params.append(division)
            
            cursor.execute(search_query, params)
            all_teams = [dict(row) for row in cursor.fetchall()]
            
            cursor.close()
            conn.close()
            
            # If no specific query, return all teams for the division
            if not query or query.strip() == "":
                return all_teams[:limit]
            
            # Fuzzy match against team names and organizations
            matches = []
            query_lower = query.lower()
            
            for team in all_teams:
                # Calculate match scores
                name_score = fuzz.partial_ratio(query_lower, team['team_name'].lower()) if team['team_name'] else 0
                org_score = fuzz.partial_ratio(query_lower, team['organization'].lower()) if team['organization'] else 0
                
                # Take the best score
                best_score = max(name_score, org_score)
                
                # Boost score for exact substring matches
                if query_lower in team['team_name'].lower() or (team['organization'] and query_lower in team['organization'].lower()):
                    best_score = min(100, best_score + 20)
                
                if best_score > 60:  # Minimum threshold
                    matches.append({
                        **team,
                        'match_score': best_score
                    })
            
            # Sort by match score and return top results
            matches.sort(key=lambda x: x['match_score'], reverse=True)
            return matches[:limit]
            
        except Exception as e:
            print(f"Error searching teams: {e}")
            return []
    
    def get_team_by_id(self, team_id: str) -> Optional[Dict]:
        """Get team information by OBA team ID"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                "SELECT * FROM oba_teams WHERE team_id = %s AND is_active = true",
                (team_id,)
            )
            
            result = cursor.fetchone()
            cursor.close()
            conn.close()
            
            return dict(result) if result else None
            
        except Exception as e:
            print(f"Error getting team {team_id}: {e}")
            return None
    
    def extract_roster_from_page(self, content: str) -> List[Dict]:
        """Extract roster data from OBA page content"""
        try:
            players = []
            
            # Look for player table rows
            player_pattern = r'<tr[^>]*>.*?<td[^>]*>(\d*)</td>.*?<a[^>]*>([^<]+)</a>.*?</tr>'
            matches = re.findall(player_pattern, content, re.DOTALL)
            
            for match in matches:
                number, name = match
                if name and name.strip():
                    players.append({
                        'number': number.strip() if number else '',
                        'name': name.strip()
                    })
            
            return players
            
        except Exception as e:
            print(f"Error extracting roster: {e}")
            return []
    
    def fetch_roster_data(self, team_id: str) -> Optional[Dict]:
        """Fetch fresh roster data from OBA website"""
        try:
            url = f"https://www.playoba.ca/stats#/2111/team/{team_id}/roster"
            response = requests.get(url, headers=self.headers, timeout=15)
            
            if response.status_code == 200:
                players = self.extract_roster_from_page(response.text)
                
                if players:
                    return {
                        'team_id': team_id,
                        'players': players,
                        'player_count': len(players),
                        'source': 'live_oba',
                        'success': True
                    }
            
            return {
                'team_id': team_id,
                'players': [],
                'player_count': 0,
                'source': 'live_oba',
                'success': False,
                'error': 'No roster data found'
            }
            
        except Exception as e:
            return {
                'team_id': team_id,
                'players': [],
                'player_count': 0,
                'source': 'live_oba',
                'success': False,
                'error': str(e)
            }
    
    def cache_roster_data(self, team_id: str, roster_data: Dict):
        """Cache roster data in the database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute(
                """
                UPDATE oba_teams 
                SET roster_data = %s, player_count = %s, last_scanned = NOW()
                WHERE team_id = %s
                """,
                (json.dumps(roster_data), roster_data.get('player_count', 0), team_id)
            )
            
            conn.commit()
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Error caching roster for team {team_id}: {e}")
    
    def get_roster(self, team_id: str, use_cache: bool = True) -> Dict:
        """Get roster data for a team (with optional caching)"""
        try:
            team_info = self.get_team_by_id(team_id)
            if not team_info:
                return {
                    'success': False,
                    'error': f'Team {team_id} not found in database',
                    'team_id': team_id
                }
            
            # Check cache first if requested
            if use_cache and team_info.get('roster_data'):
                cached_data = team_info['roster_data']
                if isinstance(cached_data, dict) and cached_data.get('players'):
                    return {
                        'success': True,
                        'team_id': team_id,
                        'team_name': team_info['team_name'],
                        'organization': team_info['organization'],
                        'division': team_info['division'],
                        'source': 'database_cache',
                        **cached_data
                    }
            
            # Fetch fresh data from OBA
            roster_data = self.fetch_roster_data(team_id)
            
            if roster_data['success']:
                # Cache the fresh data
                self.cache_roster_data(team_id, roster_data)
                
                return {
                    'success': True,
                    'team_id': team_id,
                    'team_name': team_info['team_name'],
                    'organization': team_info['organization'],
                    'division': team_info['division'],
                    **roster_data
                }
            else:
                return {
                    'success': False,
                    'team_id': team_id,
                    'team_name': team_info['team_name'],
                    'error': roster_data.get('error', 'Failed to fetch roster'),
                    **roster_data
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'team_id': team_id
            }

def main():
    import sys
    
    service = OBARosterService()
    
    if len(sys.argv) < 2:
        print("Usage: python oba_roster_service.py <command> [options]")
        print("Commands:")
        print("  search <query> [division] - Search for teams")
        print("  roster <team_id> [--no-cache] - Get roster for team")
        print("  match <team_name> <division> - Find best matches for team")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "search":
        query = sys.argv[2] if len(sys.argv) > 2 else ""
        division = sys.argv[3] if len(sys.argv) > 3 else None
        
        teams = service.search_teams_fast(query, division)
        
        print(f"Found {len(teams)} teams:")
        for team in teams:
            score = f"(match: {team.get('match_score', 0)}%)" if 'match_score' in team else ""
            roster_info = f"({team['player_count']} players)" if team['has_roster'] else "(no roster)"
            print(f"  {team['team_id']}: {team['team_name']} {roster_info} {score}")
    
    elif command == "roster":
        if len(sys.argv) < 3:
            print("Usage: roster <team_id> [--no-cache]")
            sys.exit(1)
        
        team_id = sys.argv[2]
        use_cache = "--no-cache" not in sys.argv
        
        result = service.get_roster(team_id, use_cache)
        print(json.dumps(result, indent=2))
    
    elif command == "match":
        if len(sys.argv) < 4:
            print("Usage: match <team_name> <division>")
            sys.exit(1)
        
        team_name = sys.argv[2]
        division = sys.argv[3]
        
        matches = service.search_teams_fast(team_name, division, 5)
        
        print(f"Best matches for '{team_name}' in {division}:")
        for match in matches:
            print(f"  {match['team_id']}: {match['team_name']} (score: {match.get('match_score', 0)}%)")
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()