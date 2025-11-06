import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/auth.js';
import { db } from '$lib/server/db/index.js';
import { whitelistRequests, audios, user_permissions, permissions } from '$lib/server/db/schema.js';
import WhitelistRequestSchema from './schema.js';
import { z } from 'zod';
import { FetchError, ofetch } from 'ofetch';
import { env } from '$env/dynamic/private';
import { randomBytes } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { publishToChannel } from '$lib/server/redis';
import { checkUserPermissions } from '$lib/server/permissions';

const messages = {
    'PENDING': 'There is already a pending request for this audio ID',
    'APPROVED': 'This audio ID is already whitelisted for Blockate.',
    //'REJECTED': 'The request for this audio ID has been rejected.'
};

export const POST: RequestHandler = async (event) => {
    try {
        // Require authentication
        const user = await requireAuth(event);

        // Parse and validate request body
        const body = await event.request.json();
        const { audioId, audioName, audioCategory, isPrivate, skipModeration, tags } = WhitelistRequestSchema.parse(body);

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
            switch (foundAudio.audioLifecycle) {
                case 'ACTIVE':
                    return json({ message: 'This audio ID is already whitelisted for Blockate.' }, { status: 400 });
                case 'MODERATED':
                    return json({ message: 'This audio ID has been removed by Roblox moderation.' }, { status: 400 });
            }
        }

        if (existingRequest && messages[existingRequest.status as keyof typeof messages]) {
            return json(
                { message: messages[existingRequest.status as keyof typeof messages] },
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
        } catch (err) {
            if (!(err instanceof FetchError)) return json({ message: 'An unexpected error occurred. Please try again later.' }, { status: 500 });

            if (err.response?.status === 404) {
                return json({ message: "The provided audio ID does not exist." }, { status: 404 });
            }

            return json({ message: 'Failed to fetch audio metadata. Please try again later.' }, { status: 500 });
        }

        if (audioMetadata.assetType !== "Audio") {
            return json({ message: "The provided ID is not an audio asset." }, { status: 400 });
        }

        const moderationState = audioMetadata.moderationResult.moderationState; // "Approved", "Rejected", "Reviewing"
        switch (moderationState) {
            case "Rejected":
                return json({ message: "The provided audio ID has been rejected by Roblox moderation." }, { status: 400 });
            case "Reviewing":
                return json({ message: "The provided audio ID is currently under review by Roblox moderation. Please try again later." }, { status: 400 });
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
            return json({ message: 'Failed to check if audio is accessible, please try again later.' }, { status: 500 });
        }

        if (!audioUrlsResponse.ok) {
            return json({ message: 'Failed to check if audio is accessible, please try again later.' }, { status: 500 });
        }

        if (audioUrlsResponse._data[0]?.code === 403) {
            return json({ message: 'BMusicUploader does not have "Use" permissions for this audio. Please grant them the "Use" permission in the audio\'s permissions page.' }, { status: 400 });
        }


        // Generate a unique request ID
        const requestId = randomBytes(16).toString('hex');
        const now = new Date().toISOString();

        if (skipModeration) {
            const permissionCheckResult = await checkUserPermissions(user.id, ['whitelistRequest.skipModeration']);
            if (!permissionCheckResult) return json({ message: 'You do not have permission to skip moderation.' }, { status: 403 });

            const whitelistRequest = await db.insert(whitelistRequests).values({
                requestId,
                audioId: audioId.toString(),
                name: audioName,
                category: audioCategory,
                tags: tags || [],
                userId: user.id,
                audioVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
                status: 'APPROVED',
                createdAt: now,
                updatedAt: now,
                requester: {
                    discord: { id: null, username: null },
                    roblox: { id: user.robloxId, username: user.username }
                },
                audioUrl: audioUrlsResponse._data[0] || '',
                acknowledged: true
            }).returning();

            publishToChannel('autoAcceptWhitelistRequests', {
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
            }, { status: 201 });
        }

        // Create new whitelist request
        const whitelistRequest = await db.insert(whitelistRequests).values({
            requestId,
            audioId: audioId.toString(),
            name: audioName,
            category: audioCategory,
            tags: tags || [],
            userId: user.id,
            audioVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
            status: 'PENDING',
            createdAt: now,
            updatedAt: now,
            requester: {
                discord: { id: null, username: null },
                roblox: { id: user.robloxId, username: user.username }
            },
            audioUrl: audioUrlsResponse._data[0] || '',
            acknowledged: false
        }).returning();

        // const whitelistRequest = [
        //     {
        //         requestId,
        //         audioId: audioId.toString(),
        //         name: audioName,
        //         category: audioCategory,
        //         tags: tags || [],
        //         userId: user.id,
        //         audioVisibility: isPrivate ? 'PRIVATE' : 'PUBLIC',
        //         status: 'PENDING',
        //         createdAt: new Date().toISOString(),
        //         updatedAt: new Date().toISOString(),
        //         requester: {
        //             discord: { id: null, username: null },
        //             roblox: { id: user.robloxId, username: user.username }
        //         },
        //         audioUrl: '',
        //         acknowledged: false
        //     }
        // ];

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
        }, { status: 201 });

    } catch (error) {
        console.error('Whitelist request error:', error);

        if (error instanceof z.ZodError) {
            return json(
                { message: 'Invalid request data', details: error.issues },
                { status: 400 }
            );
        }

        if (error instanceof Error && error.message === 'Authentication required') {
            return json(
                { message: 'Authentication required' },
                { status: 401 }
            );
        }

        return json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
};