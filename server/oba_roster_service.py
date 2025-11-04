#!/usr/bin/env python3
"""
OBA Roster Service - Integration service for the tournament management system
Provides team discovery and roster extraction capabilities
"""

import json
import sys
import os
from direct_oba_scraper import DirectOBAScraper

class OBARosterService:
    def __init__(self):
        self.scraper = DirectOBAScraper()
    
    def search_teams(self, team_name: str) -> dict:
        """Honest response about OBA data limitations"""
        return {
            'success': False,
            'error': f"Automatic OBA roster discovery is not available. The OBA website (playoba.ca) has protections that prevent automated data access.",
            'searchTerm': team_name,
            'solution': "Manual roster import required",
            'instructions': [
                "1. Visit playoba.ca manually",
                "2. Find your team's roster page", 
                "3. Copy the team roster data",
                "4. Use the manual import option in the tournament system"
            ]
        }
    
    def _perform_live_oba_search(self, team_name: str) -> dict:
        """Perform live search on playoba.ca for real teams"""
        try:
            import requests
            from urllib.parse import urlencode
            
            # Use different search strategies
            search_terms = [team_name]
            
            # Add simplified search terms
            if len(team_name.split()) > 1:
                # Try individual words
                words = team_name.split()
                search_terms.extend(words)
                
                # Try last word (often the team name)
                if len(words) > 1:
                    search_terms.append(words[-1])
            
            found_teams = []
            
            for search_term in search_terms[:3]:  # Limit to 3 search variations
                # Try to find teams using OBA search patterns
                team_results = self._search_oba_teams_by_pattern(search_term)
                found_teams.extend(team_results)
                
                if len(found_teams) >= 5:  # Stop if we have enough results
                    break
            
            # Remove duplicates and sort by confidence
            unique_teams = {}
            for team in found_teams:
                team_id = team['id']
                if team_id not in unique_teams or team['confidence'] > unique_teams[team_id]['confidence']:
                    unique_teams[team_id] = team
            
            final_teams = list(unique_teams.values())
            final_teams.sort(key=lambda x: x['confidence'], reverse=True)
            
            if final_teams:
                return {
                    'success': True,
                    'teams': final_teams[:5],  # Top 5 matches
                    'searchTerm': team_name,
                    'source': 'live'
                }
            else:
                return {
                    'success': False,
                    'error': f"No real OBA teams found matching '{team_name}'. Please verify the team exists on playoba.ca",
                    'searchTerm': team_name
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': f'Live search error: {str(e)}'
            }
    
    def _search_oba_teams_by_pattern(self, search_term: str) -> list:
        """Search for teams using known OBA ID patterns"""
        teams = []
        
        # Common OBA team ID ranges based on real data
        search_ranges = [
            (500000, 500100),  # Known range with real teams
            (500700, 500800),  # Another real range
            (501000, 501100),  # Additional range
        ]
        
        import requests
        
        for start_id, end_id in search_ranges:
            for team_id in range(start_id, min(start_id + 20, end_id)):  # Check first 20 in each range
                try:
                    # Try to get team info from OBA API
                    url = f"https://www.playoba.ca/api/teams/{team_id}/roster"
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/json'
                    }
                    
                    response = requests.get(url, headers=headers, timeout=3)
                    
                    if response.status_code == 200:
                        data = response.json()
                        team_name = data.get('team', {}).get('name', '')
                        
                        if team_name and self._name_matches(search_term, team_name):
                            confidence = self._calculate_confidence(search_term, team_name)
                            
                            teams.append({
                                'id': str(team_id),
                                'name': team_name,
                                'affiliate': data.get('affiliate', {}).get('name', 'Unknown'),
                                'ageGroup': self._extract_age_group(team_name),
                                'confidence': confidence
                            })
                            
                            # Cache this real discovery
                            self.scraper.add_team_to_database(
                                str(team_id), 
                                team_name, 
                                data.get('affiliate', {}).get('name', 'Unknown'),
                                self._extract_age_group(team_name)
                            )
                            
                except (requests.RequestException, Exception):
                    continue  # Skip failed requests
                    
                # Don't overload the server
                import time
                time.sleep(0.1)
        
        return teams
    
    def _name_matches(self, search_term: str, team_name: str) -> bool:
        """Check if team name matches search term"""
        search_lower = search_term.lower()
        team_lower = team_name.lower()
        
        # Direct substring match
        if search_lower in team_lower:
            return True
            
        # Word overlap
        search_words = set(search_lower.split())
        team_words = set(team_lower.split())
        
        # At least one word must match
        return len(search_words.intersection(team_words)) > 0
    

    

    
    def _calculate_confidence(self, search_term: str, team_name: str) -> int:
        """Calculate confidence score for team matching"""
        search_words = search_term.lower().split()
        team_words = team_name.lower().split()
        
        matches = sum(1 for word in search_words if any(word in team_word for team_word in team_words))
        return min(int((matches / len(search_words)) * 100), 100)
    
    def _extract_age_group(self, team_name: str) -> str:
        """Extract age group from team name"""
        import re
        age_match = re.search(r'\b(\d{1,2}U)\b', team_name, re.IGNORECASE)
        return age_match.group(1) if age_match else 'Unknown'
    
    def discover_teams_in_range(self, start_id: int, end_id: int) -> dict:
        """Discover teams in a specific ID range"""
        try:
            results = self.scraper.scan_team_range(start_id, end_id, max_requests=30)
            
            teams = []
            for result in results:
                teams.append({
                    'id': result['team_id'],
                    'name': result['team_name'],
                    'status': result['status'],
                    'confidence': result.get('confidence', 0)
                })
            
            return {
                'success': True,
                'teams': teams,
                'scanned_range': f"{start_id}-{end_id}"
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Discovery error: {str(e)}'
            }
    
    def get_cached_teams(self) -> dict:
        """Get all cached teams"""
        try:
            teams = self.scraper.get_cached_teams()
            
            formatted_teams = []
            for team in teams:
                formatted_teams.append({
                    'id': team['team_id'],
                    'name': team['team_name'],
                    'affiliate': team['affiliate'],
                    'ageGroup': team['age_group']
                })
            
            return {
                'success': True,
                'teams': formatted_teams
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Cache error: {str(e)}'
            }
    
    def extract_roster_for_team(self, team_id: str) -> dict:
        """Extract roster data for a specific team"""
        try:
            # Try different URL patterns for roster extraction
            patterns = [
                f"https://www.playoba.ca/stats#/2111/team/{team_id}/roster",
                f"https://www.playoba.ca/stats#/2102/team/{team_id}/roster", 
                f"https://www.playoba.ca/stats#/2106/team/{team_id}/roster"
            ]
            
            for url in patterns:
                # Use requests to check if roster data exists
                response = self.scraper.session.get(url, timeout=10)
                if response.status_code == 200 and 'roster' in response.text.lower():
                    # For now, return basic team info since full roster extraction 
                    # requires JavaScript rendering
                    teams = self.scraper.get_cached_teams()
                    team_info = next((t for t in teams if t['team_id'] == team_id), None)
                    
                    if team_info:
                        return {
                            'success': True,
                            'team_id': team_id,
                            'team_name': team_info['team_name'],
                            'roster_url': url,
                            'message': 'Roster URL found - full extraction requires manual verification'
                        }
            
            return {
                'success': False,
                'error': 'No accessible roster found for this team'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': f'Roster extraction error: {str(e)}'
            }

def handle_request():
    """Handle command line requests from Node.js server"""
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No command provided'}))
        return
    
    service = OBARosterService()
    command = sys.argv[1]
    
    try:
        if command == 'search' and len(sys.argv) >= 3:
            team_name = ' '.join(sys.argv[2:])
            result = service.search_teams(team_name)
            
        elif command == 'discover' and len(sys.argv) >= 4:
            start_id = int(sys.argv[2])
            end_id = int(sys.argv[3])
            result = service.discover_teams_in_range(start_id, end_id)
            
        elif command == 'list':
            result = service.get_cached_teams()
            
        elif command == 'roster' and len(sys.argv) >= 3:
            team_id = sys.argv[2]
            result = service.extract_roster_for_team(team_id)
            
        else:
            result = {'success': False, 'error': f'Unknown command: {command}'}
        
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))

if __name__ == "__main__":
    handle_request()