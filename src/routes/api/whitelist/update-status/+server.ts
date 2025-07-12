import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { whitelistRequests } from '$lib/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { supabase } from '$lib/server/supabase';

const UpdateStatusSchema = z.object({
  requestId: z.string().min(1, 'Request ID is required'),
  status: z.enum(['APPROVED', 'REJECTED'], {
    message: 'Status must be either APPROVED or REJECTED'
  }),
  reason: z.string().optional() // Optional reason for rejection
});

export const POST: RequestHandler = async (event) => {
  try {
    // Require authentication (this would typically check for admin privileges)
    const user = await requireAuth(event);
    
    // Parse and validate request body
    const body = await event.request.json();
    const { requestId, status, reason } = UpdateStatusSchema.parse(body);
    
    // Get the current request to verify it exists and get user info
    const existingRequest = await db.query.whitelistRequests.findFirst({
      where: eq(whitelistRequests.requestId, requestId)
    });

    if (!existingRequest) {
      return json(
        { error: 'Whitelist request not found' },
        { status: 404 }
      );
    }

    if (existingRequest.status !== 'PENDING') {
      return json(
        { error: `Request has already been ${existingRequest.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update the request status
    const updatedRequest = await db
      .update(whitelistRequests)
      .set({
        status,
        updatedAt: now,
        acknowledged: false // Reset acknowledged flag so user gets notified
      })
      .where(eq(whitelistRequests.requestId, requestId))
      .returning();

    if (updatedRequest.length === 0) {
      return json(
        { error: 'Failed to update request status' },
        { status: 500 }
      );
    }

    const request = updatedRequest[0];

    // If approved, also add to the main audios table
    if (status === 'APPROVED') {
      try {
        // Note: You might want to import and use the audios table here
        // This is a placeholder for the actual audio insertion logic
        console.log(`✅ Request ${requestId} approved - should add to audios table`);
      } catch (error) {
        console.error('Failed to add approved audio to main table:', error);
        // Continue anyway - the request is still marked as approved
      }
    }

    // Send notification to admin channel (existing functionality)
    const whitelistRequestChannel = supabase.channel('audio-whitelist');
    whitelistRequestChannel.send({
      type: "broadcast",
      event: "whitelist-status-updated",
      payload: {
        requestId: request.requestId,
        audioId: request.audioId,
        name: request.name,
        status: request.status,
        updatedAt: request.updatedAt,
        updatedBy: user.id
      }
    });

    // Send notification to user-specific channel for real-time updates
    // This is more secure than the previous approach as it's server-initiated
    const userNotificationChannel = supabase.channel(`user-notifications-${request.userId}`);
    userNotificationChannel.send({
      type: "broadcast",
      event: "whitelist-status-update",
      payload: {
        requestId: request.requestId,
        audioId: request.audioId,
        name: request.name,
        status: request.status,
        userId: request.userId,
        updatedAt: request.updatedAt
      }
    });

    console.log(`📢 Whitelist request ${requestId} ${status.toLowerCase()} - notifications sent`);

    return json({
      success: true,
      data: {
        requestId: request.requestId,
        audioId: request.audioId,
        name: request.name,
        status: request.status,
        updatedAt: request.updatedAt,
        reason: reason || null
      }
    });
    
  } catch (error) {
    console.error('Whitelist status update error:', error);
    
    if (error instanceof z.ZodError) {
      return json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};

// GET endpoint to retrieve pending requests (for admin interface)
export const GET: RequestHandler = async (event) => {
  try {
    // Require authentication (this would typically check for admin privileges)
    await requireAuth(event);
    
    // Get query parameters
    const url = new URL(event.request.url);
    const status = url.searchParams.get('status') || 'PENDING';
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20')));
    const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'));

    // Get requests with the specified status
    const requests = await db
      .select({
        requestId: whitelistRequests.requestId,
        audioId: whitelistRequests.audioId,
        name: whitelistRequests.name,
        category: whitelistRequests.category,
        status: whitelistRequests.status,
        audioVisibility: whitelistRequests.audioVisibility,
        createdAt: whitelistRequests.createdAt,
        updatedAt: whitelistRequests.updatedAt,
        requester: whitelistRequests.requester,
        userId: whitelistRequests.userId,
        audioUrl: whitelistRequests.audioUrl
      })
      .from(whitelistRequests)
      .where(eq(whitelistRequests.status, status as any))
      .limit(limit)
      .offset(offset)
      .orderBy(whitelistRequests.createdAt);

    return json({
      success: true,
      data: requests,
      metadata: {
        status,
        limit,
        offset,
        count: requests.length
      }
    });

  } catch (error) {
    console.error('Error fetching whitelist requests:', error);
    
    if (error instanceof Error && error.message === 'Authentication required') {
      return json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
};