export interface OAuthResult {
  refreshToken: string;
  accessToken: string;
  email: string | null;
}

export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    redirectUri: process.env.GOOGLE_REDIRECT_URI || '',
  };
}

export function msConfig() {
  return {
    clientId: process.env.MS_CLIENT_ID || '',
    clientSecret: process.env.MS_CLIENT_SECRET || '',
    redirectUri: process.env.MS_REDIRECT_URI || '',
    tenant: process.env.MS_TENANT || 'common',
  };
}

export function googleConfigured(): boolean {
  const c = googleConfig();
  return !!(c.clientId && c.clientSecret && c.redirectUri);
}

export function msConfigured(): boolean {
  const c = msConfig();
  return !!(c.clientId && c.clientSecret && c.redirectUri);
}

const GOOGLE_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const MS_SCOPE = 'offline_access Files.ReadWrite User.Read';

export function googleAuthUrl(state: string): string {
  const c = googleConfig();
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export function msAuthUrl(state: string): string {
  const c = msConfig();
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: c.redirectUri,
    response_type: 'code',
    scope: MS_SCOPE,
    response_mode: 'query',
    state,
  });
  return `https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/authorize?${p.toString()}`;
}

async function postForm(url: string, body: Record<string, string>): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description || json.error || `OAuth error ${res.status}`);
  return json;
}

export async function googleExchangeCode(code: string): Promise<OAuthResult> {
  const c = googleConfig();
  const t = await postForm('https://oauth2.googleapis.com/token', {
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    grant_type: 'authorization_code',
  });
  let email: string | null = null;
  try {
    const u = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then((r) => r.json());
    email = u.email ?? null;
  } catch {
    /* email is optional */
  }
  return { refreshToken: t.refresh_token, accessToken: t.access_token, email };
}

export async function googleRefresh(refreshToken: string): Promise<string> {
  const c = googleConfig();
  const t = await postForm('https://oauth2.googleapis.com/token', {
    refresh_token: refreshToken,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: 'refresh_token',
  });
  return t.access_token;
}

export async function msExchangeCode(code: string): Promise<OAuthResult> {
  const c = msConfig();
  const t = await postForm(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: c.redirectUri,
    grant_type: 'authorization_code',
    scope: MS_SCOPE,
  });
  let email: string | null = null;
  try {
    const u = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${t.access_token}` },
    }).then((r) => r.json());
    email = u.mail || u.userPrincipalName || null;
  } catch {
    /* email is optional */
  }
  return { refreshToken: t.refresh_token, accessToken: t.access_token, email };
}

export async function msRefresh(refreshToken: string): Promise<string> {
  const c = msConfig();
  const t = await postForm(`https://login.microsoftonline.com/${c.tenant}/oauth2/v2.0/token`, {
    refresh_token: refreshToken,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    grant_type: 'refresh_token',
    scope: MS_SCOPE,
  });
  return t.access_token;
}
