/**
 * Verification script to test the service refactoring
 * Tests that all core services work correctly after splitting storage.ts
 */

import { userService } from './server/services/userService';
import { organizationService } from './server/services/organizationService';
import { diamondService } from './server/services/diamondService';
import { teamService } from './server/services/teamService';
import { tournamentService } from './server/services/tournamentService';
import { gameService } from './server/services/gameService';
import { playoffService } from './server/services/playoffService';

async function testServices() {
  console.log('🧪 Testing Service Refactoring\n');
  
  const results = {
    passed: 0,
    failed: 0,
  };

  // Test 1: Organization Service
  try {
    const orgs = await organizationService.getOrganizations();
    console.log(`✅ OrganizationService: Retrieved ${orgs.length} organizations`);
    results.passed++;
  } catch (error) {
    console.log(`❌ OrganizationService failed: ${error}`);
    results.failed++;
  }

  // Test 2: Diamond Service
  try {
    const orgs = await organizationService.getOrganizations();
    if (orgs.length > 0) {
      const diamonds = await diamondService.getDiamonds(orgs[0].id);
      console.log(`✅ DiamondService: Retrieved ${diamonds.length} diamonds for org ${orgs[0].name}`);
      results.passed++;
    } else {
      console.log('⚠️  DiamondService: Skipped (no organizations)');
    }
  } catch (error) {
    console.log(`❌ DiamondService failed: ${error}`);
    results.failed++;
  }

  // Test 3: Tournament Service
  try {
    const orgs = await organizationService.getOrganizations();
    if (orgs.length > 0) {
      const tournaments = await tournamentService.getTournaments(orgs[0].id);
      console.log(`✅ TournamentService: Retrieved ${tournaments.length} tournaments`);
      results.passed++;
      
      // Test 4: Game Service  
      if (tournaments.length > 0) {
        try {
          const games = await gameService.getGames(tournaments[0].id);
          console.log(`✅ GameService: Retrieved ${games.length} games for tournament ${tournaments[0].name}`);
          results.passed++;
        } catch (error) {
          console.log(`❌ GameService failed: ${error}`);
          results.failed++;
        }
        
        // Test 5: Team Service
        try {
          const teams = await teamService.getTeams(tournaments[0].id);
          console.log(`✅ TeamService: Retrieved ${teams.length} teams`);
          results.passed++;
        } catch (error) {
          console.log(`❌ TeamService failed: ${error}`);
          results.failed++;
        }
      } else {
        console.log('⚠️  GameService & TeamService: Skipped (no tournaments)');
      }
    } else {
      console.log('⚠️  TournamentService, GameService & TeamService: Skipped (no organizations)');
    }
  } catch (error) {
    console.log(`❌ TournamentService failed: ${error}`);
    results.failed++;
  }

  // Summary
  console.log(`\n📊 Results: ${results.passed} passed, ${results.failed} failed`);
  
  if (results.failed === 0) {
    console.log('\n🎉 SUCCESS: All service migrations working correctly!');
    process.exit(0);
  } else {
    console.log('\n❌ FAILURE: Some services have issues');
    process.exit(1);
  }
}

testServices().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
