#!/usr/bin/env python3
"""
Team Discovery System
Scans OBA team IDs to find all active teams with rosters.
Uses the web_fetch approach that works reliably.
"""

import requests
import json
import time
import sys
import sqlite3
import os
from datetime import datetime
import re

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

def get_team_roster_data(team_id, affiliate=2111):
    """Get roster data using our working roster scraper"""
    url = f"https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster"
    
    try:
        # Use our proven roster scraper which works reliably
        import subprocess
        
        # Call the working roster scraper with proper error handling
        result = subprocess.run([
            'python', 'roster_scraper.py', 'import', url
        ], capture_output=True, text=True, timeout=30, cwd=os.path.dirname(__file__))
        
        if result.returncode == 0:
            try:
                roster_data = json.loads(result.stdout.strip())
                if (roster_data.get('success') and 
                    roster_data.get('roster', {}).get('authentic_data') and
                    len(roster_data.get('roster', {}).get('players', [])) > 0):
                    
                    team_name = roster_data['roster']['team_name']
                    if team_name and "Real roster data not available" not in team_name:
                        return {
                            'team_name': team_name,
                            'has_roster': True,
                            'url': url
                        }
            except json.JSONDecodeError:
                pass
    except:
        pass
    
    return None

def discover_team(team_id):
    """Discover if a team exists across multiple affiliates"""
    affiliates = [2111, 2100, 2106, 700, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900, 2000]
    
    for affiliate in affiliates:
        roster_data = get_team_roster_data(team_id, affiliate)
        if roster_data:
            return {
                'id': team_id,
                'name': roster_data['team_name'],
                'url': roster_data['url'],
                'affiliate': affiliate,
                'has_roster': roster_data['has_roster']
            }
    
    return None

def extract_division(team_name):
    """Extract division from team name"""
    # Look for common division patterns
    patterns = [
        r'\b(\d+U)\b',
        r'\b(11U|13U|15U|18U)\b',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, team_name, re.IGNORECASE)
        if match:
            return match.group(1).upper()
    
    return None

def scan_range(start_id, end_id, conn):
    """Scan a range of team IDs"""
    print(f"Scanning team IDs {start_id} to {end_id}")
    
    found_teams = 0
    checked_teams = 0
    
    for team_id in range(start_id, end_id + 1):
        checked_teams += 1
        
        # Check if already in database
        cursor = conn.execute('SELECT id FROM teams WHERE id = ?', (team_id,))
        if cursor.fetchone():
            continue
        
        # Try to discover the team
        team_data = discover_team(team_id)
        
        if team_data:
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
            print(f"Found: {team_data['name']} (ID: {team_id}, Division: {division})")
            
            # Commit periodically
            if found_teams % 50 == 0:
                conn.commit()
        
        # Progress update
        if checked_teams % 100 == 0:
            print(f"Checked {checked_teams} teams, found {found_teams} active teams")
            
        # Be respectful to the server
        time.sleep(0.2)
    
    conn.commit()
    print(f"Scan complete. Found {found_teams} teams out of {checked_teams} checked.")
    return found_teams

def search_teams(conn, search_name, division=None, limit=10):
    """Search for teams by name"""
    search_terms = search_name.lower().split()
    
    where_conditions = []
    params = []
    
    # Add name matching
    for term in search_terms:
        where_conditions.append("LOWER(name) LIKE ?")
        params.append(f"%{term}%")
    
    # Add division filter
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
    
    # Calculate match scores
    matches = []
    for row in results:
        match_score = calculate_match_score(search_name, row[1])
        matches.append({
            'id': row[0],
            'name': row[1],
            'division': row[2],
            'url': row[3],
            'has_roster': row[4],
            'match_score': match_score
        })
    
    # Sort by match score descending
    matches.sort(key=lambda x: x['match_score'], reverse=True)
    
    return matches

def calculate_match_score(search_name, team_name):
    """Calculate similarity score"""
    search_lower = search_name.lower()
    team_lower = team_name.lower()
    
    if search_lower == team_lower:
        return 10
    
    search_words = set(search_lower.split())
    team_words = set(team_lower.split())
    
    common_words = search_words.intersection(team_words)
    total_words = len(search_words.union(team_words))
    
    if total_words == 0:
        return 0
    
    similarity = len(common_words) / total_words
    return int(similarity * 9) + 1

def main():
    if len(sys.argv) < 2:
        print("Usage: python team_discovery.py <command> [args]")
        print("Commands:")
        print("  scan [start_id] [end_id] - Scan team range")
        print("  search <name> [division] - Search teams")
        print("  stats - Show statistics")
        return
    
    command = sys.argv[1]
    conn = setup_database()
    
    try:
        if command == "scan":
            start_id = int(sys.argv[2]) if len(sys.argv) > 2 else 500000
            end_id = int(sys.argv[3]) if len(sys.argv) > 3 else 510000
            scan_range(start_id, end_id, conn)
            
        elif command == "search":
            if len(sys.argv) < 3:
                print("Error: search requires team name")
                return
            
            team_name = sys.argv[2]
            division = sys.argv[3] if len(sys.argv) > 3 else None
            
            results = search_teams(conn, team_name, division)
            
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
            
    finally:
        conn.close()

if __name__ == "__main__":
    main()