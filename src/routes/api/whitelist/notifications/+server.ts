import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionWithUser } from '$lib/server/session.js';
import { db } from '$lib/server/db/index.js';
import { whitelistRequests } from '$lib/server/db/schema.js';
import { eq, and, gt, or, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    // Require authentication
    const sessionData = await getSessionWithUser(cookies);
    if (!sessionData?.user) {
      return json({ 
        success: false, 
        message: 'Authentication required' 
      }, { status: 401 });
    }

    const { user } = sessionData;

    // Parse query parameters
    const since = url.searchParams.get('since');
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));

    // Build query conditions
    const conditions = [eq(whitelistRequests.userId, user.id)];

    // Only get updates since the specified timestamp
    if (since) {
      try {
        const sinceDate = new Date(since);
        if (!isNaN(sinceDate.getTime())) {
          conditions.push(gt(whitelistRequests.updatedAt, sinceDate.toISOString()));
        }
      } catch (error) {
        console.warn('Invalid since parameter:', since);
      }
    }

    // Only get requests that have been processed (approved or rejected)
    // and have not been notified to user yet
    const statusConditions = and(
      ...conditions,
      // Only approved or rejected requests
      or(
        eq(whitelistRequests.status, 'APPROVED'),
        eq(whitelistRequests.status, 'REJECTED')
      ),
      // Only requests where user hasn't been notified yet
      eq(whitelistRequests.userNotified, false)
    );

    // Get recent status updates for the user
    const updates = await db
      .select({
        requestId: whitelistRequests.requestId,
        audioId: whitelistRequests.audioId,
        name: whitelistRequests.name,
        status: whitelistRequests.status,
        updatedAt: whitelistRequests.updatedAt,
        userNotified: whitelistRequests.userNotified
      })
      .from(whitelistRequests)
      .where(statusConditions)
      .orderBy(whitelistRequests.updatedAt)
      .limit(limit);

    // Mark the retrieved updates as acknowledged
    if (updates.length > 0) {
      const requestIds = updates.map(update => update.requestId);
      
      await db
        .update(whitelistRequests)
        .set({
          userNotified: true,
          updatedAt: new Date().toISOString()
        })
        .where(
          and(
            eq(whitelistRequests.userId, user.id),
            inArray(whitelistRequests.requestId, requestIds)
          )
        );

      console.log(`📬 Delivered ${updates.length} notification updates to user ${user.id}`);
    }

    return json({
      success: true,
      data: updates,
      metadata: {
        count: updates.length,
        since: since || null,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching whitelist notifications:', error);
    return json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
};

// Optional: Add a POST endpoint to manually mark notifications as acknowledged
export const POST: RequestHandler = async ({ cookies, request }) => {
  try {
    // Require authentication
    const sessionData = await getSessionWithUser(cookies);
    if (!sessionData?.user) {
      return json({ 
        success: false, 
        message: 'Authentication required' 
      }, { status: 401 });
    }

    const { user } = sessionData;
    const body = await request.json();
    const { requestIds } = body;

    if (!Array.isArray(requestIds) || requestIds.length === 0) {
      return json({ 
        success: false, 
        message: 'Invalid request IDs' 
      }, { status: 400 });
    }

    // Mark specific notifications as read by user
    const result = await db
      .update(whitelistRequests)
      .set({
        userNotified: true,
        updatedAt: new Date().toISOString()
      })
      .where(
        and(
          eq(whitelistRequests.userId, user.id),
          inArray(whitelistRequests.requestId, requestIds)
        )
      )
      .returning({ requestId: whitelistRequests.requestId });

    return json({
      success: true,
      data: {
        acknowledgedCount: result.length,
        acknowledgedIds: result.map(r => r.requestId)
      }
    });

  } catch (error) {
    console.error('Error acknowledging whitelist notifications:', error);
    return json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
};