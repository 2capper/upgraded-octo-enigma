#!/usr/bin/env python3
"""
Real OBA Roster Scraper - Direct Web Extraction
Extracts authentic roster data directly from playoba.ca using web scraping
"""

import requests
from bs4 import BeautifulSoup
import psycopg2
import os
import json
import sys
import re
from psycopg2.extras import RealDictCursor

class RealOBAScraper:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)
    
    def extract_roster_for_team(self, team_id):
        """Extract roster for specific team ID using direct web scraping"""
        print(f"Extracting roster for team {team_id}...")
        
        # Try multiple affiliate numbers since the team ID is what matters
        affiliates = ['2111', '0700', '2100', '0900', '1200', '2106', '2107']
        
        for affiliate in affiliates:
            try:
                url = f'https://www.playoba.ca/stats#/{affiliate}/team/{team_id}/roster'
                print(f"Trying URL: {url}")
                
                response = self.session.get(url, timeout=10)
                
                if response.status_code == 200:
                    # Parse the page content
                    roster_data = self.parse_roster_page(response.text, team_id)
                    if roster_data and roster_data.get('players'):
                        return roster_data
                        
            except Exception as e:
                print(f"Error with affiliate {affiliate}: {e}")
                continue
        
        return None
    
    def parse_roster_page(self, html_content, team_id):
        """Parse roster information from HTML content"""
        try:
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Extract team name from title or header
            team_name = self.extract_team_name(soup, html_content)
            if not team_name or team_name == "Stats":
                return None
            
            # Find player data in various possible formats
            players = self.extract_players(soup, html_content)
            
            if not players:
                return None
            
            return {
                'success': True,
                'team_id': team_id,
                'team_name': team_name,
                'players': players,
                'source': 'web_scraping',
                'player_count': len(players)
            }
            
        except Exception as e:
            print(f"Error parsing roster page: {e}")
            return None
    
    def extract_team_name(self, soup, html_content):
        """Extract team name from various page elements"""
        # Try title tag
        title = soup.find('title')
        if title:
            title_text = title.get_text().strip()
            if title_text and title_text != 'Stats - Ontario Baseball Association':
                # Clean up title
                title_text = re.sub(r'\s*-\s*Stats.*$', '', title_text)
                title_text = re.sub(r'\s*-\s*Ontario Baseball Association.*$', '', title_text)
                if len(title_text) > 5:
                    return title_text
        
        # Try h1 tags
        h1_tags = soup.find_all('h1')
        for h1 in h1_tags:
            text = h1.get_text().strip()
            if text and len(text) > 5 and 'U ' in text:
                return text
        
        # Look for team name in content
        team_patterns = [
            r'team["\s]*name["\s]*[:\=]["\s]*([^"]{10,50})',
            r'"([^"]*\d+U[^"]*)"',
            r'<h2[^>]*>([^<]*\d+U[^<]*)</h2>'
        ]
        
        for pattern in team_patterns:
            match = re.search(pattern, html_content, re.IGNORECASE)
            if match:
                name = match.group(1).strip()
                if len(name) > 5 and 'U' in name:
                    return name
        
        return None
    
    def extract_players(self, soup, html_content):
        """Extract player roster from page content"""
        players = []
        
        # Method 1: Look for table rows with player data
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    # Try to extract player info
                    player_info = self.parse_player_row(cells)
                    if player_info:
                        players.append(player_info)
        
        # Method 2: Look for player data in JSON or structured format
        if not players:
            players = self.extract_players_from_json(html_content)
        
        # Method 3: Look for player names in lists
        if not players:
            players = self.extract_players_from_lists(soup)
        
        # Method 4: Pattern matching for player data
        if not players:
            players = self.extract_players_from_patterns(html_content)
        
        return players
    
    def parse_player_row(self, cells):
        """Parse a table row that might contain player data"""
        if len(cells) < 2:
            return None
        
        # Get text from cells
        cell_texts = [cell.get_text().strip() for cell in cells]
        
        # Look for player number and name pattern
        for i, text in enumerate(cell_texts):
            if re.match(r'^\d{1,2}$', text):  # Jersey number
                if i + 1 < len(cell_texts):
                    name = cell_texts[i + 1].strip()
                    if len(name) > 2 and not re.match(r'^\d+$', name):
                        return {
                            'number': text,
                            'name': name,
                            'position': cell_texts[i + 2] if i + 2 < len(cell_texts) else ''
                        }
        
        # Alternative: name in first column, number in second
        if len(cell_texts[0]) > 2 and not re.match(r'^\d+$', cell_texts[0]):
            if re.match(r'^\d{1,2}$', cell_texts[1]):
                return {
                    'number': cell_texts[1],
                    'name': cell_texts[0],
                    'position': cell_texts[2] if len(cell_texts) > 2 else ''
                }
        
        return None
    
    def extract_players_from_json(self, html_content):
        """Look for player data in JSON format within the HTML"""
        players = []
        
        # Common JSON patterns for player data
        json_patterns = [
            r'players["\s]*:["\s]*\[([^\]]+)\]',
            r'roster["\s]*:["\s]*\[([^\]]+)\]',
            r'"players":\s*\[([^\]]+)\]'
        ]
        
        for pattern in json_patterns:
            matches = re.finditer(pattern, html_content, re.IGNORECASE | re.DOTALL)
            for match in matches:
                try:
                    json_str = '[' + match.group(1) + ']'
                    data = json.loads(json_str)
                    for item in data:
                        if isinstance(item, dict) and 'name' in item:
                            players.append({
                                'number': str(item.get('number', '')),
                                'name': item.get('name', ''),
                                'position': item.get('position', '')
                            })
                except:
                    continue
        
        return players
    
    def extract_players_from_lists(self, soup):
        """Extract players from list elements"""
        players = []
        
        # Look for unordered or ordered lists
        lists = soup.find_all(['ul', 'ol'])
        for lst in lists:
            items = lst.find_all('li')
            for item in items:
                text = item.get_text().strip()
                # Look for pattern like "5. John Smith" or "John Smith (#5)"
                match = re.match(r'^(\d+)\.?\s+(.+)$', text)
                if match:
                    players.append({
                        'number': match.group(1),
                        'name': match.group(2).strip(),
                        'position': ''
                    })
                else:
                    # Look for name with number in parentheses
                    match = re.match(r'^(.+)\s*\(#?(\d+)\)$', text)
                    if match:
                        players.append({
                            'number': match.group(2),
                            'name': match.group(1).strip(),
                            'position': ''
                        })
        
        return players
    
    def extract_players_from_patterns(self, html_content):
        """Extract players using regex patterns"""
        players = []
        
        # Pattern for common player listing formats
        patterns = [
            r'(\d+)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',  # "5 John Smith"
            r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+#?(\d+)',  # "John Smith 5" or "John Smith #5"
            r'<td[^>]*>(\d+)</td>\s*<td[^>]*>([^<]+)</td>',  # Table cells
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, html_content, re.MULTILINE)
            for match in matches:
                if len(match.groups()) == 2:
                    # Determine which group is number vs name
                    group1, group2 = match.groups()
                    if re.match(r'^\d+$', group1):
                        number, name = group1, group2
                    else:
                        number, name = group2, group1
                    
                    name = name.strip()
                    if len(name) > 2 and len(name) < 50:
                        players.append({
                            'number': number,
                            'name': name,
                            'position': ''
                        })
        
        return players
    
    def test_team_extraction(self, team_id):
        """Test extraction for a specific team"""
        roster_data = self.extract_roster_for_team(team_id)
        
        if roster_data:
            print(f"✓ Successfully extracted roster for {roster_data['team_name']}")
            print(f"  Team ID: {roster_data['team_id']}")
            print(f"  Players: {len(roster_data['players'])}")
            print(f"  Source: {roster_data['source']}")
            
            if roster_data['players']:
                print("  Sample players:")
                for player in roster_data['players'][:5]:
                    print(f"    #{player['number']}: {player['name']}")
            
            return roster_data
        else:
            print(f"✗ Could not extract roster for team {team_id}")
            return None

def main():
    scraper = RealOBAScraper()
    
    if len(sys.argv) > 1:
        team_id = sys.argv[1]
        print(f"Testing roster extraction for team {team_id}")
        
        roster_data = scraper.test_team_extraction(team_id)
        
        if roster_data:
            # Output as JSON for API compatibility
            print(json.dumps(roster_data, indent=2))
        else:
            print(json.dumps({
                'success': False,
                'error': f'Could not extract roster for team {team_id}',
                'team_id': team_id
            }))
    else:
        # Test with a known team
        print("Testing with team 500903 (London Badgers)...")
        scraper.test_team_extraction('500903')

if __name__ == "__main__":
    main()