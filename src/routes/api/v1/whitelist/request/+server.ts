import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { whitelistRequests, audios } from '$lib/server/db/schema.js';
import WhitelistRequestSchema from './schema.js';
import { z } from 'zod';
import { FetchError, ofetch } from 'ofetch';
import { env } from '$env/dynamic/private';
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { publishToChannel } from '$lib/server/redis';

export const POST: RequestHandler = async (event) => {
    try {
        // Require authentication
        const user = await requireAuth(event);
        
        // Parse and validate request body
        const body = await event.request.json();
        const { audioId, audioName, audioCategory, isPrivate, tags } = WhitelistRequestSchema.parse(body);
        
        const [existingRequest, foundAudio] = await Promise.all([
            db.query.whitelistRequests.findFirst({
                where: and(
                    eq(whitelistRequests.audioId, String(audioId)),
                    eq(whitelistRequests.userId, user.id)
                )
            }),
            db.query.audios.findFirst({
                where: eq(audios.id, BigInt(audioId)),
                columns: { id: true, audioLifecycle: true }
            })
        ]);

        if (foundAudio) {
            switch(foundAudio.audioLifecycle) {
                case 'ACTIVE':
                    return json({ error: 'This audio ID is already whitelisted for Blockate.' }, { status: 400 });
                case 'MODERATED':
                    return json({ error: 'This audio ID has been removed by Roblox moderation.' }, { status: 400 });
            }
        }

        if (existingRequest) {
            const messages = {
                'PENDING': 'There is already a pending request for this audio ID',
                'APPROVED': 'This audio ID is already whitelisted for Blockate.',
                'REJECTED': 'The request for this audio ID has been rejected.'
            };
            return json(
                { error: messages[existingRequest.status] },
                { status: 400 }
            );
        }

        // Validation Checks
        // Check if audio ID is valid
        let audioMetadata;
        try {
            audioMetadata = await ofetch(`https://apis.roblox.com/assets/user-auth/v1/assets/${audioId}?readMask=assetId,assetType,creationContext,description,displayName,moderationResult,icon,previews,revisionCreateTime,State`, {
                headers: {
                    Cookie: `.ROBLOSECURITY=${env.ROBLOX_ACCOUNT_COOKIE}`
                }
            })
        } catch(err) {
            if (!(err instanceof FetchError)) return json({ error: 'An unexpected error occurred. Please try again later.' }, { status: 500 });

            if (err.response?.status === 404) {
                return json({ error: "The provided audio ID does not exist." }, { status: 404 });
            }
            
            return json({ error: 'Failed to fetch audio metadata. Please try again later.' }, { status: 500 });
        }

        if (audioMetadata.assetType !== "Audio") {
            return json({ error: "The provided ID is not an audio asset." }, { status: 400 });
        }

        const moderationState = audioMetadata.moderationResult.moderationState; // "Approved", "Rejected", "Reviewing"
        switch(moderationState) {
            case "Rejected":
                return json({ error: "The provided audio ID has been rejected by Roblox moderation." }, { status: 400 });
            case "Reviewing":
                return json({ error: "The provided audio ID is currently under review by Roblox moderation. Please try again later." }, { status: 400 });
        }

        // Check if audio ID is accessible
        let audioUrlsResponse;
        try {
            audioUrlsResponse = await ofetch.raw('http://109.106.244.58:3789/audio/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: env.AUDIO_FILE_PROXY_AUTH
                },
                body: [Number(audioId)]
            });
        } catch (err) {
            return json({ error: 'Failed to check if audio is accessible, please try again later.' }, { status: 500 });
        }
        
        if (!audioUrlsResponse.ok) {
            return json({ error: 'Failed to check if audio is accessible, please try again later.' }, { status: 500 });
        }

        if (audioUrlsResponse._data[0]?.code === 403) {
            return json({ error: 'BMusicUploader does not have "Use" permissions for this audio. Please grant them the "Use" permission in the audio\'s permissions page.' }, { status: 400 });
        }
        
        // Generate a unique request ID
        const requestId = randomBytes(16).toString('hex');
        const now = new Date().toISOString();
        
        // Create new whitelist request
        // const whitelistRequest = await db.insert(whitelistRequests).values({
        //     requestId,
        //     audioId: audioId.toString(),
        //     name: audioName,
        //     category: audioCategory,
        //     tags: tags || [],
        //     userId: user.id,
        //     audioVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
        //     status: 'PENDING',
        //     createdAt: now,
        //     updatedAt: now,
        //     requester: {
        //         discord: { id: null, username: null },
        //         roblox: { id: user.robloxId, username: user.username }
        //     },
        //     audioUrl: audioUrlsResponse._data[0] || '',
        //     acknowledged: false
        // }).returning();

        const whitelistRequest = [
            {
                requestId,
                audioId: audioId.toString(),
                name: audioName,
                category: audioCategory,
                tags: tags || [],
                userId: user.id,
                audioVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
                status: 'PENDING',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                requester: {
                    discord: { id: null, username: null },
                    roblox: { id: user.robloxId, username: user.username }
                },
                audioUrl: '',
                acknowledged: false
            }
        ];

        // Send real-time notification via Redis pub/sub
        publishToChannel('audioRequests', {
            ...whitelistRequest[0],
            audioUrl: audioUrlsResponse._data[0] || ''
        })
        .catch((err) => {
            console.error('Failed to publish to Redis channel:', err);
        });

        return json({
            id: whitelistRequest[0].requestId,
            audioId: whitelistRequest[0].audioId,
            name: whitelistRequest[0].name,
            category: whitelistRequest[0].category,
            userId: whitelistRequest[0].userId,
            status: whitelistRequest[0].status,
            createdAt: whitelistRequest[0].createdAt,
            updatedAt: whitelistRequest[0].updatedAt
        });
        
    } catch (error) {
        console.error('Whitelist request error:', error);
        
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