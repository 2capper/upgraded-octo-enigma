#!/usr/bin/env python3
"""
Script to populate test tournament with teams, pools, and games
"""
import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:5000/api"
TOURNAMENT_ID = "test-16-8-playoff-cross-pool-2025-11"

# Ontario cities for team names
TEAM_NAMES = {
    "A": ["Chatham", "Leamington", "Sarnia", "Windsor"],
    "B": ["Brantford", "Simcoe", "St. Thomas", "Woodstock"],
    "C": ["Welland", "Grimsby", "St. Catharines", "Niagara Falls"],
    "D": ["Orangeville", "Caledon", "Bolton", "Shelburne"]
}

# Game results for each pool (strategic to create clear standings and tie-breakers)
POOL_RESULTS = {
    "A": [
        # Chatham (3-0, 1st), Leamington (2-1, 2nd), Sarnia (1-2, 3rd), Windsor (0-3, 4th)
        {"home": "Chatham", "away": "Leamington", "homeScore": 8, "awayScore": 5},
        {"home": "Chatham", "away": "Sarnia", "homeScore": 10, "awayScore": 3},
        {"home": "Chatham", "away": "Windsor", "homeScore": 12, "awayScore": 2},
        {"home": "Leamington", "away": "Sarnia", "homeScore": 7, "awayScore": 4},
        {"home": "Leamington", "away": "Windsor", "homeScore": 9, "awayScore": 1},
        {"home": "Sarnia", "away": "Windsor", "homeScore": 6, "awayScore": 5},
    ],
    "B": [
        # Brantford (3-0, 1st), Simcoe (2-1, 2nd), St. Thomas (1-2, 3rd), Woodstock (0-3, 4th)
        {"home": "Brantford", "away": "Simcoe", "homeScore": 11, "awayScore": 6},
        {"home": "Brantford", "away": "St. Thomas", "homeScore": 9, "awayScore": 4},
        {"home": "Brantford", "away": "Woodstock", "homeScore": 13, "awayScore": 1},
        {"home": "Simcoe", "away": "St. Thomas", "homeScore": 8, "awayScore": 5},
        {"home": "Simcoe", "away": "Woodstock", "homeScore": 10, "awayScore": 3},
        {"home": "St. Thomas", "away": "Woodstock", "homeScore": 7, "awayScore": 6},
    ],
    "C": [
        # Welland (3-0, 1st), Grimsby (2-1, 2nd), St. Catharines (1-2, 3rd), Niagara Falls (0-3, 4th)
        {"home": "Welland", "away": "Grimsby", "homeScore": 10, "awayScore": 7},
        {"home": "Welland", "away": "St. Catharines", "homeScore": 11, "awayScore": 4},
        {"home": "Welland", "away": "Niagara Falls", "homeScore": 14, "awayScore": 2},
        {"home": "Grimsby", "away": "St. Catharines", "homeScore": 9, "awayScore": 6},
        {"home": "Grimsby", "away": "Niagara Falls", "homeScore": 12, "awayScore": 3},
        {"home": "St. Catharines", "away": "Niagara Falls", "homeScore": 8, "awayScore": 7},
    ],
    "D": [
        # Orangeville (3-0, 1st), Caledon (2-1, 2nd), Bolton (1-2, 3rd), Shelburne (0-3, 4th)
        {"home": "Orangeville", "away": "Caledon", "homeScore": 12, "awayScore": 8},
        {"home": "Orangeville", "away": "Bolton", "homeScore": 10, "awayScore": 5},
        {"home": "Orangeville", "away": "Shelburne", "homeScore": 15, "awayScore": 3},
        {"home": "Caledon", "away": "Bolton", "homeScore": 11, "awayScore": 7},
        {"home": "Caledon", "away": "Shelburne", "homeScore": 13, "awayScore": 4},
        {"home": "Bolton", "away": "Shelburne", "homeScore": 9, "awayScore": 8},
    ],
}

def create_age_division():
    """Create age division for the tournament"""
    print("Creating age division...")
    data = {
        "id": f"{TOURNAMENT_ID}-11u",
        "name": "11U",
        "tournamentId": TOURNAMENT_ID
    }
    response = requests.post(f"{BASE_URL}/tournaments/{TOURNAMENT_ID}/age-divisions", json=data)
    if response.status_code == 201:
        print(f"✓ Created age division: {data['name']}")
        return data['id']
    else:
        print(f"✗ Failed to create age division: {response.text}")
        return None

