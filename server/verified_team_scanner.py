#!/usr/bin/env python3
"""
Verified Team Scanner - Only Real Teams
Scans OBA teams with rigorous verification to ensure only authentic teams are stored
"""

import requests
import psycopg2
import os
import json
import sys
import re
import time
from psycopg2.extras import RealDictCursor

class VerifiedTeamScanner:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        # Known working affiliates
        self.affiliates = ['2111', '0700', '2100', '0900', '1200']
    
    def verify_and_scan_range(self, start_id, end_id):
        """Scan range with strict verification - only store confirmed authentic teams"""
        print(f"Scanning {start_id}-{end_id} with strict verification...")
        
        verified_teams = []
        
        for team_id in range(start_id, end_id + 1):
            print(f"Verifying team {team_id}...", end=" ")
            
            verified_team = self.verify_team_exists(team_id)
            if verified_team:
                verified_teams.append(verified_team)
                print(f"✓ VERIFIED: {verified_team['name']}")
            else:
                print("✗ Not found")
            
            # Rate limiting
            time.sleep(0.5)
        
        return verified_teams
    
    def verify_team_exists(self, team_id):
        """Rigorous verification that team actually exists on OBA website"""
        
        for affiliate in self.affiliates:
            try:
                url = f'https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster'
                response = requests.get(url, headers=self.headers, timeout=10)
                
                if response.status_code == 200:
                    content = response.text
                    
                    # Multiple verification checks
                    if self.is_authentic_team_page(content):
                        team_data = self.extract_verified_team_data(content, team_id, affiliate)
                        if team_data and self.final_authenticity_check(team_data):
                            return team_data
                            
            except Exception:
                continue
        
        return None
    
    def is_authentic_team_page(self, content):
        """Strict checks to verify this is a real team page"""
        
        # Must have substantial content
        if len(content) < 8000:
            return False
        
        # Must not be generic pages
        if any(generic in content.lower() for generic in [
            'login required', 'error', 'not found', 'access denied'
        ]):
            return False
        
        # Must contain roster-related content
        roster_indicators = ['roster', 'player', 'team']
        if not any(indicator in content.lower() for indicator in roster_indicators):
            return False
        
        # Check for actual team name in title
        title_match = re.search(r'<title[^>]*>([^<]+)</title>', content)
        if not title_match:
            return False
        
        title = title_match.group(1).strip()
        
        # Reject generic titles
        if title in ['Stats - Ontario Baseball Association', 'Stats', 'Ontario Baseball Association']:
            return False
        
        # Must contain age division
        if not re.search(r'\\d+U', title):
            return False
        
        return True
    
    def extract_verified_team_data(self, content, team_id, affiliate):
        """Extract team data with additional verification"""
        try:
            # Extract title
            title_match = re.search(r'<title[^>]*>([^<]+)</title>', content)
            if not title_match:
                return None
            
            full_title = title_match.group(1).strip()
            
            # Clean title
            team_name = re.sub(r'\\s*-\\s*Stats.*$', '', full_title)
            team_name = re.sub(r'\\s*-\\s*Ontario Baseball Association.*$', '', team_name)
            team_name = team_name.strip()
            
            if len(team_name) < 5:
                return None
            
            # Extract components
            division_match = re.search(r'(\\d+U)', team_name)
            division = division_match.group(1) if division_match else None
            
            if not division:  # Must have valid division
                return None
            
            # Extract level
            level = self.extract_level(team_name)
            
            # Extract organization
            organization = self.extract_organization(team_name, division, level)
            
            # Map affiliate
            mapped_affiliate = self.map_affiliate(organization)
            
            return {
                'team_id': str(team_id),
                'name': team_name,
                'organization': organization,
                'division': division,
                'level': level,
                'affiliate': mapped_affiliate,
                'source_affiliate': affiliate,
                'verified': True
            }
            
        except Exception:
            return None
    
    def extract_level(self, team_name):
        """Extract competition level"""
        levels = ['AAA', 'AA', 'A', 'HS', 'Rep', 'Select', 'DS', 'Rec']
        for level in levels:
            if level in team_name:
                return level
        return 'HS'  # Default
    
    def extract_organization(self, team_name, division, level):
        """Extract organization name"""
        org_name = team_name
        
        # Remove division and level
        org_name = re.sub(rf'\\b{division}\\b', '', org_name)
        org_name = re.sub(rf'\\b{level}\\b', '', org_name)
        
        # Clean up
        org_name = ' '.join(org_name.split()).strip()
        
        # Take meaningful part
        words = org_name.split()
        if len(words) >= 2:
            return ' '.join(words[:3])
        else:
            return org_name
    
    def map_affiliate(self, organization):
        """Map to proper affiliate"""
        org_lower = organization.lower()
        
        affiliate_mapping = {
            'SPBA': ['forest glade', 'essex', 'windsor', 'lasalle', 'amherstburg', 'woodslee', 'leamington'],
            'SCBA': ['london', 'st thomas', 'chatham', 'sarnia'],
            'GTBA': ['toronto', 'mississauga', 'scarborough', 'etobicoke', 'markham'],
            'HGBA': ['hamilton', 'burlington', 'dundas'],
            'KWBA': ['kitchener', 'waterloo', 'cambridge', 'guelph'],
            'NCBA': ['ottawa', 'nepean', 'orleans'],
            'NBBA': ['niagara', 'welland', 'thorold'],
            'TBBA': ['thunder bay']
        }
        
        for affiliate, keywords in affiliate_mapping.items():
            if any(keyword in org_lower for keyword in keywords):
                return affiliate
        
        return 'VERIFIED'
    
    def final_authenticity_check(self, team_data):
        """Final check to ensure team data looks authentic"""
        
        # Must have meaningful organization name
        if not team_data.get('organization') or len(team_data['organization']) < 3:
            return False
        
        # Must have valid division
        if not team_data.get('division') or not re.match(r'\\d+U', team_data['division']):
            return False
        
        # Organization name shouldn't be too generic
        generic_orgs = ['stats', 'ontario', 'baseball', 'association', 'team', 'club']
        org_lower = team_data['organization'].lower()
        if any(generic in org_lower for generic in generic_orgs):
            return False
        
        return True
    
    def store_verified_teams(self, teams):
        """Store only verified authentic teams"""
        if not teams:
            return 0
        
        conn = psycopg2.connect(os.environ['DATABASE_URL'], cursor_factory=RealDictCursor)
        cursor = conn.cursor()
        
        stored_count = 0
        for team in teams:
            try:
                cursor.execute('''
                    INSERT INTO oba_teams 
                    (team_id, team_name, organization, division, level, affiliate, has_roster, last_scanned, verified)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW(), %s)
                    ON CONFLICT (team_id) DO UPDATE SET
                        team_name = EXCLUDED.team_name,
                        organization = EXCLUDED.organization,
                        division = EXCLUDED.division,
                        level = EXCLUDED.level,
                        affiliate = EXCLUDED.affiliate,
                        last_scanned = NOW(),
                        verified = EXCLUDED.verified
                ''', (
                    team['team_id'],
                    team['name'],
                    team['organization'],
                    team['division'],
                    team['level'],
                    team['affiliate'],
                    True,
                    True
                ))
                
                stored_count += 1
                
            except Exception as e:
                print(f"Error storing team {team['team_id']}: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return stored_count

def main():
    scanner = VerifiedTeamScanner()
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'test':
            # Test scan on small range with verification
            teams = scanner.verify_and_scan_range(500400, 500450)
            stored = scanner.store_verified_teams(teams)
            print(f"\\nVerified scan complete: {len(teams)} authentic teams found, {stored} stored")
        else:
            # Custom range
            start = int(sys.argv[1])
            end = int(sys.argv[2]) if len(sys.argv) > 2 else start + 25
            teams = scanner.verify_and_scan_range(start, end)
            stored = scanner.store_verified_teams(teams)
            print(f"\\nRange {start}-{end} scan complete: {len(teams)} authentic teams found, {stored} stored")
    else:
        # Default test
        teams = scanner.verify_and_scan_range(500350, 500375)
        stored = scanner.store_verified_teams(teams)
        print(f"\\nDefault scan complete: {len(teams)} authentic teams found, {stored} stored")

if __name__ == "__main__":
    main()