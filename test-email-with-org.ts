import { storage } from './server/storage';
import { notificationService } from './server/lib/notificationService';

async function testWithRealOrg() {
  console.log('Creating test organization...\n');

  // Create test organization
  const testOrg = await storage.createOrganization({
    name: 'Test Baseball League - Email Test',
    slug: 'test-baseball-email-' + Date.now(),
    adminEmail: 'rlepage@forestgladebaseball.com',
    primaryColor: '#22c55e',
    secondaryColor: '#ffffff',
    timezone: 'America/Toronto',
    defaultPrimaryColor: '#22c55e',
    defaultSecondaryColor: '#ffffff',
    defaultPlayoffFormat: 'top_6',
    defaultSeedingPattern: 'standard',
  });

  console.log(`✅ Organization created: ${testOrg.id}\n`);

  // Test 1: Welcome Email
  console.log('📧 Sending welcome email to rlepage@forestgladebaseball.com...');
  try {
    await notificationService.sendWelcomeEmail({
      organizationId: testOrg.id,
      organizationName: testOrg.name,
      adminName: 'Richard Lepage',
      adminEmail: 'rlepage@forestgladebaseball.com',
    });
    console.log('✅ Welcome email sent successfully!\n');
  } catch (error) {
    console.error('❌ Welcome email failed:', error);
  }

  // Test 2: Tournament Email
  console.log('📧 Sending tournament email to rlepage@forestgladebaseball.com...');
  try {
    await notificationService.sendTournamentEmail({
      organizationId: testOrg.id,
      organizationName: testOrg.name,
      organizationLogoUrl: testOrg.logoUrl || undefined,
      primaryColor: testOrg.primaryColor || '#22c55e',
      tournamentId: 'test-tournament-' + Date.now(),
      tournamentName: 'Spring 2025 Championship - Email Test',
      startDate: '2025-05-01',
      endDate: '2025-05-03',
      adminName: 'Richard Lepage',
      adminEmail: 'rlepage@forestgladebaseball.com',
    });
    console.log('✅ Tournament email sent successfully!\n');
  } catch (error) {
    console.error('❌ Tournament email failed:', error);
  }

  console.log('✨ Test complete! Check rlepage@forestgladebaseball.com for 2 emails:');
  console.log('   1. Welcome to Dugout Desk email');
  console.log('   2. Tournament Ready email with org branding');
}

testWithRealOrg().catch(console.error);
