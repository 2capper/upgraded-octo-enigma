import { google } from 'googleapis';

const GMAIL_CONNECTION_ID = 'conn_google-mail_01KA4SNTM9Q1SRPTZ8E3PNKQ5T';

let connectionSettings: any;

async function getAccessToken() {
  const expiresAt = connectionSettings?.settings?.oauth?.credentials?.expires_at;
  if (connectionSettings && expiresAt && new Date(expiresAt).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    `https://${hostname}/api/v2/connection/${GMAIL_CONNECTION_ID}?include_secrets=true`,
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json());

  const accessToken = connectionSettings?.settings?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected or access token not found');
  }
  return accessToken;
}

export async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}
