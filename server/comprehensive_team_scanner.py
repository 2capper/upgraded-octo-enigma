#!/usr/bin/env python3
"""
Comprehensive OBA Team Scanner
Scans the full range of OBA team IDs (500000-510000) to discover all active teams
and build a complete database for accurate roster matching.
"""

import requests
import json
import time
import sys
import sqlite3
from urllib.parse import urlparse
import os
from datetime import datetime

def setup_database():
    """Create or connect to the team database"""
    db_path = os.path.join(os.path.dirname(__file__), 'oba_teams.db')
    conn = sqlite3.connect(db_path)
    
    # Create teams table if it doesn't exist
    conn.execute('''
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            division TEXT,
            affiliate_number INTEGER,
            url TEXT,
            has_roster BOOLEAN DEFAULT FALSE,
            last_checked DATETIME,
            active BOOLEAN DEFAULT TRUE
        )
    ''')
    
    # Create index for faster searching
    conn.execute('CREATE INDEX IF NOT EXISTS idx_name ON teams(name)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_division ON teams(division)')
    
    conn.commit()
    return conn

def validate_url(url):
    """Validate that URL is from playoba.ca"""
    try:
        parsed = urlparse(url)
        return parsed.netloc == 'www.playoba.ca'
    except:
        return False

def check_team_exists(team_id, affiliate_num=2111):
    """Check if a specific team ID exists and has data using the existing roster scraper"""
    if not (500000 <= team_id <= 510000):
        return None
    
    # Try multiple affiliate numbers to find the team
    affiliates_to_try = [2111, 2100, 2106, 700, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2001, 2002, 2003, 2004, 2005]
    
    for affiliate in affiliates_to_try:
        url = f"https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster"
        
        try:
            # Use the existing roster scraper to check if team has valid data
            import subprocess
            import shlex
            
            # Call the working roster scraper
            result = subprocess.run([
                'python', 'roster_scraper.py', 'import', shlex.quote(url)
            ], capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0:
                try:
                    roster_data = json.loads(result.stdout.strip())
                    if (roster_data.get('success') and 
                        roster_data.get('roster', {}).get('authentic_data') and
                        len(roster_data.get('roster', {}).get('players', [])) > 0):
                        
                        team_name = roster_data['roster']['team_name']
                        return {
                            'id': team_id,
                            'name': team_name,
                            'url': url,
                            'affiliate': affiliate,
                            'has_roster': True
                        }
                except json.JSONDecodeError:
                    continue
        except:
            continue
    
    return None

def extract_team_name(html_content):
    """Extract team name from HTML content"""
    # Look for common patterns in OBA pages
    import re
    
    # Try various patterns to find team name - prioritize actual team data
    patterns = [
        r'"teamName":"([^"]+)"',  # JSON data pattern (most reliable)
        r'<title>([^<]+?)\s*-\s*OBA', # Title with OBA suffix
        r'<h1[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)</h1>',
        r'<h2[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)</h2>',
        r'team-name[^>]*>([^<]+)<',
        r'<div[^>]*class="[^"]*roster[^"]*title[^"]*"[^>]*>([^<]+)</div>',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, html_content, re.IGNORECASE)
        if match:
            name = match.group(1).strip()
            # Filter out generic titles and navigation text
            blacklist = [
                'ontario baseball', 'playoba', 'roster', 'stats', 'follow us',
                'home', 'schedule', 'standings', 'teams', 'players', 'login',
                'register', 'contact', 'about', 'news', 'events'
            ]
            
            if name and not any(x in name.lower() for x in blacklist):
                # Additional validation - should contain typical team name elements
                if re.search(r'\b\d+U\b|\b(rep|aa|aaa|select|house|hs|ds)\b', name, re.IGNORECASE):
                    return name
                elif len(name.split()) >= 2 and not name.lower().startswith('follow'):
                    return name
    
    return None

def scan_team_range(start_id, end_id, conn, batch_size=100):
    """Scan a range of team IDs and save results to database"""
    print(f"Scanning team IDs {start_id} to {end_id}")
    
    found_teams = 0
    checked_teams = 0
    
    for team_id in range(start_id, end_id + 1):
        checked_teams += 1
        
        # Check if we already have this team in database
        cursor = conn.execute('SELECT id FROM teams WHERE id = ?', (team_id,))
        if cursor.fetchone():
            continue  # Skip if already in database
        
        team_data = check_team_exists(team_id)
        
        if team_data:
            # Extract division from team name
            division = extract_division(team_data['name'])
            
            # Insert into database
            conn.execute('''
                INSERT OR REPLACE INTO teams 
                (id, name, division, affiliate_number, url, has_roster, last_checked, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                team_data['id'],
                team_data['name'],
                division,
                team_data['affiliate'],
                team_data['url'],
                team_data['has_roster'],
                datetime.now(),
                True
            ))
            
            found_teams += 1
            print(f"Found: {team_data['name']} (ID: {team_id})")
            
            # Commit every batch_size teams
            if found_teams % batch_size == 0:
                conn.commit()
        
        # Progress indicator
        if checked_teams % 1000 == 0:
            print(f"Checked {checked_teams} teams, found {found_teams} active teams")
        
        # Small delay to be respectful to the server
        time.sleep(0.1)
    
    conn.commit()
    print(f"Scan complete. Found {found_teams} active teams out of {checked_teams} checked.")
    return found_teams

def extract_division(team_name):
    """Extract division (11U, 13U, etc.) from team name"""
    import re
    
    # Look for common division patterns
    patterns = [
        r'\b(\d+U)\b',
        r'\b(11U|13U|15U|18U)\b',
        r'\b(Rookie|Mosquito|Peewee|Bantam|Midget)\b'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, team_name, re.IGNORECASE)
        if match:
            return match.group(1).upper()
    
    return None

def search_teams_by_name(conn, search_name, division=None, limit=10):
    """Search for teams by name similarity"""
    search_terms = search_name.lower().split()
    
    # Build SQL query for fuzzy matching
    where_conditions = []
    params = []
    
    # Add name matching conditions
    for term in search_terms:
        where_conditions.append("LOWER(name) LIKE ?")
        params.append(f"%{term}%")
    
    # Add division filter if specified
    if division:
        where_conditions.append("division = ?")
        params.append(division.upper())
    
    where_clause = " AND ".join(where_conditions) if where_conditions else "1=1"
    
    query = f"""
        SELECT id, name, division, url, has_roster
        FROM teams 
        WHERE {where_clause} AND active = 1
        ORDER BY 
            CASE 
                WHEN LOWER(name) = LOWER(?) THEN 1
                WHEN LOWER(name) LIKE LOWER(?) THEN 2
                ELSE 3
            END,
            name
        LIMIT ?
    """
    
    params.extend([search_name, f"%{search_name}%", limit])
    
    cursor = conn.execute(query, params)
    results = cursor.fetchall()
    
    return [
        {
            'id': row[0],
            'name': row[1],
            'division': row[2],
            'url': row[3],
            'has_roster': row[4],
            'match_score': calculate_match_score(search_name, row[1])
        }
        for row in results
    ]

def calculate_match_score(search_name, team_name):
    """Calculate similarity score between search name and team name"""
    search_lower = search_name.lower()
    team_lower = team_name.lower()
    
    # Exact match gets highest score
    if search_lower == team_lower:
        return 10
    
    # Count matching words
    search_words = set(search_lower.split())
    team_words = set(team_lower.split())
    
    common_words = search_words.intersection(team_words)
    total_words = len(search_words.union(team_words))
    
    if total_words == 0:
        return 0
    
    # Calculate Jaccard similarity and scale to 1-9
    similarity = len(common_words) / total_words
    return int(similarity * 9) + 1

def main():
    if len(sys.argv) < 2:
        print("Usage: python comprehensive_team_scanner.py <command> [args]")
        print("Commands:")
        print("  scan [start_id] [end_id] - Scan team ID range (default: 500000-510000)")
        print("  search <team_name> [division] - Search for teams by name")
        print("  stats - Show database statistics")
        return
    
    command = sys.argv[1]
    conn = setup_database()
    
    try:
        if command == "scan":
            start_id = int(sys.argv[2]) if len(sys.argv) > 2 else 500000
            end_id = int(sys.argv[3]) if len(sys.argv) > 3 else 510000
            scan_team_range(start_id, end_id, conn)
            
        elif command == "search":
            if len(sys.argv) < 3:
                print("Error: search requires team name")
                return
            
            team_name = sys.argv[2]
            division = sys.argv[3] if len(sys.argv) > 3 else None
            
            results = search_teams_by_name(conn, team_name, division)
            
            print(json.dumps({
                'success': True,
                'matches': results,
                'total_found': len(results)
            }))
            
        elif command == "stats":
            cursor = conn.execute('SELECT COUNT(*) FROM teams WHERE active = 1')
            total_teams = cursor.fetchone()[0]
            
            cursor = conn.execute('SELECT COUNT(*) FROM teams WHERE has_roster = 1 AND active = 1')
            teams_with_rosters = cursor.fetchone()[0]
            
            print(f"Database Statistics:")
            print(f"Total active teams: {total_teams}")
            print(f"Teams with rosters: {teams_with_rosters}")
            
        else:
            print(f"Unknown command: {command}")
            
    finally:
        conn.close()

if __name__ == "__main__":
    main()