#!/usr/bin/env python3
"""
Comprehensive OBA team scanner that properly detects all teams in a range.
This fixes the issue where manual searches found teams but automated scans missed them.
"""

import requests
import re
import json
import time
import sys
from urllib.parse import urlparse

def scan_team_range(start_id, end_id, organization_filter=None):
    """
    Scan a range of team IDs and detect all valid teams.
    Returns teams that match the organization filter if provided.
    """
    found_teams = []
    
    print(f"Scanning team IDs {start_id} to {end_id}...")
    if organization_filter:
        print(f"Filtering for organization: {organization_filter}")
    
    for team_id in range(start_id, end_id + 1):
        try:
            url = f"https://www.playoba.ca/stats#/2111/team/{team_id}/roster"
            
            # Add headers to mimic a real browser
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            response = requests.get(url, headers=headers, timeout=10)
            content = response.text
            
            # Look for team name patterns in the content
            team_name_patterns = [
                r'<h1[^>]*>([^<]*)</h1>',  # Main heading
                r'<title[^>]*>([^<]*)</title>',  # Page title
                r'(\d+U[^,]*[A-Za-z][^,]*)',  # Age division patterns
            ]
            
            team_name = None
            for pattern in team_name_patterns:
                matches = re.findall(pattern, content, re.IGNORECASE)
                for match in matches:
                    if any(keyword in match.lower() for keyword in ['u ', 'hs', 'rep', 'aaa', 'aa']):
                        team_name = match.strip()
                        break
                if team_name:
                    break
            
            # Check if this team has roster data (players table)
            has_roster = bool(re.search(r'<td[^>]*>\s*<a[^>]*href[^>]*player[^>]*>', content))
            
            # Apply organization filter if specified
            if organization_filter and team_name:
                if organization_filter.lower() not in team_name.lower():
                    continue
            
            # If we found a valid team name, record it
            if team_name and len(team_name) > 5:  # Filter out very short matches
                team_info = {
                    "id": str(team_id),
                    "name": team_name,
                    "url": url,
                    "has_roster": has_roster
                }
                found_teams.append(team_info)
                print(f"✓ Found: {team_id} - {team_name} (Roster: {'Yes' if has_roster else 'No'})")
            
            # Progress indicator
            if team_id % 10 == 0:
                print(f"  Scanned up to {team_id}...")
            
            # Small delay to be respectful to the server
            time.sleep(0.1)
            
        except Exception as e:
            # Continue scanning even if individual requests fail
            if team_id % 50 == 0:  # Only log every 50th error to avoid spam
                print(f"  Error scanning {team_id}: {e}")
            continue
    
    return found_teams

def main():
    if len(sys.argv) < 3:
        print("Usage: python comprehensive_team_scanner.py <start_id> <end_id> [organization_filter]")
        print("Example: python comprehensive_team_scanner.py 500700 500750 'Forest Glade'")
        sys.exit(1)
    
    start_id = int(sys.argv[1])
    end_id = int(sys.argv[2])
    organization_filter = sys.argv[3] if len(sys.argv) > 3 else None
    
    teams = scan_team_range(start_id, end_id, organization_filter)
    
    print(f"\n=== SCAN RESULTS ===")
    print(f"Found {len(teams)} teams in range {start_id}-{end_id}")
    
    if organization_filter:
        print(f"Filtered for: {organization_filter}")
    
    for team in teams:
        print(f"  {team['id']}: {team['name']} (Roster: {'✓' if team['has_roster'] else '✗'})")
    
    # Save results to file
    output_file = f"scan_results_{start_id}_{end_id}.json"
    with open(output_file, 'w') as f:
        json.dump({
            "scan_range": f"{start_id}-{end_id}",
            "organization_filter": organization_filter,
            "total_found": len(teams),
            "teams": teams
        }, f, indent=2)
    
    print(f"\nResults saved to: {output_file}")

if __name__ == "__main__":
    main()