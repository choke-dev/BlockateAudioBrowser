import { json } from '@sveltejs/kit';
import { sessionService } from '$lib/server/session.js';
import { robloxOAuth } from '$lib/server/oauth.js';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ cookies }) => {
  try {
    const sessionId = cookies.get('session');
    
    if (!sessionId) {
      return json({
        authenticated: false,
        user: null
      });
    }
    
    // Get user from session
    const user = await sessionService.getUserBySession(sessionId);
    
    if (!user) {
      // Clear invalid session cookie
      cookies.delete('session', { path: '/' });
      return json({
        authenticated: false,
        user: null
      });
    }
    
    // Check if we have valid OAuth tokens
    const validAccessToken = await robloxOAuth.getValidAccessToken(user.id);
    
    if (!validAccessToken) {
      // User exists but tokens are invalid/expired
      return json({
        authenticated: false,
        user: null,
        requiresReauth: true
      });
    }
    
    // Extend session since user is active
    await sessionService.extendSession(sessionId);
    
    return json({
      authenticated: true,
      user: {
        id: user.id,
        robloxId: user.robloxId,
        username: user.username,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
    
  } catch (error) {
    console.error('User info endpoint error:', error);
    return json({
      authenticated: false,
      user: null,
      error: 'Internal server error'
    }, { status: 500 });
  }
};