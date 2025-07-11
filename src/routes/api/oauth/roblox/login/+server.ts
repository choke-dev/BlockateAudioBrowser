import { json } from '@sveltejs/kit';
import { robloxOAuth } from '$lib/server/oauth.js';
import { randomBytes } from 'crypto';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies, url }) => {
  try {
    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = robloxOAuth.generatePKCE();
    
    // Generate state parameter for CSRF protection
    const state = randomBytes(32).toString('hex');
    
    // Store PKCE verifier and state in secure cookies
    cookies.set('oauth_code_verifier', codeVerifier, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
      path: '/'
    });
    
    // Generate authorization URL with current hostname
    const hostname = url.hostname + (url.port ? `:${url.port}` : '');
    const authUrl = robloxOAuth.getAuthorizationUrl(state, codeChallenge, hostname);
    
    return json({
      success: true,
      data: authUrl
    });
  } catch (error) {
    console.error('OAuth login error:', error);
    return json({
      success: false,
      error: 'Failed to initiate OAuth flow'
    }, { status: 500 });
  }
};