def create_pools(age_division_id):
    """Create 4 pools (A, B, C, D)"""
    print("\nCreating pools...")
    pool_ids = {}
    for pool_name in ["A", "B", "C", "D"]:
        pool_id = f"{TOURNAMENT_ID}-pool-{pool_name.lower()}"
        data = {
            "id": pool_id,
            "name": pool_name,
            "tournamentId": TOURNAMENT_ID,
            "ageDivisionId": age_division_id
        }
        response = requests.post(f"{BASE_URL}/tournaments/{TOURNAMENT_ID}/pools", json=data)
        if response.status_code == 201:
            print(f"✓ Created pool: {pool_name}")
            pool_ids[pool_name] = pool_id
        else:
            print(f"✗ Failed to create pool {pool_name}: {response.text}")
    return pool_ids

def create_teams(pool_ids):
    """Create 16 teams (4 per pool)"""
    print("\nCreating teams...")
    team_ids = {}
    for pool_name, cities in TEAM_NAMES.items():
        team_ids[pool_name] = {}
        for city in cities:
            team_id = f"{TOURNAMENT_ID}-{city.lower().replace(' ', '-')}"
            data = {
                "id": team_id,
                "name": city,
                "city": city,
                "division": "11U",
                "tournamentId": TOURNAMENT_ID,
                "poolId": pool_ids[pool_name]
            }
            response = requests.post(f"{BASE_URL}/tournaments/{TOURNAMENT_ID}/teams", json=data)
            if response.status_code == 201:
                print(f"✓ Created team: {city} (Pool {pool_name})")
                team_ids[pool_name][city] = team_id
            else:
                print(f"✗ Failed to create team {city}: {response.text}")
    return team_ids

def create_games(team_ids):
    """Create pool play games with results"""
    print("\nCreating games and entering results...")
    game_number = 1
    for pool_name, results in POOL_RESULTS.items():
        print(f"\n  Pool {pool_name}:")
        for result in results:
            home_team_id = team_ids[pool_name][result["home"]]
            away_team_id = team_ids[pool_name][result["away"]]
            
            game_id = f"{TOURNAMENT_ID}-game-{game_number}"
            game_data = {
                "id": game_id,
                "tournamentId": TOURNAMENT_ID,
                "homeTeamId": home_team_id,
                "awayTeamId": away_team_id,
                "homeScore": result["homeScore"],
                "awayScore": result["awayScore"],
                "status": "completed",
                "scheduledTime": "2025-11-15T10:00:00Z",
                "diamond": f"Field {game_number}"
            }
            
            response = requests.post(f"{BASE_URL}/tournaments/{TOURNAMENT_ID}/games", json=game_data)
            if response.status_code == 201:
                print(f"    ✓ Game {game_number}: {result['home']} {result['homeScore']} - {result['awayScore']} {result['away']}")
            else:
                print(f"    ✗ Failed to create game {game_number}: {response.text}")
            
            game_number += 1

def main():
    print(f"Populating tournament: {TOURNAMENT_ID}\n")
    print("=" * 60)
    
    # Step 1: Create age division
    age_division_id = create_age_division()
    if not age_division_id:
        print("\n✗ Failed to create age division. Exiting.")
        return
    
    # Step 2: Create pools
    pool_ids = create_pools(age_division_id)
    if len(pool_ids) != 4:
        print("\n✗ Failed to create all pools. Exiting.")
        return
    
    # Step 3: Create teams
    team_ids = create_teams(pool_ids)
    
    # Step 4: Create games
    create_games(team_ids)
    
    print("\n" + "=" * 60)
    print("\n✓ Tournament data populated successfully!")
    print(f"\nExpected playoff matchups (cross-pool seeding):")
    print(f"  QF1: Chatham (A1) vs Grimsby (C2)")
    print(f"  QF2: Leamington (A2) vs Welland (C1)")
    print(f"  QF3: Brantford (B1) vs Caledon (D2)")
    print(f"  QF4: Simcoe (B2) vs Orangeville (D1)")

if __name__ == "__main__":
    main()
