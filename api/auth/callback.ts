import type { VercelRequest, VercelResponse } from '@vercel/node';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const ALLOWED_DOMAIN = 'partrunner.com';

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string;
  hd?: string; // Hosted domain
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    return res.redirect('/?error=' + encodeURIComponent(String(error)));
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const baseUrl = `https://${req.headers.host}`;
    const redirectUri = `${baseUrl}/api/auth/callback`;

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);
      return res.redirect('/?error=token_exchange_failed');
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return res.redirect('/?error=userinfo_failed');
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    // Verify domain
    if (!userInfo.email.endsWith('@' + ALLOWED_DOMAIN)) {
      return res.redirect('/?error=domain_not_allowed');
    }

    // Create a simple session token (in production, use proper JWT signing)
    const userData = {
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      timestamp: Date.now(),
    };

    // Redirect to main page with user data in fragment (client-side only)
    const userDataEncoded = Buffer.from(JSON.stringify(userData)).toString('base64');
    
    // Return HTML that stores the data and redirects
    res.setHeader('Content-Type', 'text/html');
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Authenticating...</title>
        </head>
        <body>
          <script>
            localStorage.setItem('docval_user', '${JSON.stringify(userData)}');
            window.location.href = '/';
          </script>
          <p>Redirecting...</p>
        </body>
      </html>
    `);

  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.redirect('/?error=callback_error');
  }
}

