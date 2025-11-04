import pytest
from unittest.mock import patch
import sqlite3
from roster_scraper import OBARosterScraper

# Sample HTML for a team roster page
FAKE_ROSTER_HTML = """
<html>
    <body>
        <h1>Test Team Name</h1>
        <div class="ag-center-cols-container">
            <div role="row">
                <a href="#/player/1">Player One</a>
            </div>
            <div role="row">
                <a href="#/player/2">Player Two</a>
            </div>
        </div>
    </body>
</html>
"""

# Sample HTML for a division teams page
FAKE_DIVISION_TEAMS_HTML = """
<html>
    <body>
        <div class="teams-grid">
            <div class="team">
                <div class="team-name">(Rep) 13U Team A</div>
                <div class="links"><a href="/stats#/team/1/roster">Roster</a></div>
            </div>
            <div class="team">
                <div class="team-name">(Rep) 13U Team B</div>
                <div class="links"><a href="/stats#/team/2/roster">Roster</a></div>
            </div>
            <div class="team">
                <div class="team-name">(Rep) 11U Team C</div>
                <div class="links"><a href="/stats#/team/3/roster">Roster</a></div>
            </div>
        </div>
    </body>
</html>
"""

@pytest.fixture
def scraper():
    """Pytest fixture to create a scraper instance, ensuring a clean cache for each test."""
    scraper_instance = OBARosterScraper()
    # Use an in-memory SQLite DB for tests to avoid creating files
    scraper_instance.conn = sqlite3.connect(':memory:')
    scraper_instance.init_database()
    return scraper_instance

def test_scrape_roster(scraper, monkeypatch):
    """Test the scrape_roster function with mocked HTML content."""
    monkeypatch.setattr(scraper, '_get_page_content', lambda url, wait_for_selector=None: FAKE_ROSTER_HTML)
    
    roster = scraper.scrape_roster("http://fakeurl.com/team/123/roster")
    
    assert roster is not None
    assert roster['team_name'] == "Test Team Name"
    assert len(roster['players']) == 2
    assert roster['players'][0]['name'] == "Player One"
    assert roster['players'][1]['name'] == "Player Two"
    assert roster['authentic_data'] is True
    assert roster['scrape_method'] == 'live_web_scraping_playwright'

def test_get_division_teams(scraper, monkeypatch):
    """Test the get_division_teams function with mocked HTML content."""
    monkeypatch.setattr(scraper, '_get_affiliate_info', lambda affiliate: {"id": "2106", "season_id": "8244"})
    monkeypatch.setattr(scraper, '_get_page_content', lambda url, wait_for_selector=None: FAKE_DIVISION_TEAMS_HTML)
    
    teams = scraper.get_division_teams("LDBA", "2025", "13U")
    
    assert len(teams) == 2
    assert "(Rep) 13U Team A" in teams
    assert "(Rep) 13U Team B" in teams
    assert "(Rep) 11U Team C" not in teams
    assert teams["(Rep) 13U Team A"] == "https://www.playoba.ca/stats#/team/1/roster"

def test_get_roster_with_fuzzy_match_success(scraper, monkeypatch):
    """Test the full fuzzy match workflow successfully."""
    monkeypatch.setattr(scraper, 'get_division_teams', lambda a, s, d: {
        "London Badgers - 13U Rep": "http://fake.com/team/1/roster"
    })
    
    result = scraper.get_roster_with_fuzzy_match("LDBA", "2025", "13U", "London Badgers")
    
    assert result['success'] is True
    assert result['needs_confirmation'] is True
    assert result['matched_team'] == "London Badgers - 13U Rep"
    assert result['confidence'] > 70

def test_get_roster_with_fuzzy_match_no_teams(scraper, monkeypatch):
    """Test the fuzzy match workflow when no teams are found for the division."""
    monkeypatch.setattr(scraper, 'get_division_teams', lambda a, s, d: {})

    result = scraper.get_roster_with_fuzzy_match("LDBA", "2025", "13U", "London Badgers")

    assert result['success'] is False
    assert 'Could not retrieve any teams' in result['error']

def test_get_roster_with_fuzzy_match_no_match(scraper, monkeypatch):
    """Test the fuzzy match workflow when no team name matches."""
    monkeypatch.setattr(scraper, 'get_division_teams', lambda a, s, d: {
        "Some Other Team - 13U": "http://fake.com/team/1/roster"
    })

    result = scraper.get_roster_with_fuzzy_match("LDBA", "2025", "13U", "London Badgers")

    assert result['success'] is False
    assert 'No matching team found' in result['error']
    assert "Some Other Team - 13U" in result['available_teams']
