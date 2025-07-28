import { randomBytes, createHash } from 'crypto';
import { db } from './db/index';
import { users, oauthTokens } from './db/schema';
import { eq, and } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

interface PKCEParams {
  codeVerifier: string;
  codeChallenge: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RobloxUserInfo {
  sub: string;
  name: string;
  nickname: string;
  preferred_username: string;
  created_at: number;
  profile: string;
  picture?: string;
}

interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
}

class RobloxOAuthService {
  private readonly baseUrl = 'https://apis.roblox.com/oauth';
  private readonly clientId: string;
  private readonly clientSecret: string;

  constructor() {
    if (!env.ROBLOX_CLIENT_ID || !env.ROBLOX_CLIENT_SECRET) {
      throw new Error('ROBLOX_CLIENT_ID and ROBLOX_CLIENT_SECRET must be set');
    }
    
    this.clientId = env.ROBLOX_CLIENT_ID;
    this.clientSecret = env.ROBLOX_CLIENT_SECRET;
  }

  /**
   * Generate PKCE parameters for secure OAuth flow
   */
  generatePKCE(): PKCEParams {
    // Generate a random code verifier (43-128 characters)
    const codeVerifier = randomBytes(32).toString('base64url');
    
    // Create code challenge using SHA256
    const codeChallenge = createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');

    return {
      codeVerifier,
      codeChallenge
    };
  }

  /**
   * Generate authorization URL for OAuth flow
   */
  getAuthorizationUrl(state: string, codeChallenge: string, hostname: string, protocol: string = 'https', additionalScopes?: string[]): string {
    const redirectUri = `${protocol}://${hostname}/api/oauth/roblox/callback`;
    
    // Base scopes
    let scope = 'openid profile';
    
    if (additionalScopes && additionalScopes.length > 0) {
      scope += ' ' + additionalScopes.join(' ');
    }
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope,
      response_type: 'code',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'login select_account consent'
    });

    return `${this.baseUrl}/v1/authorize?${params.toString()}`;
  }

  /**
   * Check if user has specific scope
   */
  async hasScope(userId: string, requiredScope: string): Promise<boolean> {
    const tokens = await this.getStoredTokens(userId);
    return tokens?.scope?.includes(requiredScope) ?? false;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    hostname: string,
    protocol: string = 'https'
  ): Promise<TokenResponse> {
    const redirectUri = `${protocol}://${hostname}/api/oauth/roblox/callback`;
    
    const response = await fetch(`${this.baseUrl}/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:', response.status, errorText);
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
    const response = await fetch(`${this.baseUrl}/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', response.status, errorText);
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get user information from Roblox
   */
  async getUserInfo(accessToken: string): Promise<RobloxUserInfo> {
    const response = await fetch(`${this.baseUrl}/v1/userinfo`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Get user info failed:', response.status, errorText);
      throw new Error(`Get user info failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/v1/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        token: refreshToken
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token revocation failed:', response.status, errorText);
      throw new Error(`Token revocation failed: ${response.status}`);
    }
  }

  /**
   * Introspect token to check if it's valid
   */
  async introspectToken(token: string): Promise<{ active: boolean; [key: string]: any }> {
    const response = await fetch(`${this.baseUrl}/v1/token/introspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        token
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token introspection failed:', response.status, errorText);
      throw new Error(`Token introspection failed: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Create or update user in database
   */
  async createOrUpdateUser(userInfo: RobloxUserInfo): Promise<string> {
    const userId = `roblox_${userInfo.sub}`;
    
    // Check if user exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.robloxId, userInfo.sub))
      .limit(1);

    if (existingUser.length > 0) {
      // Update existing user
      await db
        .update(users)
        .set({
          username: userInfo.preferred_username,
          avatar: userInfo.picture || null,
          updatedAt: new Date().toISOString()
        })
        .where(eq(users.id, existingUser[0].id));
      
      return existingUser[0].id;
    } else {
      // Create new user
      const newUser = await db
        .insert(users)
        .values({
          id: userId,
          robloxId: userInfo.sub,
          username: userInfo.preferred_username,
          avatar: userInfo.picture || null,
          updatedAt: new Date().toISOString()
        })
        .returning({ id: users.id });

      return newUser[0].id;
    }
  }

  /**
   * Store OAuth tokens in database
   */
  async storeTokens(userId: string, tokens: TokenResponse): Promise<void> {
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const tokenId = `oauth_${userId}_roblox`;
    const now = new Date().toISOString();

    // Use upsert (insert with ON CONFLICT DO UPDATE) to handle existing tokens
    await db
      .insert(oauthTokens)
      .values({
        id: tokenId,
        userId,
        provider: 'roblox',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: expiresAt.toISOString(),
        scope: tokens.scope,
        createdAt: now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: oauthTokens.id,
        set: {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresAt: expiresAt.toISOString(),
          scope: tokens.scope,
          updatedAt: now
        }
      });
  }

  /**
   * Get stored tokens for a user
   */
  async getStoredTokens(userId: string): Promise<StoredTokens | null> {
    const tokens = await db
      .select()
      .from(oauthTokens)
      .where(and(
        eq(oauthTokens.userId, userId),
        eq(oauthTokens.provider, 'roblox')
      ))
      .limit(1);

    if (tokens.length === 0) {
      return null;
    }

    const token = tokens[0];
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt ? new Date(token.expiresAt) : null,
      scope: token.scope
    };
  }

  /**
   * Get a valid access token, refreshing if necessary
   */
  async getValidAccessToken(userId: string): Promise<string | null> {
    const tokens = await this.getStoredTokens(userId);
    
    if (!tokens) {
      return null;
    }

    // Check if token is still valid (with 5 minute buffer)
    const now = new Date();
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    if (tokens.expiresAt && tokens.expiresAt.getTime() > now.getTime() + bufferTime) {
      // Token is still valid
      return tokens.accessToken;
    }

    // Token is expired or about to expire, try to refresh
    if (!tokens.refreshToken) {
      // No refresh token available
      return null;
    }

    try {
      const newTokens = await this.refreshAccessToken(tokens.refreshToken);
      await this.storeTokens(userId, newTokens);
      return newTokens.access_token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      // Remove invalid tokens
      await this.removeTokens(userId);
      return null;
    }
  }

  /**
   * Remove stored tokens for a user
   */
  async removeTokens(userId: string): Promise<void> {
    await db
      .delete(oauthTokens)
      .where(and(
        eq(oauthTokens.userId, userId),
        eq(oauthTokens.provider, 'roblox')
      ));
  }

  /**
   * Check if user has revoked authorization by introspecting the token
   */
  async checkTokenValidity(userId: string): Promise<boolean> {
    const tokens = await this.getStoredTokens(userId);
    
    if (!tokens || !tokens.refreshToken) {
      return false;
    }

    try {
      const introspection = await this.introspectToken(tokens.refreshToken);
      return introspection.active;
    } catch (error) {
      console.error('Token introspection failed:', error);
      return false;
    }
  }
}

export const robloxOAuth = new RobloxOAuthService();