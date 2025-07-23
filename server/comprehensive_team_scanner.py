#!/usr/bin/env python3

import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from roster_scraper import OBARosterScraper
import time

class ComprehensiveTeamScanner:
    """Comprehensive OBA Team Scanner to build complete team database"""
    
    def __init__(self):
        self.scraper = OBARosterScraper()
        self.cache_db = "roster_cache.db"
        self.setup_database()
    
    def setup_database(self):
        """Setup team database"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS discovered_teams (
                    team_id TEXT PRIMARY KEY,
                    team_name TEXT,
                    division TEXT,
                    affiliate TEXT,
                    team_url TEXT,
                    player_count INTEGER,
                    sample_players TEXT,
                    discovered_at TEXT
                )
            ''')
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database setup error: {e}")
    
    def scan_team_range(self, start_id: int, end_id: int, affiliate: str = "2105") -> List[Dict]:
        """Scan a range of team IDs to discover active teams"""
        discovered_teams = []
        
        print(f"🔍 Scanning team IDs {start_id} to {end_id} in affiliate {affiliate}...")
        
        for team_id in range(start_id, end_id + 1, 5):  # Sample every 5th ID for speed
            try:
                # Test multiple affiliate numbers for each team ID
                test_affiliates = [affiliate, "2105", "2106", "2111", "2100"]
                
                for test_affiliate in test_affiliates:
                    url = f'https://www.playoba.ca/stats#/{test_affiliate}/team/{team_id}/roster'
                    result = self.scraper.scrape_roster(url)
                    
                    if result and 'players' in result and len(result['players']) > 0:
                        team_name = result.get('team_name', 'Unknown')
                        
                        # Skip if it's a generic "Unknown" team
                        if team_name == 'Unknown' or 'team' in team_name.lower():
                            continue
                        
                        # Parse division from team name
                        division = "Unknown"
                        for div in ["11U", "13U", "15U", "18U"]:
                            if div in team_name:
                                division = div
                                break
                        
                        # Get sample player names
                        sample_players = [p.get('name', '') for p in result['players'][:3]]
                        
                        team_info = {
                            'team_id': str(team_id),
                            'team_name': team_name,
                            'division': division,
                            'affiliate': test_affiliate,
                            'team_url': url,
                            'player_count': len(result['players']),
                            'sample_players': sample_players,
                            'discovered_at': datetime.now().isoformat()
                        }
                        
                        discovered_teams.append(team_info)
                        self.store_team_in_db(team_info)
                        
                        print(f"✅ {team_id}: {team_name} ({len(result['players'])} players)")
                        break  # Found team, no need to try other affiliates
                
                # Small delay to be respectful
                time.sleep(0.05)
                
            except Exception as e:
                continue
        
        print(f"🎯 Found {len(discovered_teams)} active teams in range {start_id}-{end_id}")
        return discovered_teams
    
    def store_team_in_db(self, team_info: Dict):
        """Store team information in database"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT OR REPLACE INTO discovered_teams 
                (team_id, team_name, division, affiliate, team_url, player_count, sample_players, discovered_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                team_info['team_id'],
                team_info['team_name'],
                team_info['division'],
                team_info['affiliate'],
                team_info['team_url'],
                team_info['player_count'],
                json.dumps(team_info['sample_players']),
                team_info['discovered_at']
            ))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"Database storage error: {e}")
    
    def get_all_discovered_teams(self) -> List[Dict]:
        """Get all discovered teams from database"""
        try:
            conn = sqlite3.connect(self.cache_db)
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM discovered_teams ORDER BY division, team_name')
            rows = cursor.fetchall()
            
            teams = []
            for row in rows:
                teams.append({
                    'team_id': row[0],
                    'team_name': row[1],
                    'division': row[2],
                    'affiliate': row[3],
                    'team_url': row[4],
                    'player_count': row[5],
                    'sample_players': json.loads(row[6]) if row[6] else [],
                    'discovered_at': row[7]
                })
            
            conn.close()
            return teams
        except Exception as e:
            print(f"Database retrieval error: {e}")
            return []
    
    def smart_match_teams(self, tournament_team_name: str, division: str = None) -> List[Dict]:
        """Smart matching of tournament teams to discovered OBA teams"""
        try:
            from thefuzz import fuzz
        except ImportError:
            # Fallback without fuzzy matching
            return self.basic_match_teams(tournament_team_name, division)
        
        all_teams = self.get_all_discovered_teams()
        
        # Filter by division if provided
        if division:
            all_teams = [t for t in all_teams if t['division'] == division]
        
        matches = []
        for team in all_teams:
            # Calculate match score
            name_score = fuzz.partial_ratio(tournament_team_name.lower(), team['team_name'].lower())
            
            # Boost score for exact word matches
            tournament_words = tournament_team_name.lower().split()
            team_words = team['team_name'].lower().split()
            
            word_matches = 0
            for word in tournament_words:
                if any(word in team_word for team_word in team_words):
                    word_matches += 1
            
            if word_matches > 0:
                name_score += (word_matches * 10)
            
            if name_score > 40:  # Only include reasonable matches
                matches.append({
                    **team,
                    'match_score': name_score,
                    'match_reason': f"Name similarity: {name_score}%, Word matches: {word_matches}"
                })
        
        # Sort by match score (highest first)
        matches.sort(key=lambda x: x['match_score'], reverse=True)
        
        return matches[:10]  # Return top 10 matches
    
    def basic_match_teams(self, tournament_team_name: str, division: str = None) -> List[Dict]:
        """Basic matching without fuzzy logic"""
        all_teams = self.get_all_discovered_teams()
        
        # Filter by division if provided
        if division:
            all_teams = [t for t in all_teams if t['division'] == division]
        
        matches = []
        tournament_words = tournament_team_name.lower().split()
        
        for team in all_teams:
            team_words = team['team_name'].lower().split()
            
            word_matches = 0
            for word in tournament_words:
                if any(word in team_word for team_word in team_words):
                    word_matches += 1
            
            if word_matches > 0:
                matches.append({
                    **team,
                    'match_score': word_matches * 20,
                    'match_reason': f"Word matches: {word_matches}"
                })
        
        # Sort by word matches
        matches.sort(key=lambda x: x['match_score'], reverse=True)
        
        return matches[:10]

if __name__ == "__main__":
    scanner = ComprehensiveTeamScanner()
    
    # Scan known active ranges
    print("Starting comprehensive team discovery...")
    scanner.scan_team_range(499900, 500000)  # ICBA range
    scanner.scan_team_range(500000, 500100)  # Mixed range  
    scanner.scan_team_range(500400, 500500)  # LDBA range
    scanner.scan_team_range(503000, 503100)  # LDBA range
    
    teams = scanner.get_all_discovered_teams()
    print(f"\n📊 Total teams discovered: {len(teams)}")