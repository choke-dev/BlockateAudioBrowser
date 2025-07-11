import { json, redirect } from '@sveltejs/kit';
import { sessionService } from '$lib/server/session.js';
import { robloxOAuth } from '$lib/server/oauth.js';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const sessionId = cookies.get('session');
    
    if (sessionId) {
      // Get user from session
      const user = await sessionService.getUserBySession(sessionId);
      
      if (user) {
        // Get stored OAuth tokens
        const tokens = await robloxOAuth.getStoredTokens(user.id);
        
        // Revoke refresh token on Roblox side if it exists
        if (tokens && tokens.refreshToken) {
          try {
            await robloxOAuth.revokeRefreshToken(tokens.refreshToken);
          } catch (error) {
            console.warn('Failed to revoke refresh token on Roblox side:', error);
            // Continue with logout even if revocation fails
          }
          
          // Remove tokens from database
          await robloxOAuth.removeTokens(user.id);
        }
        
        // Delete all user sessions
        await sessionService.deleteUserSessions(user.id);
      }
      
      // Delete session cookie
      cookies.delete('session', { path: '/' });
    }
    
    return json({ success: true });
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Still clear the session cookie even if there was an error
    cookies.delete('session', { path: '/' });
    
    return json({
      success: false,
      error: 'Logout failed'
    }, { status: 500 });
  }
};

// Also support GET for simple logout links
export const GET: RequestHandler = async ({ cookies }) => {
  const sessionId = cookies.get('session');
  
  if (sessionId) {
    try {
      const user = await sessionService.getUserBySession(sessionId);
      
      if (user) {
        const tokens = await robloxOAuth.getStoredTokens(user.id);
        
        if (tokens && tokens.refreshToken) {
          try {
            await robloxOAuth.revokeRefreshToken(tokens.refreshToken);
          } catch (error) {
            console.warn('Failed to revoke refresh token on Roblox side:', error);
          }
          
          await robloxOAuth.removeTokens(user.id);
        }
        
        await sessionService.deleteUserSessions(user.id);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  cookies.delete('session', { path: '/' });
  throw redirect(302, '/');
};