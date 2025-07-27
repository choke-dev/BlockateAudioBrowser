import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getSessionWithUser } from '$lib/server/session.js';
import { db } from '$lib/server/db/index.js';
import { whitelistRequests } from '$lib/server/db/schema.js';
import { eq, desc, count } from 'drizzle-orm';

export const GET: RequestHandler = async ({ cookies, url }) => {
  try {
    // Check authentication
    const sessionData = await getSessionWithUser(cookies);
    if (!sessionData?.user) {
      return json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { user } = sessionData;

    // Parse pagination parameters
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') || '10')));
    const offset = (page - 1) * limit;

    // Get total count of requests for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(whitelistRequests)
      .where(eq(whitelistRequests.userId, user.id));

    const totalCount = totalCountResult[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated whitelist requests for the user
    const userRequests = await db
      .select({
        id: whitelistRequests.requestId,
        audioId: whitelistRequests.audioId,
        audioName: whitelistRequests.name,
        audioCategory: whitelistRequests.category,
        tags: whitelistRequests.tags,
        isPrivate: whitelistRequests.audioVisibility,
        status: whitelistRequests.status,
        createdAt: whitelistRequests.createdAt,
        updatedAt: whitelistRequests.updatedAt,
        acknowledged: whitelistRequests.acknowledged,
        rejectionReason: whitelistRequests.rejectionReason
      })
      .from(whitelistRequests)
      .where(eq(whitelistRequests.userId, user.id))
      .orderBy(desc(whitelistRequests.createdAt))
      .limit(limit)
      .offset(offset);

    // Transform the data to match the expected format
    const transformedRequests = userRequests.map(request => ({
      id: request.id,
      audioId: request.audioId,
      audioName: request.audioName,
      audioCategory: request.audioCategory,
      tags: request.tags || [],
      isPrivate: request.isPrivate === 'PRIVATE',
      status: request.status.toLowerCase(),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      acknowledged: request.acknowledged,
      rejectionReason: request.rejectionReason
    }));

    return json({
      success: true,
      data: transformedRequests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    });

  } catch (error) {
    console.error('Error fetching whitelist requests:', error);
    return json({ 
      success: false, 
      message: 'Internal server error' 
    }, { status: 500 });
  }
};