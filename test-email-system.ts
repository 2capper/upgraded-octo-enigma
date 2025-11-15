import { notificationService } from './server/lib/notificationService';

async function testEmailSystem() {
  console.log('Testing Email System...\n');

  // Test 1: Welcome Email
  console.log('📧 Sending welcome email...');
  try {
    await notificationService.sendWelcomeEmail({
      organizationId: 'test-org-123',
      organizationName: 'Test Baseball League',
      adminName: 'Richard Lepage',
      adminEmail: 'rlepage@forestgladebaseball.com',
    });
    console.log('✅ Welcome email sent successfully!\n');
  } catch (error) {
    console.error('❌ Welcome email failed:', error);
  }

  // Test 2: Tournament Email
  console.log('📧 Sending tournament email...');
  try {
    await notificationService.sendTournamentEmail({
      organizationId: 'test-org-123',
      organizationName: 'Test Baseball League',
      organizationLogoUrl: 'https://example.com/logo.png',
      primaryColor: '#22c55e',
      tournamentId: 'test-tournament-123',
      tournamentName: 'Spring 2025 Championship',
      startDate: '2025-05-01',
      endDate: '2025-05-03',
      adminName: 'Richard Lepage',
      adminEmail: 'rlepage@forestgladebaseball.com',
    });
    console.log('✅ Tournament email sent successfully!\n');
  } catch (error) {
    console.error('❌ Tournament email failed:', error);
  }

  console.log('Test complete! Check rlepage@forestgladebaseball.com for emails.');
}

testEmailSystem().catch(console.error);
