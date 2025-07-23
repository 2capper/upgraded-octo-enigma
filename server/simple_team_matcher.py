#!/usr/bin/env python3
"""
Simple Team Matcher
Uses a text file of discovered teams to provide fast matching for roster import.
"""

import json
import sys
import os
import re
from difflib import SequenceMatcher

def load_discovered_teams():
    """Load teams from discovered_teams.txt file"""
    teams = []
    teams_file = os.path.join(os.path.dirname(__file__), 'discovered_teams.txt')
    
    if os.path.exists(teams_file):
        with open(teams_file, 'r') as f:
            for line in f:
                line = line.strip()
                if '|' in line:
                    team_id, team_name = line.split('|', 1)
                    division = extract_division(team_name)
                    teams.append({
                        'id': team_id,
                        'name': team_name,
                        'division': division,
                        'has_roster': True
                    })
    
    return teams

def extract_division(team_name):
    """Extract division from team name"""
    patterns = [r'\b(\d+U)\b', r'\b(11U|13U|15U|18U)\b']
    
    for pattern in patterns:
        match = re.search(pattern, team_name, re.IGNORECASE)
        if match:
            return match.group(1).upper()
    
    return None

def calculate_similarity(search_name, team_name):
    """Calculate similarity between search name and team name"""
    # Normalize names for comparison
    search_normalized = search_name.lower().strip()
    team_normalized = team_name.lower().strip()
    
    # Exact match gets highest score
    if search_normalized == team_normalized:
        return 10
    
    # Check for substring matches
    if search_normalized in team_normalized or team_normalized in search_normalized:
        return 8
    
    # Word-by-word matching
    search_words = set(search_normalized.split())
    team_words = set(team_normalized.split())
    
    common_words = search_words.intersection(team_words)
    total_words = len(search_words.union(team_words))
    
    if total_words == 0:
        return 0
    
    # Jaccard similarity
    jaccard = len(common_words) / total_words
    
    # Additional boost for key terms
    key_terms = ['falcons', 'turtle', 'nationals', 'cardinals', 'eagles', 'hawks']
    for term in key_terms:
        if term in search_normalized and term in team_normalized:
            jaccard += 0.3
    
    return min(int(jaccard * 10), 9)

def search_teams(search_name, division=None, limit=10):
    """Search for teams matching the criteria"""
    teams = load_discovered_teams()
    matches = []
    
    for team in teams:
        # Filter by division if specified
        if division and team['division'] and team['division'].upper() != division.upper():
            continue
        
        # Calculate similarity score
        score = calculate_similarity(search_name, team['name'])
        
        if score > 0:  # Only include teams with some similarity
            matches.append({
                'id': team['id'],
                'name': team['name'],
                'division': team['division'],
                'match_score': score,
                'has_roster': team['has_roster']
            })
    
    # Sort by score descending
    matches.sort(key=lambda x: x['match_score'], reverse=True)
    
    return matches[:limit]

def main():
    if len(sys.argv) < 2:
        print("Usage: python simple_team_matcher.py search <team_name> [division]")
        return
    
    if sys.argv[1] == "search":
        if len(sys.argv) < 3:
            print("Error: search requires team name")
            return
        
        team_name = sys.argv[2]
        division = sys.argv[3] if len(sys.argv) > 3 else None
        
        matches = search_teams(team_name, division)
        
        print(json.dumps({
            'success': True,
            'matches': matches,
            'total_found': len(matches)
        }))
    
    elif sys.argv[1] == "stats":
        teams = load_discovered_teams()
        total_teams = len(teams)
        divisions = {}
        
        for team in teams:
            if team['division']:
                divisions[team['division']] = divisions.get(team['division'], 0) + 1
        
        print(f"Discovered Teams Statistics:")
        print(f"Total teams: {total_teams}")
        for div, count in sorted(divisions.items()):
            print(f"{div}: {count} teams")

if __name__ == "__main__":
    main()