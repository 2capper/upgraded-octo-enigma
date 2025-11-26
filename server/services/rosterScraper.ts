import puppeteer from 'puppeteer-core';

interface Player {
  number: string;
  name: string;
  position?: string;
}

export const rosterScraper = {
  async scrapeRoster(teamId: string, affiliateId: string = "2111"): Promise<Player[]> {
    console.log(`[Scraper] Booting up for Team: ${teamId}...`);
    
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
      const page = await browser.newPage();
      
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const targetUrl = `https://www.playoba.ca/stats#/${affiliateId}/team/${teamId}/roster`;
      console.log(`[Scraper] Navigating to: ${targetUrl}`);
      
      await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      console.log(`[Scraper] Waiting for roster table...`);
      await page.waitForSelector('table', { timeout: 10000 });

      const players = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('tr'));
        const roster: any[] = [];

        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length >= 2) {
            const number = cells[0]?.innerText?.trim() || "";
            const name = cells[1]?.innerText?.trim() || "";
            
            if (name && name !== "Name" && !name.includes("Player")) {
               roster.push({ number, name });
            }
          }
        });
        return roster;
      });

      console.log(`[Scraper] Success! Found ${players.length} players.`);
      return players;

    } catch (error) {
      console.error("[Scraper] Failed:", error);
      throw new Error("Failed to scrape roster. Ensure the Team ID is correct.");
    } finally {
      await browser.close();
    }
  }
};
