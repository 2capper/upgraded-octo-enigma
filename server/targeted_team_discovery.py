#!/usr/bin/env python3
"""
Targeted OBA Team Discovery - Focus on Active Ranges
Efficiently discovers authentic teams by targeting known active ranges and using pattern detection
"""

import requests
import psycopg2
import os
import json
import time
import re
import sys
from psycopg2.extras import RealDictCursor

class TargetedTeamDiscovery:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        self.affiliates = ['2111', '0700', '2100', '0900', '1200']
        
        # Known active ranges based on existing data
        self.active_ranges = [
            (500200, 500600),   # Core active range
            (500700, 501200),   # Extended active range
            (501500, 502000),   # Higher range
            (505000, 506000),   # Skip ahead to find more
            (507000, 508000),   # Even higher
        ]
    
    def discover_in_ranges(self):
        """Discover teams in all active ranges"""
        all_discovered = []
        
        for start, end in self.active_ranges:
            print(f"\nScanning range {start}-{end}...")
            discovered = self.scan_range_efficiently(start, end)
            all_discovered.extend(discovered)
            print(f"Found {len(discovered)} teams in range {start}-{end}")
            
            # Store immediately
            if discovered:
                stored = self.store_teams(discovered)
                print(f"Stored {stored} teams")
            
            time.sleep(2)  # Rate limiting between ranges
        
        return all_discovered
    
    def scan_range_efficiently(self, start_id, end_id, step=5):
        """Scan range efficiently by sampling and expanding around hits"""
        discovered_teams = []
        
        # First pass: sample every 'step' IDs to find active areas
        active_areas = []
        for team_id in range(start_id, end_id, step):
            if self.quick_check_team_exists(team_id):
                active_areas.append(team_id)
                print(f"✓ Active area found around {team_id}")
        
        # Second pass: thoroughly scan around active areas
        for center in active_areas:
            # Scan 20 IDs around each active area
            range_start = max(start_id, center - 10)
            range_end = min(end_id, center + 10)
            
            for team_id in range(range_start, range_end):
                team_info = self.extract_authentic_team(team_id)
                if team_info:
                    discovered_teams.append(team_info)
                    print(f"✓ {team_id}: {team_info['name']} ({team_info['organization']})")
        
        return discovered_teams
    
    def quick_check_team_exists(self, team_id):
        """Quick check if team exists without full parsing"""
        for affiliate in self.affiliates[:2]:  # Only check first 2 affiliates for speed
            try:
                url = f'https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster'
                response = requests.get(url, headers=self.headers, timeout=5)
                
                if response.status_code == 200:
                    content = response.text.lower()
                    # Quick indicators of real team page
                    if ('roster' in content and 'player' in content and 
                        len(content) > 6000 and 'login' not in content):
                        return True
            except:
                continue
        return False
    
    def extract_authentic_team(self, team_id):
        """Extract complete team information"""
        for affiliate in self.affiliates:
            try:
                url = f'https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster'
                response = requests.get(url, headers=self.headers, timeout=8)
                
                if response.status_code == 200:
                    content = response.text
                    
                    if self.is_valid_team_page(content):
                        return self.parse_team_data(content, team_id, affiliate)
                        
            except requests.RequestException:
                continue
        return None
    
    def is_valid_team_page(self, content):
        """Check if page contains valid team data"""
        return (
            'roster' in content.lower() and
            'player' in content.lower() and
            len(content) > 8000 and
            'login' not in content.lower() and
            'error' not in content.lower()
        )
    
    def parse_team_data(self, content, team_id, affiliate):
        """Parse comprehensive team data from page"""
        try:
            # Extract team name from title
            title_match = re.search(r'<title[^>]*>([^<]*?)\s*(?:-\s*Stats)?(?:\s*-\s*Ontario Baseball Association)?</title>', content, re.IGNORECASE)
            if not title_match:
                return None
            
            team_name = title_match.group(1).strip()
            
            # Validate team name
            if not self.is_valid_team_name(team_name):
                return None
            
            # Parse components
            division = self.extract_division(team_name)
            level = self.extract_level(team_name)
            organization = self.extract_organization(team_name, division, level)
            affiliate_mapped = self.map_affiliate(organization)
            player_count = self.count_players(content)
            
            return {
                'team_id': str(team_id),
                'name': team_name,
                'organization': organization,
                'division': division,
                'level': level,
                'affiliate': affiliate_mapped,
                'player_count': player_count
            }
            
        except Exception as e:
            return None
    
    def is_valid_team_name(self, name):
        """Validate extracted team name"""
        return (
            name and
            len(name) > 5 and
            name != 'Stats' and
            name != 'Ontario Baseball Association' and
            ('U ' in name or re.search(r'\\d+U', name)) and
            not any(word in name.lower() for word in ['login', 'error', 'not found'])
        )
    
    def extract_division(self, team_name):
        """Extract age division"""
        match = re.search(r'(\\d+U)', team_name)
        return match.group(1) if match else 'Unknown'
    
    def extract_level(self, team_name):
        """Extract competition level"""
        levels = ['AAA', 'AA', 'A', 'HS', 'Rep', 'Select', 'DS', 'Rec']
        for level in levels:
            if level in team_name:
                return level
        return 'HS'
    
    def extract_organization(self, team_name, division, level):
        """Extract organization name handling variations like 'South Woodslee' vs 'Woodslee'"""
        # Remove division and level
        org_name = team_name
        org_name = re.sub(rf'\\b{division}\\b', '', org_name)
        org_name = re.sub(rf'\\b{level}\\b', '', org_name)
        
        # Remove common prefixes that might cause variation issues
        prefixes_to_normalize = ['South ', 'North ', 'East ', 'West ', 'St. ', 'St ']
        for prefix in prefixes_to_normalize:
            if org_name.startswith(prefix):
                # Keep the base name but note the full version
                org_name = org_name[len(prefix):]
        
        # Remove common suffixes
        suffixes = ['Select', 'Team', 'Baseball', 'Club']
        for suffix in suffixes:
            org_name = re.sub(rf'\\b{suffix}\\b', '', org_name, flags=re.IGNORECASE)
        
        # Clean up and get meaningful part
        org_name = ' '.join(org_name.split())
        words = org_name.split()
        
        if len(words) >= 2:
            return ' '.join(words[:3])  # Take up to 3 words
        else:
            return org_name
    
    def map_affiliate(self, organization):
        """Map organization to affiliate, handling regional variations"""
        org_lower = organization.lower()
        
        # Comprehensive mapping including variations
        affiliate_mapping = {
            'SPBA': [
                'forest glade', 'essex', 'windsor', 'lasalle', 'amherstburg', 
                'woodslee', 'leamington', 'kingsville', 'lakeshore', 'tecumseh'
            ],
            'SCBA': [
                'london', 'st thomas', 'chatham', 'sarnia', 'strathroy',
                'badgers', 'talons', 'scorpions', 'tincaps'
            ],
            'GTBA': [
                'toronto', 'mississauga', 'scarborough', 'etobicoke', 'markham', 
                'vaughan', 'brampton', 'pickering', 'ajax'
            ],
            'HGBA': [
                'hamilton', 'burlington', 'dundas', 'ancaster', 'steelers', 'cardinals'
            ],
            'KWBA': [
                'kitchener', 'waterloo', 'cambridge', 'guelph', 'tigers', 'panthers'
            ],
            'NCBA': [
                'ottawa', 'nepean', 'orleans', 'gloucester', 'kanata'
            ],
            'NBBA': [
                'st. catharines', 'niagara', 'welland', 'thorold'
            ],
            'TBBA': [
                'thunder bay'
            ]
        }
        
        for affiliate, keywords in affiliate_mapping.items():
            if any(keyword in org_lower for keyword in keywords):
                return affiliate
        
        return 'DISCOVERED'
    
    def count_players(self, content):
        """Count players from roster content"""
        patterns = [
            r'(\\d+)\\s*players?',
            r'roster.*?(\\d+)',
            r'(\\d+)\\s*(?:player|member)s?'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, content, re.IGNORECASE)
            if match:
                count = int(match.group(1))
                if 8 <= count <= 25:
                    return count
        return 0
    
    def store_teams(self, teams):
        """Store teams in database"""
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

def main():
    discovery = TargetedTeamDiscovery()
    
    print("Starting targeted OBA team discovery...")
    print("Focusing on active ranges for efficient scanning")
    
    discovered_teams = discovery.discover_in_ranges()
    
    print(f"\\nDiscovery complete!")
    print(f"Total authentic teams discovered: {len(discovered_teams)}")
    
    # Show sample of discoveries
    if discovered_teams:
        print("\\nSample discoveries:")
        for team in discovered_teams[:10]:
            print(f"  {team['team_id']}: {team['name']} ({team['organization']})")

if __name__ == "__main__":
    main()