const https = require('https');

const teamId = '500726'; 
const affiliateId = '2111'; // SPBA

// Common patterns for SportsHeadz / Digital Shift / OBA
const endpoints = [
  `https://www.playoba.ca/api/teams/${teamId}`,
  `https://www.playoba.ca/api/team/${teamId}/roster`,
  `https://www.playoba.ca/stats/api/teams/${teamId}`,
  `https://www.playoba.ca/services/teams/${teamId}`,
  `https://api.playoba.ca/v1/teams/${teamId}`,
  // Digital Shift API pattern (often used by OBA)
  `https://cdn1.sportngin.com/api/teams/${teamId}`,
  // Try the exact URL you found, but checking for JSON response
  `https://www.playoba.ca/stats/team/${teamId}/roster`
];

console.log("Coach is scouting endpoints for Team ID:", teamId);

endpoints.forEach(url => {
  const req = https.get(url, (res) => {
    console.log(`[${res.statusCode}] Checking: ${url}`);
    
    if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            // Check if it looks like JSON
            if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
                console.log("\n✅ TOUCHDOWN! Found JSON data at:");
                console.log("URL: " + url);
                // Print a snippet to verify it's roster data
                console.log("Preview: " + data.substring(0, 150) + "...");
            } 
        });
    }
  });
  
  req.on('error', (e) => {
    // Silence errors, we only care about hits
  });
});
