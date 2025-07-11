import { randomBytes } from 'crypto';
import { db } from './db/index.js';
import { users, sessions } from './db/schema.js';
import { eq, lt } from 'drizzle-orm';

interface User {
  id: string;
  robloxId: string;
  username: string;
  avatar: string | null;
  createdAt: string;
}

interface Session {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

class SessionService {
  private readonly sessionDuration = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

  /**
   * Create a new session for a user
   */
  async createSession(userId: string): Promise<string> {
    const sessionId = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionDuration);

    await db
      .insert(sessions)
      .values({
        id: sessionId,
        userId,
        expiresAt: expiresAt.toISOString()
      });

    return sessionId;
  }

  /**
   * Get user by session ID
   */
  async getUserBySession(sessionId: string): Promise<User | null> {
    const result = await db
      .select({
        id: users.id,
        robloxId: users.robloxId,
        username: users.username,
        avatar: users.avatar,
        createdAt: users.createdAt,
        sessionExpiresAt: sessions.expiresAt
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const session = result[0];
    
    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.sessionExpiresAt);
    
    if (expiresAt <= now) {
      // Session is expired, delete it
      await this.deleteSession(sessionId);
      return null;
    }

    return {
      id: session.id,
      robloxId: session.robloxId,
      username: session.username,
      avatar: session.avatar,
      createdAt: session.createdAt
    };
  }

  /**
   * Extend session expiration time
   */
  async extendSession(sessionId: string): Promise<void> {
    const newExpiresAt = new Date(Date.now() + this.sessionDuration);
    
    await db
      .update(sessions)
      .set({
        expiresAt: newExpiresAt.toISOString()
      })
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Delete a specific session
   */
  async deleteSession(sessionId: string): Promise<void> {
    await db
      .delete(sessions)
      .where(eq(sessions.id, sessionId));
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<void> {
    await db
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  }

  /**
   * Clean up expired sessions (should be run periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = new Date();
    
    const deletedSessions = await db
      .delete(sessions)
      .where(lt(sessions.expiresAt, now.toISOString()))
      .returning({ id: sessions.id });

    return deletedSessions.length;
  }

  /**
   * Get session info without user data
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const result = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const session = result[0];
    
    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    
    if (expiresAt <= now) {
      // Session is expired, delete it
      await this.deleteSession(sessionId);
      return null;
    }

    return session;
  }

  /**
   * Validate session and return whether it's valid
   */
  async isValidSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const now = new Date();
    
    const result = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, userId));

    // Filter out expired sessions and delete them
    const validSessions: Session[] = [];
    const expiredSessionIds: string[] = [];

    for (const session of result) {
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt > now) {
        validSessions.push(session);
      } else {
        expiredSessionIds.push(session.id);
      }
    }

    // Clean up expired sessions
    if (expiredSessionIds.length > 0) {
      await db
        .delete(sessions)
        .where(eq(sessions.id, expiredSessionIds[0])); // Note: This would need to be updated for multiple IDs
    }

    return validSessions;
  }

  /**
   * Update session last activity (extends expiration)
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    await this.extendSession(sessionId);
  }
}

export const sessionService = new SessionService();