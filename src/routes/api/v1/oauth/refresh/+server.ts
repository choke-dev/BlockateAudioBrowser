import { json } from '@sveltejs/kit';
import { sessionService } from '$lib/server/session';
import { robloxOAuth } from '$lib/server/oauth';
import type { RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  try {
    const sessionId = cookies.get('session');
    
    if (!sessionId) {
      return json({
        success: false,
        error: 'No session found'
      }, { status: 401 });
    }
    
    // Get user from session
    const user = await sessionService.getUserBySession(sessionId);
    
    if (!user) {
      return json({
        success: false,
        error: 'Invalid session'
      }, { status: 401 });
    }
    
    // Get stored OAuth tokens
    const tokens = await robloxOAuth.getStoredTokens(user.id);
    
    if (!tokens || !tokens.refreshToken) {
      return json({
        success: false,
        error: 'No refresh token available'
      }, { status: 400 });
    }
    
    try {
      // Refresh the access token
      const newTokens = await robloxOAuth.refreshAccessToken(tokens.refreshToken);
      
      // Store the new tokens
      await robloxOAuth.storeTokens(user.id, newTokens);
      
      // Extend session
      await sessionService.extendSession(sessionId);
      
      return json({
        success: true,
        message: 'Tokens refreshed successfully'
      });
      
    } catch (error) {
      console.error('Token refresh failed:', error);
      
      // If refresh fails, the tokens are likely invalid
      // Remove them from database
      await robloxOAuth.removeTokens(user.id);
      
      return json({
        success: false,
        error: 'Token refresh failed',
        requiresReauth: true
      }, { status: 401 });
    }
    
  } catch (error) {
    console.error('Refresh endpoint error:', error);
    return json({
      success: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
};