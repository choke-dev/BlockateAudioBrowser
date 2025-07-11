import { redirect } from '@sveltejs/kit';
import { robloxOAuth } from '$lib/server/oauth.js';
import { sessionService } from '$lib/server/session.js';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ url, cookies }) => {
  try {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    
    // Check for OAuth errors
    if (error) {
      console.error('OAuth error:', error);
      throw redirect(302, '/?error=oauth_error');
    }
    
    if (!code || !state) {
      throw redirect(302, '/?error=missing_parameters');
    }
    
    // Verify state parameter (CSRF protection)
    const storedState = cookies.get('oauth_state');
    if (!storedState || storedState !== state) {
      throw redirect(302, '/?error=invalid_state');
    }
    
    // Get stored code verifier
    const codeVerifier = cookies.get('oauth_code_verifier');
    if (!codeVerifier) {
      throw redirect(302, '/?error=missing_verifier');
    }
    
    // Clear OAuth cookies
    cookies.delete('oauth_state', { path: '/' });
    cookies.delete('oauth_code_verifier', { path: '/' });
    
    // Exchange code for tokens
    const hostname = url.hostname + (url.port ? `:${url.port}` : '');
    const tokens = await robloxOAuth.exchangeCodeForTokens(code, codeVerifier, hostname);
    
    // Get user info from Roblox
    const userInfo = await robloxOAuth.getUserInfo(tokens.access_token);
    
    // Create or update user in database
    const userId = await robloxOAuth.createOrUpdateUser(userInfo);
    
    // Store OAuth tokens
    await robloxOAuth.storeTokens(userId, tokens);
    
    // Create session
    const sessionId = await sessionService.createSession(userId);
    
    // Set session cookie
    cookies.set('session', sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/'
    });
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    
    // If it's already a redirect, re-throw it
    if (error instanceof Response && error.status >= 300 && error.status < 400) {
      throw error;
    }
    
    // Otherwise redirect with error
    throw redirect(302, '/?error=oauth_callback_failed');
  }
  
  // Redirect to home page
  throw redirect(302, '/');
};