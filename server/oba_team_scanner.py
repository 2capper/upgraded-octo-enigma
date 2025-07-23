#!/usr/bin/env python3
"""
Comprehensive OBA Team Scanner
Scans the entire OBA team ID range (500000-510000) and stores all discovered teams
in a local PostgreSQL database for fast, accurate roster matching.
"""

import requests
import json
import time
import re
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import concurrent.futures
import threading
from urllib.parse import urlparse

class OBATeamScanner:
    def __init__(self):
        self.db_url = os.environ.get('DATABASE_URL')
        if not self.db_url:
            raise ValueError("DATABASE_URL environment variable is required")
        
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # Thread-safe counters
        self.lock = threading.Lock()
        self.teams_found = 0
        self.teams_processed = 0
        self.teams_with_rosters = 0
    
    def get_db_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
    
    def parse_team_info(self, content: str, team_id: str) -> Optional[Dict]:
        """Parse team information from OBA page content"""
        try:
            # Look for team name in h1 tag
            team_name_match = re.search(r'<h1[^>]*>([^<]+)</h1>', content, re.IGNORECASE)
            if not team_name_match:
                return None
            
            team_name = team_name_match.group(1).strip()
            
            # Skip if it's not a real team name
            if len(team_name) < 5 or 'error' in team_name.lower() or 'not found' in team_name.lower():
                return None
            
            # Parse team components (e.g., "11U HS Forest Glade, SPBA 2025, [Sel] 11U HS")
            parts = team_name.split(',')
            main_name = parts[0].strip() if parts else team_name
            
            # Extract division (age group)
            division_match = re.search(r'(\d+U)', main_name, re.IGNORECASE)
            division = division_match.group(1) if division_match else None
            
            # Extract level (HS, Rep, AAA, etc.)
            level_match = re.search(r'\b(HS|Rep|AAA|AA|A|B|C|D|DS)\b', main_name, re.IGNORECASE)
            level = level_match.group(1) if level_match else None
            
            # Extract organization name (everything after division and level)
            org_pattern = r'(\d+U)?\s*(HS|Rep|AAA|AA|A|B|C|D|DS)?\s*(.+?)(?:,|$)'
            org_match = re.search(org_pattern, main_name, re.IGNORECASE)
            organization = org_match.group(3).strip() if org_match and org_match.group(3) else None
            
            # Extract affiliate from second part
            affiliate = None
            if len(parts) > 1:
                affiliate_match = re.search(r'([A-Z]{3,5})', parts[1])
                affiliate = affiliate_match.group(1) if affiliate_match else None
            
            # Check if roster data exists
            has_roster = bool(re.search(r'<td[^>]*>\s*<a[^>]*href[^>]*player[^>]*>', content))
            
            # Count players if roster exists
            player_count = 0
            if has_roster:
                player_matches = re.findall(r'<a[^>]*href[^>]*player[^>]*>', content)
                player_count = len(player_matches)
            
            return {
                'team_id': team_id,
                'team_name': main_name,
                'organization': organization,
                'division': division,
                'level': level,
                'affiliate': affiliate,
                'has_roster': has_roster,
                'player_count': player_count,
                'is_active': True
            }
            
        except Exception as e:
            print(f"Error parsing team {team_id}: {e}")
            return None
    
    def scan_team_id(self, team_id: int) -> Optional[Dict]:
        """Scan a single team ID"""
        try:
            url = f"https://www.playoba.ca/stats#/2111/team/{team_id}/roster"
            response = requests.get(url, headers=self.headers, timeout=10)
            
            with self.lock:
                self.teams_processed += 1
            
            if response.status_code == 200 and len(response.text) > 1000:
                team_info = self.parse_team_info(response.text, str(team_id))
                
                if team_info:
                    with self.lock:
                        self.teams_found += 1
                        if team_info['has_roster']:
                            self.teams_with_rosters += 1
                        
                        if self.teams_processed % 10 == 0:
                            print(f"Progress: {self.teams_processed} processed, {self.teams_found} teams found, {self.teams_with_rosters} with rosters")
                
                return team_info
            
        except Exception as e:
            if team_id % 100 == 0:  # Log more frequently for debugging
                print(f"Error scanning team {team_id}: {e}")
            
        return None
    
    def save_team_to_db(self, team_info: Dict):
        """Save team information to database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            # Insert or update team information
            query = """
                INSERT INTO oba_teams (team_id, team_name, organization, division, level, affiliate, has_roster, player_count, is_active, last_scanned)
                VALUES (%(team_id)s, %(team_name)s, %(organization)s, %(division)s, %(level)s, %(affiliate)s, %(has_roster)s, %(player_count)s, %(is_active)s, NOW())
                ON CONFLICT (team_id) 
                DO UPDATE SET 
                    team_name = EXCLUDED.team_name,
                    organization = EXCLUDED.organization,
                    division = EXCLUDED.division,
                    level = EXCLUDED.level,
                    affiliate = EXCLUDED.affiliate,
                    has_roster = EXCLUDED.has_roster,
                    player_count = EXCLUDED.player_count,
                    is_active = EXCLUDED.is_active,
                    last_scanned = NOW()
            """
            
            cursor.execute(query, team_info)
            conn.commit()
            cursor.close()
            conn.close()
            
        except Exception as e:
            print(f"Error saving team {team_info['team_id']}: {e}")
    
    def scan_range(self, start_id: int, end_id: int, max_workers: int = 10):
        """Scan a range of team IDs with parallel processing"""
        print(f"Scanning team IDs {start_id} to {end_id} with {max_workers} workers...")
        
        start_time = time.time()
        
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            # Submit all scanning tasks
            future_to_id = {
                executor.submit(self.scan_team_id, team_id): team_id 
                for team_id in range(start_id, end_id + 1)
            }
            
            # Process results as they complete
            for future in concurrent.futures.as_completed(future_to_id):
                team_info = future.result()
                if team_info:
                    self.save_team_to_db(team_info)
                
                # Small delay to be respectful to the server
                time.sleep(0.05)
        
        elapsed_time = time.time() - start_time
        print(f"\nScan complete!")
        print(f"Time elapsed: {elapsed_time:.2f} seconds")
        print(f"Teams processed: {self.teams_processed}")
        print(f"Teams found: {self.teams_found}")
        print(f"Teams with rosters: {self.teams_with_rosters}")
        print(f"Rate: {self.teams_processed / elapsed_time:.2f} teams/second")
    
    def search_teams(self, organization: str = None, division: str = None, level: str = None) -> List[Dict]:
        """Search for teams in the local database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            query = "SELECT * FROM oba_teams WHERE is_active = true"
            params = []
            
            if organization:
                query += " AND organization ILIKE %s"
                params.append(f"%{organization}%")
            
            if division:
                query += " AND division = %s"
                params.append(division)
            
            if level:
                query += " AND level = %s"
                params.append(level)
            
            query += " ORDER BY organization, division, level"
            
            cursor.execute(query, params)
            results = cursor.fetchall()
            
            cursor.close()
            conn.close()
            
            return [dict(row) for row in results]
            
        except Exception as e:
            print(f"Error searching teams: {e}")
            return []
    
    def get_team_stats(self) -> Dict:
        """Get statistics about the teams in the database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor()
            
            stats_query = """
                SELECT 
                    COUNT(*) as total_teams,
                    COUNT(*) FILTER (WHERE has_roster = true) as teams_with_rosters,
                    COUNT(DISTINCT organization) as unique_organizations,
                    COUNT(DISTINCT division) as unique_divisions,
                    COUNT(DISTINCT affiliate) as unique_affiliates,
                    AVG(player_count) FILTER (WHERE player_count > 0) as avg_roster_size
                FROM oba_teams 
                WHERE is_active = true
            """
            
            cursor.execute(stats_query)
            stats = dict(cursor.fetchone())
            
            # Get top organizations
            org_query = """
                SELECT organization, COUNT(*) as team_count
                FROM oba_teams 
                WHERE is_active = true AND organization IS NOT NULL
                GROUP BY organization 
                ORDER BY team_count DESC 
                LIMIT 10
            """
            
            cursor.execute(org_query)
            top_orgs = [dict(row) for row in cursor.fetchall()]
            
            cursor.close()
            conn.close()
            
            stats['top_organizations'] = top_orgs
            return stats
            
        except Exception as e:
            print(f"Error getting stats: {e}")
            return {}

def main():
    import sys
    
    scanner = OBATeamScanner()
    
    if len(sys.argv) < 2:
        print("Usage: python oba_team_scanner.py <command> [options]")
        print("Commands:")
        print("  scan <start_id> <end_id> [workers] - Scan range of team IDs")
        print("  search [organization] [division] [level] - Search teams")
        print("  stats - Show database statistics")
        print("  quick-scan - Scan known Forest Glade range quickly")
        print("  full-scan - Scan entire OBA range (500000-510000)")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "scan":
        if len(sys.argv) < 4:
            print("Usage: scan <start_id> <end_id> [workers]")
            sys.exit(1)
        
        start_id = int(sys.argv[2])
        end_id = int(sys.argv[3])
        workers = int(sys.argv[4]) if len(sys.argv) > 4 else 10
        
        scanner.scan_range(start_id, end_id, workers)
    
    elif command == "search":
        organization = sys.argv[2] if len(sys.argv) > 2 else None
        division = sys.argv[3] if len(sys.argv) > 3 else None
        level = sys.argv[4] if len(sys.argv) > 4 else None
        
        teams = scanner.search_teams(organization, division, level)
        
        print(f"Found {len(teams)} teams:")
        for team in teams:
            roster_info = f"({team['player_count']} players)" if team['has_roster'] else "(no roster)"
            print(f"  {team['team_id']}: {team['team_name']} {roster_info}")
    
    elif command == "stats":
        stats = scanner.get_team_stats()
        print("OBA Teams Database Statistics:")
        print(f"  Total teams: {stats.get('total_teams', 0)}")
        print(f"  Teams with rosters: {stats.get('teams_with_rosters', 0)}")
        print(f"  Unique organizations: {stats.get('unique_organizations', 0)}")
        print(f"  Unique divisions: {stats.get('unique_divisions', 0)}")
        print(f"  Unique affiliates: {stats.get('unique_affiliates', 0)}")
        if stats.get('avg_roster_size'):
            print(f"  Average roster size: {stats['avg_roster_size']:.1f} players")
        
        if 'top_organizations' in stats:
            print("\nTop Organizations:")
            for org in stats['top_organizations']:
                print(f"  {org['organization']}: {org['team_count']} teams")
    
    elif command == "quick-scan":
        # Scan the range around known Forest Glade teams
        print("Quick scan: Forest Glade region (500700-550)")
        scanner.scan_range(500700, 550, 5)
    
    elif command == "full-scan":
        # Scan the entire OBA range
        print("Full scan: Entire OBA range (500000-510000)")
        print("This will take approximately 2-3 hours...")
        scanner.scan_range(500000, 510000, 20)
    
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()