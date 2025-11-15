import { getUncachableGmailClient } from './server/lib/gmail';

async function testGmailConnection() {
  try {
    console.log('Testing Gmail connection...');
    const gmail = await getUncachableGmailClient();
    console.log('✅ Gmail client created successfully');
    
    // Try to get user profile to verify connection
    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log('✅ Gmail connection verified!');
    console.log(`Email address: ${profile.data.emailAddress}`);
  } catch (error) {
    console.error('❌ Gmail connection failed:', error.message);
    console.error('Details:', error);
  }
}

testGmailConnection();
