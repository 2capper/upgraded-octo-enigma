import { format, addDays } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';

const BASE_URL = 'http://localhost:5000';
const TOURNAMENT_ID = 'playoff-bracket-test-2025-11';
const DIVISION_ID = 'playoff-bracket-test-2025-11-11u';

interface PlayoffSlot {
  date: string;
  time: string;
  diamondId: string;
}

interface PlayoffSlotsPayload {
  [key: string]: PlayoffSlot;
}

async function testPlayoffSlots() {
  console.log('🧪 Testing Playoff Slot Pre-Scheduling Feature\n');

  const tomorrow = addDays(new Date(), 1);
  const dayAfter = addDays(new Date(), 2);

  const testSlots: PlayoffSlotsPayload = {
    'r1-g1': {
      date: format(tomorrow, 'yyyy-MM-dd'),
      time: '09:00',
      diamondId: 'c7c20664-82c6-4ccc-a4a0-15a641f2fb7e'
    },
    'r1-g2': {
      date: format(tomorrow, 'yyyy-MM-dd'),
      time: '11:00',
      diamondId: 'd9e274c3-1dfa-4466-9550-082150a2c3af'
    },
    'r1-g3': {
      date: format(tomorrow, 'yyyy-MM-dd'),
      time: '13:00',
      diamondId: '6a84b154-2f0f-4a08-ab65-4f755c753042'
    },
    'r1-g4': {
      date: format(tomorrow, 'yyyy-MM-dd'),
      time: '15:00',
      diamondId: 'f8315e90-0f40-4626-8c2b-6ed1c9d61574'
    },
    'r2-g5': {
      date: format(dayAfter, 'yyyy-MM-dd'),
      time: '10:00',
      diamondId: 'c7c20664-82c6-4ccc-a4a0-15a641f2fb7e'
    },
    'r2-g6': {
      date: format(dayAfter, 'yyyy-MM-dd'),
      time: '12:00',
      diamondId: 'd9e274c3-1dfa-4466-9550-082150a2c3af'
    },
    'r3-g7': {
      date: format(dayAfter, 'yyyy-MM-dd'),
      time: '15:00',
      diamondId: 'c7c20664-82c6-4ccc-a4a0-15a641f2fb7e'
    }
  };

  console.log('📝 Test Data:');
  console.log('Tournament ID:', TOURNAMENT_ID);
  console.log('Division ID:', DIVISION_ID);
  console.log('Slots to schedule:', Object.keys(testSlots).length);
  console.log('\n📅 Scheduled Games:');
  Object.entries(testSlots).forEach(([key, slot]) => {
    console.log(`  ${key}: ${slot.date} at ${slot.time} on diamond ${slot.diamondId.substring(0, 8)}...`);
  });

  console.log('\n🔄 Sending POST request to /api/tournaments/.../playoff-slots...');
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/tournaments/${TOURNAMENT_ID}/divisions/${DIVISION_ID}/playoff-slots`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ slots: testSlots }),
        credentials: 'include'
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Request failed:', response.status, response.statusText);
      console.error('Error details:', errorText);
      return;
    }

    const result = await response.json();
    console.log('✅ Success! Slots saved.');
    console.log('\n📊 Response:', JSON.stringify(result, null, 2));

    console.log('\n🔍 Verifying saved data...');
    const gamesResponse = await fetch(
      `${BASE_URL}/api/tournaments/${TOURNAMENT_ID}/divisions/${DIVISION_ID}/games`,
      { credentials: 'include' }
    );

    if (gamesResponse.ok) {
      const games = await gamesResponse.json();
      const playoffGames = games.filter((g: any) => g.isPlayoff);
      
      console.log(`\n✅ Found ${playoffGames.length} playoff games:`);
      playoffGames.forEach((game: any) => {
        console.log(`  Round ${game.playoffRound}, Game ${game.playoffGameNumber}:`);
        console.log(`    Date: ${game.date}, Time: ${game.time}`);
        console.log(`    Diamond: ${game.diamondId || 'Not assigned'}`);
        console.log(`    Teams: ${game.homeTeamId || 'TBD'} vs ${game.awayTeamId || 'TBD'}`);
      });
    }

    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

console.log('⚠️  NOTE: This test requires authentication. Make sure you are logged in as an admin.');
console.log('⚠️  Run this with: tsx test-playoff-slots.ts\n');

testPlayoffSlots();
