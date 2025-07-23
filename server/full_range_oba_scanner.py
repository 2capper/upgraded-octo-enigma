#!/usr/bin/env python3
"""
Comprehensive OBA Team Scanner - Full Range Discovery
Scans the complete OBA team ID range (500000-510000) to discover all authentic teams
and store their real names, handling variations like "South Woodslee Orioles" vs "Woodslee Orioles"
"""

import requests
import psycopg2
import os
import json
import time
import re
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from psycopg2.extras import RealDictCursor

class FullRangeOBAScanner:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        }
        self.discovered_teams = []
        self.processed_count = 0
        self.affiliates = ['2111', '0700', '2100', '0900', '1200', '2106', '2107']  # Multiple affiliates to try
        
    def scan_team_batch(self, start_id, end_id):
        """Scan a batch of team IDs"""
        batch_teams = []
        
        for team_id in range(start_id, end_id):
            team_info = self.scan_single_team(team_id)
            if team_info:
                batch_teams.append(team_info)
                print(f"✓ {team_id}: {team_info['name']} ({team_info['organization']}) - {team_info['division']} {team_info['level']}")
            
            # Progress indicator
            if team_id % 100 == 0:
                print(f"Progress: {team_id}")
        
        return batch_teams
    
    def scan_single_team(self, team_id):
        """Scan a single team ID across multiple affiliates"""
        for affiliate in self.affiliates:
            try:
                url = f'https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster'
                response = requests.get(url, headers=self.headers, timeout=8)
                
                if response.status_code == 200:
                    content = response.text
                    
                    # Check for valid team page indicators
                    if self.is_valid_team_page(content):
                        team_info = self.extract_team_info(content, team_id, affiliate)
                        if team_info and self.is_authentic_team(team_info):
                            return team_info
                            
            except requests.RequestException:
                continue
                
        return None
    
    def is_valid_team_page(self, content):
        """Check if page contains valid team data"""
        return (
            'roster' in content.lower() and
            'player' in content.lower() and
            len(content) > 8000 and  # Substantial content
            'login' not in content.lower() and
            'error' not in content.lower()
        )
    
    def extract_team_info(self, content, team_id, affiliate):
        """Extract authentic team information from page content"""
        try:
            # Extract team name from multiple sources
            team_name = self.extract_team_name(content)
            if not team_name or team_name == 'Stats':
                return None
            
            # Parse division (age group)
            division_match = re.search(r'(\d+U)', team_name)
            division = division_match.group(1) if division_match else 'Unknown'
            
            # Parse level/classification
            level = self.extract_level(team_name)
            
            # Extract organization name
            organization = self.extract_organization(team_name, division, level)
            
            # Map to proper affiliate
            mapped_affiliate = self.map_affiliate(organization)
            
            # Count players if possible
            player_count = self.count_players(content)
            
            return {
                'team_id': str(team_id),
                'name': team_name.strip(),
                'organization': organization.strip(),
                'division': division,
                'level': level,
                'affiliate': mapped_affiliate,
                'player_count': player_count,
                'source_affiliate': affiliate
            }
            
        except Exception as e:
            return None
    
    def extract_team_name(self, content):
        """Extract team name from various page elements"""
        patterns = [
            r'<title[^>]*>([^<]*?)\s*(?:-\s*Stats)?(?:\s*-\s*Ontario Baseball Association)?</title>',
            r'<h1[^>]*class="[^"]*team[^"]*"[^>]*>([^<]+)</h1>',
            r'<h1[^>]*>([^<]*(?:\d+U)[^<]*)</h1>',
            r'"team_name"\s*:\s*"([^"]+)"',
            r'team.*?name.*?["\']([^"\']*\d+U[^"\']*)["\']'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
            if match:
                name = match.group(1).strip()
                if self.is_valid_team_name(name):
                    return name
        
        return None
    
    def is_valid_team_name(self, name):
        """Check if extracted name is a valid team name"""
        return (
            name and
            len(name) > 5 and
            name != 'Stats' and
            name != 'Ontario Baseball Association' and
            ('U ' in name or re.search(r'\d+U', name)) and
            not any(word in name.lower() for word in ['login', 'error', 'not found'])
        )
    
    def extract_level(self, team_name):
        """Extract competition level from team name"""
        level_patterns = ['AAA', 'AA', 'A', 'HS', 'Rep', 'Select', 'DS', 'Rec']
        
        for level in level_patterns:
            if level in team_name:
                return level
        
        return 'HS'  # Default
    
    def extract_organization(self, team_name, division, level):
        """Extract organization name from team name"""
        # Remove common suffixes
        org_name = team_name
        
        # Remove division and level
        org_name = re.sub(rf'\b{division}\b', '', org_name)
        org_name = re.sub(rf'\b{level}\b', '', org_name)
        
        # Remove common words
        remove_words = ['Select', 'Team', 'Baseball', 'Club']
        for word in remove_words:
            org_name = re.sub(rf'\b{word}\b', '', org_name, flags=re.IGNORECASE)
        
        # Clean up spacing
        org_name = ' '.join(org_name.split())
        
        # Take meaningful part (usually first 2-3 words)
        words = org_name.split()
        if len(words) >= 2:
            return ' '.join(words[:3])
        else:
            return org_name
    
    def map_affiliate(self, organization):
        """Map organization to proper affiliate"""
        org_lower = organization.lower()
        
        affiliate_mapping = {
            'SPBA': ['forest glade', 'essex', 'windsor', 'lasalle', 'amherstburg', 'woodslee', 'leamington'],
            'SCBA': ['london', 'st thomas', 'chatham', 'sarnia', 'strathroy'],
            'GTBA': ['toronto', 'mississauga', 'scarborough', 'etobicoke', 'markham', 'vaughan'],
            'HGBA': ['hamilton', 'burlington', 'dundas', 'ancaster'],
            'KWBA': ['kitchener', 'waterloo', 'cambridge', 'guelph'],
            'NCBA': ['ottawa', 'nepean', 'orleans', 'gloucester', 'kanata'],
            'NBBA': ['st. catharines', 'niagara', 'welland', 'thorold'],
            'TBBA': ['thunder bay']
        }
        
        for affiliate, keywords in affiliate_mapping.items():
            if any(keyword in org_lower for keyword in keywords):
                return affiliate
        
        return 'DISCOVERED'
    
    def count_players(self, content):
        """Try to count players from roster content"""
        # Look for player count patterns
        patterns = [
            r'(\d+)\s*players?',
            r'roster.*?(\d+)',
            r'(\d+)\s*(?:player|member)s?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                count = int(match.group(1))
                if 8 <= count <= 25:  # Reasonable team size
                    return count
        
        return 0
    
    def is_authentic_team(self, team_info):
        """Verify this is an authentic team"""
        return (
            team_info and
            team_info.get('name') and
            team_info.get('organization') and
            team_info.get('division') != 'Unknown' and
            len(team_info.get('organization', '')) > 2
        )
    
    def store_teams(self, teams):
        """Store discovered teams in database"""
        if not teams:
            return 0
            
        conn = psycopg2.connect(os.environ['DATABASE_URL'], cursor_factory=RealDictCursor)
        cursor = conn.cursor()
        
        stored_count = 0
        for team in teams:
            try:
                cursor.execute('''
                    INSERT INTO oba_teams 
                    (team_id, team_name, organization, division, level, affiliate, has_roster, player_count, last_scanned)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NOW())
                    ON CONFLICT (team_id) DO UPDATE SET
                        team_name = EXCLUDED.team_name,
                        organization = EXCLUDED.organization,
                        division = EXCLUDED.division,
                        level = EXCLUDED.level,
                        affiliate = EXCLUDED.affiliate,
                        has_roster = EXCLUDED.has_roster,
                        player_count = EXCLUDED.player_count,
                        last_scanned = NOW()
                ''', (
                    team['team_id'],
                    team['name'],
                    team['organization'],
                    team['division'],
                    team['level'],
                    team['affiliate'],
                    True,
                    team.get('player_count', 0)
                ))
                
                stored_count += 1
                
            except Exception as e:
                print(f"Error storing team {team['team_id']}: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return stored_count
    
    def scan_full_range(self, start_id=500000, end_id=510000, batch_size=100, max_workers=3):
        """Scan the complete range with parallel processing"""
        print(f"Starting full range scan: {start_id} to {end_id}")
        print(f"Batch size: {batch_size}, Workers: {max_workers}")
        
        all_teams = []
        total_batches = (end_id - start_id) // batch_size
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            
            # Submit all batches
            for batch_start in range(start_id, end_id, batch_size):
                batch_end = min(batch_start + batch_size, end_id)
                future = executor.submit(self.scan_team_batch, batch_start, batch_end)
                futures.append((future, batch_start, batch_end))
            
            # Process completed batches
            completed_batches = 0
            for future, batch_start, batch_end in futures:
                try:
                    batch_teams = future.result(timeout=300)  # 5 minute timeout per batch
                    all_teams.extend(batch_teams)
                    completed_batches += 1
                    
                    print(f"Batch {batch_start}-{batch_end} complete: {len(batch_teams)} teams found")
                    print(f"Progress: {completed_batches}/{total_batches} batches ({len(all_teams)} total teams)")
                    
                    # Store batch results immediately
                    if batch_teams:
                        stored = self.store_teams(batch_teams)
                        print(f"Stored {stored} teams from batch")
                    
                except Exception as e:
                    print(f"Batch {batch_start}-{batch_end} failed: {e}")
                
                # Rate limiting
                time.sleep(1)
        
        return all_teams

def main():
    scanner = FullRangeOBAScanner()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'test':
            # Test scan on small range
            teams = scanner.scan_full_range(500300, 500400, 20, 2)
            print(f"\nTest scan complete: {len(teams)} teams discovered")
        elif sys.argv[1] == 'full':
            # Full range scan
            teams = scanner.scan_full_range(500000, 510000, 100, 3)
            print(f"\nFull scan complete: {len(teams)} teams discovered")
        else:
            # Custom range
            start = int(sys.argv[1])
            end = int(sys.argv[2]) if len(sys.argv) > 2 else start + 500
            teams = scanner.scan_full_range(start, end, 50, 3)
            print(f"\nCustom scan complete: {len(teams)} teams discovered")
    else:
        # Default: medium test scan
        teams = scanner.scan_full_range(500000, 502000, 50, 3)
        print(f"\nMedium scan complete: {len(teams)} teams discovered")

if __name__ == "__main__":
    main()