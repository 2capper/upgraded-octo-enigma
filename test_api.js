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
];

console.log("Coach is scouting endpoints for Team ID:", teamId);

let pending = endpoints.length;

endpoints.forEach(url => {
  const req = https.get(url, (res) => {
    // We only care if we get a 200 OK
    if (res.statusCode === 200) {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            // Check if it looks like JSON
            if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
                console.log("\n✅ TOUCHDOWN! Found JSON data at:");
                console.log("URL: " + url);
                console.log("Preview: " + data.substring(0, 100) + "...");
            } else {
               console.log(`[${res.statusCode}] ${url} (Returned HTML, likely not the API)`);
            }
        });
    } else {
        console.log(`[${res.statusCode}] ${url}`);
    }
  });
  
  req.on('error', (e) => {
    console.log(`[Error] ${url}: ${e.message}`);
  });
});
