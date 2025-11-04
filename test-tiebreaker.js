// Simulate the tie-breaker calculation
const teams = [
  { name: 'Forest Glade', runsAgainst: 6, defensiveInnings: 9, runsFor: 26, offensiveInnings: 9, points: 4 },
  { name: 'Wexford Agincourt', runsAgainst: 8, defensiveInnings: 11, runsFor: 19, offensiveInnings: 11, points: 4 },
  { name: 'Everett', runsAgainst: 9, defensiveInnings: 10, runsFor: 19, offensiveInnings: 10, points: 4 },
  { name: 'Binbrook', runsAgainst: 10, defensiveInnings: 10, runsFor: 21, offensiveInnings: 9, points: 4 },
  { name: 'Northumberland', runsAgainst: 10, defensiveInnings: 10, runsFor: 13, offensiveInnings: 9, points: 4 },
  { name: 'Saugeen Shores', runsAgainst: 13, defensiveInnings: 9, runsFor: 24, offensiveInnings: 9, points: 4 },
];

teams.forEach(t => {
  t.runsAgainstPerInning = t.defensiveInnings > 0 ? t.runsAgainst / t.defensiveInnings : 0;
  t.runsForPerInning = t.offensiveInnings > 0 ? t.runsFor / t.offensiveInnings : 0;
});

console.log('Teams with calculated ratios:');
teams.forEach(t => {
  console.log(`${t.name}: RA/DIP=${t.runsAgainstPerInning.toFixed(3)}, RF/OI=${t.runsForPerInning.toFixed(3)}`);
});

// Sort by RA/DIP (ascending - lower is better)
teams.sort((a, b) => a.runsAgainstPerInning - b.runsAgainstPerInning);

console.log('\nSorted by RA/DIP:');
teams.forEach((t, i) => {
  console.log(`${i+1}. ${t.name}: ${t.runsAgainstPerInning.toFixed(3)}`);
});
