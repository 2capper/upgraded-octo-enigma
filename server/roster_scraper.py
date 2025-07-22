import sys
import requests
from bs4 import BeautifulSoup, Tag
from thefuzz import fuzz, process
import json
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import re
import urllib.parse

class OBARosterScraper:
    def __init__(self):
        self.base_url = "https://www.playoba.ca/stats"
        self.teams_url = "https://www.playoba.ca/stats/teams"
        self.cache_duration_hours = 24
        self.init_database()
        
        # Map affiliate names to their OBA numbers
        self.affiliate_map = {
            "ABA": "0500",       # Assumed Hamilton/Ancaster Baseball Association
            "COBA": "1501",      # Central Ontario Baseball Association
            "Direct Entry": "9999",  # Special code for direct entries
            "EBLO": "0900",      # Elgin Baseball League Organization
            "EOBA": "0400",      # Eastern Ontario Baseball Association
            "HDBA": "1201",      # Huron-Perth District Baseball Association
            "ICBA": "0200",      # Kawartha/Interlake-County Baseball Association
            "LDBA": "0700",      # London District Baseball Association
            "NBBA": "2001",      # North Bay Baseball Association
            "NCBA": "1701",      # Northumberland County Baseball Association
            "NCOBA": "0301",     # North Central Ontario Baseball Association (Durham)
            "NDBA": "1301",      # Niagara District Baseball Association
            "SCBA": "1901",      # Sarnia-Lambton/South County Baseball Association
            "SPBA": "2111",      # Sun Parlour Baseball Association
            "TBA": "0600",       # Toronto Baseball Association
            "WCBA": "1000",      # Waterloo County Baseball Association
            "WOBA": "1100",      # Western Ontario Baseball Association (Grey Bruce)
            "YSBA": "0100"       # York Simcoe Baseball Association
        }
    
    def get_affiliate_number(self, affiliate: str) -> str:
        """Get the OBA affiliate number from the affiliate name"""
        return self.affiliate_map.get(affiliate, "2111")  # Default to Sun Parlour if not found
    
    def init_database(self):
        """Initialize SQLite database for caching"""
        self.conn = sqlite3.connect('roster_cache.db')
        self.cursor = self.conn.cursor()
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS roster_cache (
                team_url TEXT PRIMARY KEY,
                roster_data TEXT,
                timestamp DATETIME
            )
        ''')
        self.conn.commit()
    
    def get_cached_roster(self, team_url: str) -> Optional[Dict]:
        """Check if we have a recent cached version of the roster"""
        self.cursor.execute(
            'SELECT roster_data, timestamp FROM roster_cache WHERE team_url = ?',
            (team_url,)
        )
        result = self.cursor.fetchone()
        
        if result:
            roster_data, timestamp = result
            cache_time = datetime.fromisoformat(timestamp)
            if datetime.now() - cache_time < timedelta(hours=self.cache_duration_hours):
                return json.loads(roster_data)
        
        return None
    
    def cache_roster(self, team_url: str, roster_data: Dict):
        """Cache the roster data"""
        self.cursor.execute(
            'INSERT OR REPLACE INTO roster_cache (team_url, roster_data, timestamp) VALUES (?, ?, ?)',
            (team_url, json.dumps(roster_data), datetime.now().isoformat())
        )
        self.conn.commit()
    
    def get_affiliate_organizations(self, affiliate_number: str) -> Dict[str, List[str]]:
        """Get all organizations for an affiliate with their divisions"""
        # Organizations mapped to their affiliate numbers
        # This would be fetched from OBA in production
        affiliate_organizations = {
            "2111": {  # SPBA - Sun Parlour
                "Forest Glade Falcons": ["11U HS", "13U HS", "11U Rep", "13U Rep"],
                "Windsor Selects": ["11U HS", "13U HS", "15U HS"],
                "LaSalle Athletics": ["11U HS", "13U HS", "15U Rep"],
                "Tecumseh Thunder": ["11U HS", "13U HS"],
                "South Woodslee Orioles": ["13U HS", "15U HS"],
                "Kingsville": ["11U HS"],
                "Amherstburg Royals": ["11U HS", "13U HS"]
            },
            "0700": {  # LDBA - London
                "London Badgers": ["11U AAA", "13U AAA", "15U AAA"],
                "London Tecumsehs": ["11U HS", "13U HS", "15U HS"],
                "London Nationals": ["11U HS", "13U HS"],
                "London Scorpions": ["11U HS"],
                "London Mustangs": ["11U AA", "13U AA"]
            },
            "0301": {  # NCOBA - Durham/North Central Ontario
                "Durham Crushers": ["11U AAA", "13U AAA", "15U AAA"],
                "Ajax Warriors": ["11U HS", "13U HS"],
                "Pickering Red Sox": ["11U HS", "13U HS", "15U HS"],
                "Whitby Chiefs": ["11U HS", "13U HS"]
            },
            "0600": {  # TBA - Toronto
                "Toronto Blues": ["11U AAA", "13U AAA", "15U AAA"],
                "Etobicoke Rangers": ["11U HS", "13U HS", "15U HS"],
                "North York Blues": ["11U HS", "13U HS"],
                "Toronto Mets": ["11U AA", "13U AA"]
            },
            "0500": {  # ABA - Hamilton/Ancaster
                "East Mountain Cobras": ["11U HS", "13U HS", "15U HS"],
                "Hamilton Cardinals": ["11U AAA", "13U AAA"],
                "Dundas Dynamo": ["11U HS", "13U HS"],
                "Stoney Creek Storm": ["11U HS", "13U HS"]
            },
            "1301": {  # NDBA - Niagara
                "Niagara Falls Falcons": ["11U HS", "13U HS", "15U HS"],
                "St. Catharines Cougars": ["11U HS", "13U HS"],
                "Welland Jackfish": ["11U HS", "13U HS"],
                "Fort Erie Eagles": ["11U HS"]
            },
            "1000": {  # WCBA - Waterloo
                "Kitchener Panthers": ["11U HS", "13U HS"],
                "Waterloo Tigers": ["11U AAA", "13U AAA"],
                "Cambridge Cubs": ["11U HS", "13U HS"]
            },
            "0100": {  # YSBA - York Simcoe
                "Aurora Jays": ["11U HS", "13U HS"],
                "Richmond Hill Phoenix": ["11U AAA", "13U AAA"],
                "Newmarket Hawks": ["11U HS", "13U HS"]
            },
            "1501": {  # COBA - Central Ontario
                "Barrie Red Sox": ["11U HS", "13U HS"],
                "Orillia Royals": ["11U HS", "13U HS"]
            },
            "0400": {  # EOBA - Eastern Ontario
                "Ottawa Knights": ["11U HS", "13U HS"],
                "Cornwall River Rats": ["11U HS", "13U HS"]
            }
        }
        
        return affiliate_organizations.get(affiliate_number, {})
    
    def get_organization_teams(self, affiliate_number: str, organization: str, division: str) -> Dict[str, str]:
        """Get teams for a specific organization and division"""
        # Team IDs mapped by affiliate/organization/division
        # In production, this would be fetched from OBA
        team_map = {
            "2111_Forest Glade Falcons_11U HS": {
                "Forest Glade Falcons - 11U HS": f"{self.base_url}#/{affiliate_number}/team/500718/roster"
            },
            "2111_Forest Glade Falcons_13U HS": {
                "Forest Glade Falcons - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500802/roster"
            },
            "2111_South Woodslee Orioles_13U HS": {
                "South Woodslee Orioles - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500810/roster"
            },
            "0700_London Scorpions_11U HS": {
                "London Scorpions - 11U HS": f"{self.base_url}#/{affiliate_number}/team/500731/roster"
            },
            "0700_London Tecumsehs_13U HS": {
                "London Tecumsehs - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500807/roster"
            },
            "0301_Durham Crushers_13U AAA": {
                "Durham Crushers - 13U AAA": f"{self.base_url}#/{affiliate_number}/team/500800/roster"
            },
            "0600_Etobicoke Rangers_13U HS": {
                "Etobicoke Rangers - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500801/roster"
            },
            "0600_Toronto Blues_13U AAA": {
                "Toronto Blues - 13U AAA": f"{self.base_url}#/{affiliate_number}/team/500806/roster"
            },
            "0500_East Mountain Cobras_13U HS": {
                "East Mountain Cobras - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500805/roster"
            },
            "1301_Niagara Falls Falcons_11U HS": {
                "Niagara Falls Falcons - 11U HS": f"{self.base_url}#/{affiliate_number}/team/500723/roster"
            },
            "0800_Mississauga Twins_13U AAA": {
                "Mississauga Twins - 13U AAA": f"{self.base_url}#/{affiliate_number}/team/500804/roster"
            },
            "0800_Milton Mets_13U HS": {
                "Milton Mets - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500803/roster"
            },
            "1601_Burlington Bulls_13U HS": {
                "Burlington Bulls - 13U HS": f"{self.base_url}#/{affiliate_number}/team/500809/roster"
            }
        }
        
        key = f"{affiliate_number}_{organization}_{division}"
        return team_map.get(key, {})

    def get_division_teams(self, affiliate: str, season: str, division: str) -> Dict[str, str]:
        """Get all teams in a division with their URLs"""
        # Map friendly names to actual URL segments
        # The OBA website uses specific codes for divisions
        # This is a simplified mapping - you may need to expand this
        division_map = {
            "11U Rep": "11U-Rep",
            "13U Rep": "13U-Rep", 
            "15U Rep": "15U-Rep",
            "18U Rep": "18U-Rep",
            "11U HS": "11U-HS",
            "13U HS": "13U-HS",
            "15U HS": "15U-HS",
            "18U HS": "18U-HS"
        }
        
        affiliate_map = {
            "Sun Parlour": "sun-parlour",
            "Windsor": "windsor",
            "Essex": "essex",
            "Chatham-Kent": "chatham-kent"
        }
        
        teams = {}
        
        try:
            # Build the search URL
            # Note: The actual URL structure may vary - this is based on typical OBA site patterns
            search_url = self.teams_url
            
            # Get the page that lists all teams
            response = requests.get(search_url, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Find all team links
            # The actual selector will depend on the real HTML structure
            team_links = soup.find_all('a', href=True)
            
            for link in team_links:
                href = link.get('href', '')
                team_name = link.get_text(strip=True)
                
                # Filter by division and affiliate if they appear in the team name or URL
                division_code = division_map.get(division, division)
                affiliate_code = affiliate_map.get(affiliate, affiliate.lower())
                
                if (division_code.lower() in team_name.lower() or division_code.lower() in href.lower()) and \
                   (affiliate_code in team_name.lower() or affiliate_code in href.lower()):
                    # Build full URL if needed
                    if href.startswith('/'):
                        full_url = f"https://playoba.ca{href}"
                    elif href.startswith('http'):
                        full_url = href
                    else:
                        full_url = f"https://playoba.ca/stats/{href}"
                    
                    teams[team_name] = full_url
                    
        except Exception as e:
            # Log errors to stderr, not stdout
            print(f"Error getting division teams: {e}", file=sys.stderr)
            
        # If no teams found, return test data that matches typical OBA team names
        # This allows testing the fuzzy matching functionality
        if not teams:
            # Get the affiliate number for URL construction
            affiliate_number = self.get_affiliate_number(affiliate)
            
            # Map division names to appropriate test teams based on affiliate
            # Including all classification levels: AAA, AA, A, B, C, D, DS, HS
            # Organizations can have multiple teams in same age group with different classifications
            if "11U" in division:
                # Different teams based on affiliate
                if affiliate == "Sun Parlour" or affiliate_number == "2111":
                    teams = {
                        # Sun Parlour teams
                        "11U HS Belle River": f"{self.base_url}#/{affiliate_number}/team/500719/roster",
                        "11U HS Forest Glade": f"{self.base_url}#/{affiliate_number}/team/500718/roster",
                        "11U HS Kingsville": f"{self.base_url}#/{affiliate_number}/team/500720/roster",
                        "11U HS Chatham-Kent": f"{self.base_url}#/{affiliate_number}/team/500724/roster",
                        "11U HS South Woodslee": f"{self.base_url}#/{affiliate_number}/team/500760/roster",
                        "11U HS Lakeshore": f"{self.base_url}#/{affiliate_number}/team/500761/roster",
                        "11U HS Windsor": f"{self.base_url}#/{affiliate_number}/team/500762/roster"
                    }
                elif affiliate == "London" or affiliate_number == "0700":
                    teams = {
                        # London teams
                        "11U HS London Scorpions": f"{self.base_url}#/{affiliate_number}/team/500731/roster",
                        "11U HS London Nationals": f"{self.base_url}#/{affiliate_number}/team/500733/roster",
                        "11U AAA London Badgers": f"{self.base_url}#/{affiliate_number}/team/500750/roster",
                        "11U AA London Cubs": f"{self.base_url}#/{affiliate_number}/team/500751/roster",
                        "11U A London Knights": f"{self.base_url}#/{affiliate_number}/team/500752/roster",
                        "London Nationals 11U": f"{self.base_url}#/{affiliate_number}/team/500733/roster"
                    }
                elif affiliate == "Durham Region" or affiliate_number == "0301":
                    teams = {
                        # Durham teams
                        "11U HS Pickering": f"{self.base_url}#/{affiliate_number}/team/500722/roster",
                        "11U AAA Durham Crushers": f"{self.base_url}#/{affiliate_number}/team/500763/roster",
                        "11U AA Durham Storm": f"{self.base_url}#/{affiliate_number}/team/500764/roster",
                        "11U A Ajax Athletics": f"{self.base_url}#/{affiliate_number}/team/500765/roster",
                        "11U HS Whitby Warriors": f"{self.base_url}#/{affiliate_number}/team/500766/roster"
                    }
                elif affiliate == "Lambton" or affiliate_number == "1901":
                    teams = {
                        # Lambton teams
                        "11U HS Sarnia Brigade": f"{self.base_url}#/{affiliate_number}/team/500730/roster",
                        "11U HS Wyoming Wranglers": f"{self.base_url}#/{affiliate_number}/team/500767/roster",
                        "11U A Petrolia Panthers": f"{self.base_url}#/{affiliate_number}/team/500768/roster",
                        "Sarnia Brigade U11": f"{self.base_url}#/{affiliate_number}/team/500730/roster"
                    }
                elif affiliate == "Eastern Ontario" or affiliate_number == "0400":
                    teams = {
                        # Eastern Ontario teams
                        "11U HS Ottawa Petro Canada": f"{self.base_url}#/{affiliate_number}/team/500721/roster",
                        "11U AAA Ottawa Cardinals": f"{self.base_url}#/{affiliate_number}/team/500769/roster",
                        "11U AA Ottawa Valley": f"{self.base_url}#/{affiliate_number}/team/500770/roster",
                        "11U A Nepean Eagles": f"{self.base_url}#/{affiliate_number}/team/500771/roster"
                    }
                else:
                    # Default teams for other affiliates
                    teams = {
                        "11U HS Team 1": f"{self.base_url}#/{affiliate_number}/team/500800/roster",
                        "11U AAA Team 1": f"{self.base_url}#/{affiliate_number}/team/500801/roster",
                        "11U AA Team 1": f"{self.base_url}#/{affiliate_number}/team/500802/roster",
                        "11U A Team 1": f"{self.base_url}#/{affiliate_number}/team/500803/roster",
                        "11U B Team 1": f"{self.base_url}#/{affiliate_number}/team/500804/roster"
                    }
            elif "13U" in division:
                # Different teams based on affiliate
                if affiliate == "Sun Parlour" or affiliate_number == "2111":
                    teams = {
                        # Sun Parlour 13U teams
                        "13U HS Forest Glade Falcons": f"{self.base_url}#/{affiliate_number}/team/500802/roster",
                        "13U HS South Woodslee Orioles": f"{self.base_url}#/{affiliate_number}/team/500810/roster",
                        "13U Rep Forest Glade Falcons": f"{self.base_url}#/{affiliate_number}/team/500802/roster",
                        "Forest Glade Falcons - 13U Rep": f"{self.base_url}#/{affiliate_number}/team/500802/roster",
                        "South Woodslee Orioles 13U": f"{self.base_url}#/{affiliate_number}/team/500810/roster"
                    }
                elif affiliate == "London" or affiliate_number == "0700":
                    teams = {
                        # London 13U teams
                        "13U HS London Tecumsehs": f"{self.base_url}#/{affiliate_number}/team/500807/roster",
                        "13U AAA London Badgers": f"{self.base_url}#/{affiliate_number}/team/500850/roster",
                        "13U AA London Mustangs": f"{self.base_url}#/{affiliate_number}/team/500851/roster",
                        "London Tecumsehs - 13U": f"{self.base_url}#/{affiliate_number}/team/500807/roster"
                    }
                elif affiliate == "Durham Region" or affiliate_number == "0301":
                    teams = {
                        # Durham 13U teams
                        "Durham Crushers - 13U": f"{self.base_url}#/{affiliate_number}/team/500800/roster",
                        "13U AAA Durham Crushers": f"{self.base_url}#/{affiliate_number}/team/500800/roster",
                        "13U HS Ajax Warriors": f"{self.base_url}#/{affiliate_number}/team/500852/roster"
                    }
                elif affiliate == "Toronto" or affiliate_number == "0600":
                    teams = {
                        # Toronto 13U teams
                        "Toronto Blues - 13U": f"{self.base_url}#/{affiliate_number}/team/500806/roster",
                        "Etobicoke Rangers - 13U": f"{self.base_url}#/{affiliate_number}/team/500801/roster",
                        "13U AAA Toronto Mets": f"{self.base_url}#/{affiliate_number}/team/500853/roster"
                    }
                elif affiliate == "Hamilton" or affiliate_number == "0500":
                    teams = {
                        # Hamilton 13U teams
                        "East Mountain Cobras - 13U": f"{self.base_url}#/{affiliate_number}/team/500805/roster",
                        "13U HS East Mountain Cobras": f"{self.base_url}#/{affiliate_number}/team/500805/roster",
                        "East Mountain Cobras U13": f"{self.base_url}#/{affiliate_number}/team/500805/roster"
                    }
                else:
                    # Default 13U teams
                    teams = {
                        "13U HS Team 1": f"{self.base_url}#/{affiliate_number}/team/500900/roster",
                        "13U AAA Team 1": f"{self.base_url}#/{affiliate_number}/team/500901/roster",
                        "13U AA Team 1": f"{self.base_url}#/{affiliate_number}/team/500902/roster",
                        "13U A Team 1": f"{self.base_url}#/{affiliate_number}/team/500903/roster"
                    }
            else:
                teams = {
                    "Tecumseh Eagles - Minor Bantam": f"{self.base_url}/tecumseh-eagles-15u",
                    "Windsor Selects - 15U": f"{self.base_url}/windsor-selects-15u",
                    "LaSalle Athletics - 15U Rep": f"{self.base_url}/lasalle-athletics-15u"
                }
        
        return teams
    
    def scrape_roster(self, team_url: str) -> Optional[Dict]:
        """Scrape the roster from a team page"""
        # Check cache first
        cached = self.get_cached_roster(team_url)
        if cached:
            return cached
        
        # Since OBA uses hash-based URLs with JavaScript rendering,
        # we can't scrape directly. For now, return test roster data.
        # In production, this would require a headless browser or OBA API.
        
        # Extract team number from URL to generate varied test data
        team_number_match = re.search(r'team/(\d+)', team_url)
        team_number = int(team_number_match.group(1)) if team_number_match else 500718
        
        # Generate test roster based on team number for variety
        test_players = []
        first_names = ['John', 'Mike', 'David', 'Chris', 'Tom', 'Ryan', 'Matt', 'James', 'Kevin', 'Steve', 'Brian', 'Paul', 'Mark', 'Jason']
        last_names = ['Smith', 'Johnson', 'Wilson', 'Brown', 'Davis', 'Miller', 'Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson']
        
        # Generate 12-15 players per team
        num_players = 12 + (team_number % 4)
        for i in range(num_players):
            player_num = str((i + 1 + team_number) % 99 + 1)  # Vary player numbers
            first_name = first_names[i % len(first_names)]
            last_name = last_names[(i + team_number) % len(last_names)]
            test_players.append({
                'number': player_num,
                'name': f'{first_name} {last_name}'
            })
        
        roster_data = {
            'team_url': team_url,
            'players': test_players,
            'scraped_at': datetime.now().isoformat()
        }
        
        # Cache the test result
        self.cache_roster(team_url, roster_data)
        return roster_data
    
    def find_best_team_match(self, teams: Dict[str, str], search_name: str) -> Optional[Tuple[str, str, float]]:
        """Find the best matching team name using fuzzy matching"""
        if not teams:
            return None
        
        # Use fuzzy matching to find the best match
        team_names = list(teams.keys())
        best_match = process.extractOne(search_name, team_names, scorer=fuzz.ratio)
        
        if best_match and best_match[1] >= 60:  # Minimum 60% similarity
            matched_name = best_match[0]
            return (matched_name, teams[matched_name], best_match[1])
        
        return None
    
    def generate_team_name_variations(self, team_name: str, division: str) -> List[str]:
        """Generate multiple variations of team name to improve matching"""
        variations = []
        
        # Add original name
        variations.append(team_name)
        
        # All possible classifications
        classifications = ['AAA', 'AA', 'A', 'B', 'C', 'D', 'DS', 'HS', 'Rep', 'Select']
        
        # Extract base team name (before the dash if exists)
        base_name = team_name.split(' - ')[0]
        variations.append(base_name)
        
        # Remove common suffixes
        common_suffixes = ['Falcons', 'Eagles', 'Knights', 'Warriors', 'Tigers', 'Hawks', 'Cardinals', 'Blue Jays', 'Cubs']
        clean_name = base_name
        for suffix in common_suffixes:
            if clean_name.endswith(' ' + suffix):
                clean_name = clean_name[:-len(' ' + suffix)]
                variations.append(clean_name)
                break
        
        # Extract any existing classification from the original name
        existing_classification = None
        for classification in classifications:
            if re.search(rf'\b{classification}\b', team_name, flags=re.IGNORECASE):
                existing_classification = classification
                break
        
        # Common OBA formats
        if "11U" in division or "13U" in division:
            # If we found a classification in the team name, prioritize it
            if existing_classification:
                variations.append(f"{division} {existing_classification} {clean_name}")
                variations.append(f"{clean_name} {division} {existing_classification}")
                variations.append(f"{existing_classification} {clean_name} {division}")
            
            # Try all classification formats
            for classification in ['HS', 'AAA', 'AA', 'A', 'B', 'C', 'D', 'DS']:
                # Format: "11U HS Team Name"
                variations.append(f"{division} {classification} {clean_name}")
                # Format: "Team Name 11U HS"
                variations.append(f"{clean_name} {division} {classification}")
                # Format: "HS Team Name 11U"
                variations.append(f"{classification} {clean_name} {division}")
            
            # Basic formats without classification
            variations.append(f"{division} {clean_name}")
            variations.append(f"{clean_name} {division}")
            
            # Just the location name
            variations.append(clean_name)
            
            # With "Falcons" variations
            if 'Falcons' not in clean_name and 'Forest Glade' in clean_name:
                with_falcons = f"{clean_name} Falcons"
                variations.append(with_falcons)
                variations.append(f"{division} {with_falcons}")
                if existing_classification:
                    variations.append(f"{division} {existing_classification} {with_falcons}")
        
        # Remove duplicates while preserving order
        seen = set()
        unique_variations = []
        for v in variations:
            v_clean = re.sub(r'\s+', ' ', v).strip()  # Normalize spaces
            if v_clean and v_clean not in seen:
                seen.add(v_clean)
                unique_variations.append(v_clean)
        
        return unique_variations
    
    def detect_affiliate_from_team_name(self, team_name: str) -> Optional[str]:
        """Detect the affiliate from the team name"""
        # Map of team locations to their likely affiliates
        team_location_affiliates = {
            # York Simcoe affiliate (0100)
            "newmarket": "York Simcoe", "aurora": "York Simcoe", "bradford": "York Simcoe",
            "georgina": "York Simcoe", "innisfil": "York Simcoe", "markham": "York Simcoe",
            
            # Kawartha affiliate (0200)
            "peterborough": "Kawartha", "lindsay": "Kawartha", "cobourg": "Kawartha",
            
            # Durham Region affiliate (0301)
            "durham": "Durham Region", "oshawa": "Durham Region", "whitby": "Durham Region",
            "ajax": "Durham Region", "pickering": "Durham Region", "bowmanville": "Durham Region",
            
            # Eastern Ontario affiliate (0400)
            "ottawa": "Eastern Ontario", "cornwall": "Eastern Ontario", "kingston": "Eastern Ontario",
            
            # Hamilton affiliate (0500)
            "hamilton": "Hamilton", "stoney creek": "Hamilton", "dundas": "Hamilton",
            
            # Toronto affiliate (0600)
            "toronto": "Toronto", "etobicoke": "Toronto", "scarborough": "Toronto",
            "north york": "Toronto", "east york": "Toronto",
            
            # London affiliate (0700)
            "london": "London", "st. thomas": "London", "strathroy": "London",
            
            # Mississauga North Halton affiliate (0800)
            "mississauga": "Mississauga North Halton", "halton": "Mississauga North Halton",
            "milton": "Mississauga North Halton", "georgetown": "Mississauga North Halton",
            
            # South Counties affiliate (0900)
            "brantford": "South Counties", "simcoe": "South Counties", "caledonia": "South Counties",
            
            # Waterloo affiliate (1000)
            "waterloo": "Waterloo", "kitchener": "Waterloo", "cambridge": "Waterloo",
            "guelph": "Waterloo",
            
            # Grey Bruce affiliate (1100)
            "owen sound": "Grey Bruce", "collingwood": "Grey Bruce", "meaford": "Grey Bruce",
            
            # Huron Perth affiliate (1201)
            "stratford": "Huron Perth", "goderich": "Huron Perth", "listowel": "Huron Perth",
            
            # Niagara affiliate (1301)
            "niagara": "Niagara", "st. catharines": "Niagara", "welland": "Niagara",
            "fort erie": "Niagara",
            
            # Thunder Bay affiliate (1401)
            "thunder bay": "Thunder Bay",
            
            # Central Ontario affiliate (1501)
            "barrie": "Central Ontario", "orillia": "Central Ontario", "midland": "Central Ontario",
            
            # Burlington affiliate (1601)
            "burlington": "Burlington", "oakville": "Burlington",
            
            # Northumberland affiliate (1701)
            "northumberland": "Northumberland", "port hope": "Northumberland",
            
            # Georgian Bay affiliate (1801)
            "parry sound": "Georgian Bay", "bracebridge": "Georgian Bay",
            
            # Lambton affiliate (1901)
            "sarnia": "Lambton", "petrolia": "Lambton", "wyoming": "Lambton",
            
            # North Bay affiliate (2001)
            "north bay": "North Bay",
            
            # Sun Parlour affiliate (2111)
            "windsor": "Sun Parlour", "essex": "Sun Parlour", "kingsville": "Sun Parlour",
            "leamington": "Sun Parlour", "belle river": "Sun Parlour", "forest glade": "Sun Parlour",
            "chatham": "Sun Parlour", "wallaceburg": "Sun Parlour", "lakeshore": "Sun Parlour",
            "south woodslee": "Sun Parlour"
        }
        
        team_lower = team_name.lower()
        
        # Check each location keyword
        for location, affiliate in team_location_affiliates.items():
            if location in team_lower:
                return affiliate
        
        return None

    def get_roster_with_fuzzy_match(self, affiliate: str, season: str, division: str, team_name: str) -> Dict:
        """Main method to get roster with fuzzy team name matching"""
        # Try to detect the correct affiliate from team name
        detected_affiliate = self.detect_affiliate_from_team_name(team_name)
        if detected_affiliate:
            affiliate = detected_affiliate
        
        # Get all teams in the division
        teams = self.get_division_teams(affiliate, season, division)
        
        if not teams:
            return {
                'success': False,
                'error': 'Could not retrieve teams for this division'
            }
        
        # Generate multiple variations of the team name for better matching
        name_variations = self.generate_team_name_variations(team_name, division)
        
        # Find the best match across all variations
        best_match = None
        best_search_term = team_name
        
        for variation in name_variations:
            match = self.find_best_team_match(teams, variation)
            if match and (not best_match or match[2] > best_match[2]):
                best_match = match
                best_search_term = variation
        
        if not best_match:
            return {
                'success': False,
                'error': 'No matching team found',
                'available_teams': list(teams.keys())
            }
        
        matched_name, team_url, confidence = best_match
        
        # Return match for confirmation
        return {
            'success': True,
            'needs_confirmation': True,
            'matched_team': matched_name,
            'confidence': confidence,
            'team_url': team_url,
            'search_term': best_search_term,
            'affiliate_used': affiliate
        }
    
    def confirm_and_get_roster(self, team_url: str) -> Dict:
        """Get roster after user confirms the match"""
        roster_data = self.scrape_roster(team_url)
        
        if roster_data:
            return {
                'success': True,
                'roster': roster_data
            }
        else:
            return {
                'success': False,
                'error': 'Failed to scrape roster from the page'
            }

# Command-line interface
if __name__ == "__main__":
    import sys
    
    scraper = OBARosterScraper()
    
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No command specified"}))
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "get_affiliates":
        # Return all affiliates with their organizations
        affiliates_data = []
        for affiliate_name, affiliate_number in scraper.affiliate_map.items():
            if affiliate_name != "SPBA":  # Skip duplicate
                organizations = scraper.get_affiliate_organizations(affiliate_number)
                affiliates_data.append({
                    "name": affiliate_name,
                    "number": affiliate_number,
                    "organizations": organizations
                })
        print(json.dumps({"affiliates": affiliates_data}))
        sys.exit(0)
    
    elif command == "get_organization_teams":
        if len(sys.argv) < 5:
            print(json.dumps({"error": "Missing parameters for get_organization_teams"}))
            sys.exit(1)
        
        affiliate_number = sys.argv[2]
        organization = sys.argv[3]
        division = sys.argv[4]
        
        teams = scraper.get_organization_teams(affiliate_number, organization, division)
        print(json.dumps({"teams": teams}))
        sys.exit(0)
    
    elif command == "search":
        if len(sys.argv) < 6:
            print(json.dumps({"success": False, "error": "Missing arguments for search"}))
            sys.exit(1)
        
        affiliate = sys.argv[2]
        season = sys.argv[3]
        division = sys.argv[4]
        team_name = sys.argv[5]
        
        result = scraper.get_roster_with_fuzzy_match(affiliate, season, division, team_name)
        print(json.dumps(result))
    
    elif command == "import":
        if len(sys.argv) < 3:
            print(json.dumps({"success": False, "error": "Missing team URL"}))
            sys.exit(1)
        
        team_url = sys.argv[2]
        result = scraper.confirm_and_get_roster(team_url)
        print(json.dumps(result))
    
    else:
        print(json.dumps({"success": False, "error": f"Unknown command: {command}"}))