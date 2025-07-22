#!/usr/bin/env python3
"""
Real OBA scraper that uses browser automation to extract authentic data
"""
import sys
import time
import json
from typing import Dict, List, Optional
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException

class RealOBAScraper:
    def __init__(self):
        self.driver = None
        
    def setup_driver(self):
        """Setup Chrome driver with headless options"""
        chrome_options = Options()
        chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            return True
        except Exception as e:
            print(f"Failed to setup Chrome driver: {e}")
            return False
    
    def scrape_real_team_data(self, team_url: str) -> Dict:
        """Extract real team data from OBA using browser automation"""
        if not self.setup_driver():
            return {"error": "Failed to setup browser"}
            
        try:
            print(f"Loading OBA page: {team_url}")
            self.driver.get(team_url)
            
            # Wait for the page to load completely
            WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Wait for Angular/JavaScript to render content
            time.sleep(3)
            
            # Try to find team name
            team_name = "Unknown"
            try:
                # Look for team name in various possible selectors
                team_name_selectors = [
                    "h1.team-name",
                    ".team-header h1",
                    ".page-header h1",
                    "h1",
                    ".team-title"
                ]
                
                for selector in team_name_selectors:
                    try:
                        element = self.driver.find_element(By.CSS_SELECTOR, selector)
                        if element and element.text.strip():
                            team_name = element.text.strip()
                            break
                    except NoSuchElementException:
                        continue
                        
            except Exception as e:
                print(f"Could not find team name: {e}")
            
            # Try to find roster/players
            players = []
            try:
                # Look for player roster in various possible structures
                roster_selectors = [
                    ".roster-table tr",
                    ".player-row",
                    ".roster-row",
                    "tbody tr"
                ]
                
                for selector in roster_selectors:
                    try:
                        player_elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        if player_elements:
                            for element in player_elements:
                                # Extract player data
                                text = element.text.strip()
                                if text and len(text) > 2:  # Skip empty rows
                                    # Try to parse number and name
                                    parts = text.split()
                                    if len(parts) >= 2:
                                        number = parts[0] if parts[0].isdigit() else "?"
                                        name = " ".join(parts[1:]) if len(parts) > 1 else text
                                        players.append({
                                            "number": number,
                                            "name": name
                                        })
                            if players:
                                break
                    except NoSuchElementException:
                        continue
                        
            except Exception as e:
                print(f"Could not find roster data: {e}")
            
            # Get page source for debugging
            page_source = self.driver.page_source
            
            result = {
                "team_name": team_name,
                "players": players,
                "url": team_url,
                "page_loaded": True,
                "debug_info": {
                    "page_title": self.driver.title,
                    "current_url": self.driver.current_url,
                    "page_source_length": len(page_source)
                }
            }
            
            return result
            
        except TimeoutException:
            return {"error": "Page load timeout", "url": team_url}
        except Exception as e:
            return {"error": f"Scraping error: {str(e)}", "url": team_url}
        finally:
            if self.driver:
                self.driver.quit()

def test_real_scraping():
    """Test real OBA scraping with specific URL"""
    scraper = RealOBAScraper()
    
    # Test the URL provided by user
    test_url = "https://www.playoba.ca/stats#/2106/team/500413/roster"
    
    print(f"Testing REAL OBA scraping with: {test_url}")
    print("=" * 60)
    
    result = scraper.scrape_real_team_data(test_url)
    
    if "error" in result:
        print(f"❌ Error: {result['error']}")
    else:
        print(f"✅ Successfully loaded page!")
        print(f"Team Name: {result.get('team_name', 'Not found')}")
        print(f"Players Found: {len(result.get('players', []))}")
        
        if result.get('players'):
            print("\nReal players from OBA:")
            for i, player in enumerate(result['players'][:5]):
                print(f"  #{player.get('number', '?')} - {player.get('name', 'Unknown')}")
        
        print(f"\nPage Title: {result.get('debug_info', {}).get('page_title', 'Unknown')}")
        print(f"Current URL: {result.get('debug_info', {}).get('current_url', 'Unknown')}")

if __name__ == "__main__":
    test_real_scraping()