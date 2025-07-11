import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db/index';
import { robloxOAuth } from '$lib/server/oauth';
import { users, sessions, oauthTokens, whitelistRequests } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createHmac } from 'crypto';
import { env } from '$env/dynamic/private';

interface RobloxErasureWebhookPayload {
	NotificationId: string;
	EventType: 'RightToErasureRequest';
	EventTime: string;
	EventPayload: {
		UserId: number;
		GameIds: number[];
	};
}

/**
 * Verify Roblox webhook signature
 */
function verifySignature(signature: string, timestamp: string, body: string, secret: string): boolean {
	try {
		// Parse the signature header
		const parts = signature.split(',');
		let extractedTimestamp = '';
		let extractedSignature = '';
		
		for (const part of parts) {
			const [key, value] = part.split('=');
			if (key === 't') {
				extractedTimestamp = value;
			} else if (key === 'v1') {
				extractedSignature = value;
			}
		}
		
		if (!extractedTimestamp || !extractedSignature) {
			console.error('Invalid signature format');
			return false;
		}
		
		// Check timestamp (prevent replay attacks - 10 minute window)
		const now = Math.floor(Date.now() / 1000);
		const webhookTimestamp = parseInt(extractedTimestamp);
		const timeDiff = Math.abs(now - webhookTimestamp);
		
		if (timeDiff > 600) { // 10 minutes
			console.error('Webhook timestamp too old:', timeDiff, 'seconds');
			return false;
		}
		
		// Create the base string: timestamp + "." + body
		const baseString = `${extractedTimestamp}.${body}`;
		
		// Compute HMAC SHA256
		const expectedSignature = createHmac('sha256', secret)
			.update(baseString)
			.digest('base64');
		
		// Compare signatures
		return extractedSignature === expectedSignature;
	} catch (error) {
		console.error('Error verifying signature:', error);
		return false;
	}
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get the signature header
		const signature = request.headers.get('roblox-signature');
		if (!signature) {
			console.error('Missing roblox-signature header');
			return json(
				{ error: 'Missing signature header' },
				{ status: 401 }
			);
		}

		// Get the raw body for signature verification
		const body = await request.text();
		
		// Verify the signature
		if (!verifySignature(signature, '', body, env.ERASURE_WEBHOOK_SECRET || '')) {
			console.error('Invalid webhook signature');
			return json(
				{ error: 'Invalid signature' },
				{ status: 401 }
			);
		}

		// Parse the webhook payload
		const payload: RobloxErasureWebhookPayload = JSON.parse(body);

		// Validate the payload structure
		if (!payload.NotificationId || payload.EventType !== 'RightToErasureRequest' || !payload.EventPayload?.UserId) {
			console.error('Invalid webhook payload structure:', payload);
			return json(
				{ error: 'Invalid payload structure' },
				{ status: 400 }
			);
		}

		const { NotificationId, EventTime, EventPayload } = payload;
		const { UserId: robloxUserId, GameIds } = EventPayload;

		console.log(`Processing right to erasure request for Roblox user ${robloxUserId}`, {
			notificationId: NotificationId,
			eventTime: EventTime,
			gameIds: GameIds
		});

		// Find the user in our database by Roblox user ID
		const userResult = await db
			.select()
			.from(users)
			.where(eq(users.robloxId, robloxUserId.toString()))
			.limit(1);

		if (userResult.length === 0) {
			console.log(`User with Roblox ID ${robloxUserId} not found in database`);
			// Still return success - the user doesn't exist in our system
			return json({
				success: true,
				message: 'User not found in system',
				notificationId: NotificationId
			});
		}

		const user = userResult[0];

		// Get user's OAuth tokens
		const userTokens = await db
			.select()
			.from(oauthTokens)
			.where(eq(oauthTokens.userId, user.id));

		console.log(`Found user ${user.id} (${user.username}) for erasure`);

		// Revoke all OAuth tokens with Roblox before deletion
		for (const token of userTokens) {
			if (token.refreshToken) {
				try {
					await robloxOAuth.revokeRefreshToken(token.refreshToken);
					console.log(`Revoked refresh token for user ${user.id}`);
				} catch (error) {
					console.error(`Failed to revoke token for user ${user.id}:`, error);
					// Continue with deletion even if token revocation fails
				}
			}
		}

		// Delete all user data in a transaction
		await db.transaction(async (tx) => {
			// Delete OAuth tokens
			await tx.delete(oauthTokens)
				.where(eq(oauthTokens.userId, user.id));

			// Delete sessions
			await tx.delete(sessions)
				.where(eq(sessions.userId, user.id));

			// Delete whitelist requests
			await tx.delete(whitelistRequests)
				.where(eq(whitelistRequests.userId, user.id));

			// Delete the user record
			await tx.delete(users)
				.where(eq(users.id, user.id));
		});

		console.log(`Successfully deleted all data for user ${user.id} (Roblox ID: ${robloxUserId})`);

		// Log the erasure request for compliance
		console.log('Right to erasure completed:', {
			notificationId: NotificationId,
			robloxUserId,
			userId: user.id,
			username: user.username,
			eventTime: EventTime,
			processedAt: new Date().toISOString()
		});

		return json({
			success: true,
			message: 'User data successfully erased',
			notificationId: NotificationId
		});

	} catch (error) {
		console.error('Error processing right to erasure webhook:', error);
		
		return json(
			{ 
				error: 'Internal server error processing erasure request',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

// Handle other HTTP methods
export const GET: RequestHandler = async () => {
	return json(
		{ error: 'Method not allowed. This endpoint only accepts POST requests.' },
		{ status: 405 }
	);
};

export const PUT: RequestHandler = async () => {
	return json(
		{ error: 'Method not allowed. This endpoint only accepts POST requests.' },
		{ status: 405 }
	);
};

export const DELETE: RequestHandler = async () => {
	return json(
		{ error: 'Method not allowed. This endpoint only accepts POST requests.' },
		{ status: 405 }
	);
};