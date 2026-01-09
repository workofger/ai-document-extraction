import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const ALLOWED_DOMAIN = 'partrunner.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const baseUrl = `https://${req.headers.host}`;
  const redirectUri = `${baseUrl}/api/auth/callback`;

  if (req.method === 'GET') {
    // Redirect to Google OAuth
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'email profile');
    authUrl.searchParams.set('access_type', 'online');
    authUrl.searchParams.set('hd', ALLOWED_DOMAIN); // Restrict to domain
    authUrl.searchParams.set('prompt', 'select_account');

    return res.redirect(302, authUrl.toString());
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

