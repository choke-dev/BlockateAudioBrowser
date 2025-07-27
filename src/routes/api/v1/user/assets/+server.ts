import { json } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth.js';
import { robloxOAuth } from '$lib/server/oauth.js';
import { ofetch } from 'ofetch';
import type { RequestHandler } from '@sveltejs/kit';
import { ROBLOX_ACCOUNT_COOKIE } from '$env/static/private';
import { dev } from '$app/environment';
import { z } from 'zod';

interface InventoryItem {
    path: string;
    assetDetails?: {
        assetId: string;
        inventoryItemAssetType: string;
        instanceId: string;
        collectibleDetails?: {
            itemId: string;
            instanceId: string;
            instanceState: string;
            serialNumber: number;
        };
    };
    addTime: string;
}

interface InventoryResponse {
    inventoryItems: InventoryItem[];
    nextPageToken?: string;
}

// Zod schemas for validation
const CreatorSchema = z.object({
    type: z.string(),
    typeId: z.number(),
    targetId: z.number()
});

const AssetDetailSchema = z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    created: z.string(),
    creator: CreatorSchema,
    isModerated: z.boolean().optional().default(false)
});

const BatchAssetResponseSchema = z.object({
    data: z.array(AssetDetailSchema).optional().default([])
});

const InventoryResponseSchema = z.object({
    inventoryItems: z.array(z.any()),
    nextPageToken: z.string().optional()
});

// TypeScript types derived from Zod schemas
type AssetDetail = z.infer<typeof AssetDetailSchema>;
type BatchAssetResponse = z.infer<typeof BatchAssetResponseSchema>;

interface ParsedAsset {
    id: string;
    name: string;
    created: Date;
}

// Configuration constants
const CONFIG = {
    MAX_PAGE_SIZE: 100,
    CHUNK_SIZE: 50,
    MAX_TOTAL_ITEMS: 5000, // Prevent memory issues in serverless
    REQUEST_TIMEOUT: 25000, // 25 seconds (serverless timeout consideration)
    MAX_RETRIES: 2, // Reduced for serverless efficiency
    RETRY_DELAY: 500, // Shorter delay for serverless
} as const;

// Utility functions
function isValidString(value: unknown): value is string {
    return typeof value === 'string' && value.length > 0;
}

function isValidNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
}

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = CONFIG.MAX_RETRIES,
    delay: number = CONFIG.RETRY_DELAY
): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            
            if (attempt === maxRetries) {
                throw lastError;
            }
            
            // Exponential backoff
            const waitTime = delay * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    
    throw lastError!;
}

// Zod-based validation functions
function validateInventoryResponse(response: unknown) {
    try {
        return InventoryResponseSchema.parse(response);
    } catch (error) {
        throw new Error('Invalid inventory response format');
    }
}

function validateBatchAssetResponse(response: unknown): BatchAssetResponse {
    try {
        return BatchAssetResponseSchema.parse(response);
    } catch (error) {
        return { data: [] };
    }
}

function extractAssetId(item: InventoryItem): string | null {
    const assetId = item.assetDetails?.assetId;
    return isValidString(assetId) ? assetId : null;
}

function validateAssetDetail(asset: unknown): AssetDetail | null {
    try {
        const validatedAsset = AssetDetailSchema.parse(asset);
        
        // Filter out moderated assets
        if (validatedAsset.isModerated) {
            return null;
        }
        
        return validatedAsset;
    } catch (error) {
        return null;
    }
}

export const GET: RequestHandler = async (event) => {
    try {
        // Require authentication with proper error handling
        const user = await requireAuth(event);
        
        if (!user?.id || !user?.robloxId) {
            return json({
                success: false,
                error: 'Invalid user authentication data',
                requiresAuth: true
            }, { status: 401 });
        }

        // Get stored tokens for the user with validation
        const tokens = await robloxOAuth.getStoredTokens(user.id);

        if (!tokens) {
            return json({
                success: false,
                error: 'No OAuth tokens found',
                requiresReauth: true
            }, { status: 401 });
        }

        // Check if user has user.inventory-item:read scope
        const hasInventoryReadScope = Array.isArray(tokens.scope)
            ? tokens.scope.includes('user.inventory-item:read')
            : typeof tokens.scope === 'string'
                ? tokens.scope.includes('user.inventory-item:read')
                : false;

        if (!hasInventoryReadScope) {
            return json({
                success: false,
                error: 'Missing user.inventory-item:read scope',
                requiresInventoryReadScope: true,
                currentScope: tokens.scope
            }, { status: 403 });
        }

        // Get a valid access token with retry mechanism
        const accessToken = await retryWithBackoff(async () => {
            const token = await robloxOAuth.getValidAccessToken(user.id);
            if (!token) {
                throw new Error('Failed to obtain valid access token');
            }
            return token;
        });

        // Validate Roblox user ID
        if (!isValidString(user.robloxId)) {
            return json({
                success: false,
                error: 'Invalid Roblox user ID',
                requiresAuth: true
            }, { status: 400 });
        }

        try {
            // 1. Fetch inventory items
            const userInventoryItems: InventoryItem[] = [];
            let nextPageToken: string | undefined = undefined;
            let totalFetched = 0;

            // Build the base API URL with proper encoding
            const encodedRobloxId = encodeURIComponent(user.robloxId);
            const apiUrl = `https://apis.roblox.com/cloud/v2/users/${encodedRobloxId}/inventory-items`;

            do {
                if (totalFetched >= CONFIG.MAX_TOTAL_ITEMS) {
                    break;
                }

                const params = new URLSearchParams({
                    maxPageSize: String(CONFIG.MAX_PAGE_SIZE),
                    filter: 'inventoryItemAssetTypes=AUDIO'
                });

                if (nextPageToken) {
                    params.set('pageToken', nextPageToken);
                }

                // Fetch current page
                const response = await retryWithBackoff(async () => {
                    const result = await ofetch(`${apiUrl}?${params.toString()}`, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,                        },
                        timeout: CONFIG.REQUEST_TIMEOUT
                    });
                    
                    return validateInventoryResponse(result);
                });

                // Validate and add items from this page
                if (response.inventoryItems && Array.isArray(response.inventoryItems)) {
                    const validItems = response.inventoryItems.filter(item =>
                        item && typeof item === 'object' && extractAssetId(item) !== null
                    );
                    
                    userInventoryItems.push(...validItems);
                    totalFetched += validItems.length;
                    
                }

                // Update nextPageToken for next iteration
                nextPageToken = response.nextPageToken;

            } while (nextPageToken && totalFetched < CONFIG.MAX_TOTAL_ITEMS);

            // 2. Extract and validate asset IDs
            const userAssetIds = userInventoryItems
                .map(extractAssetId)
                .filter((id): id is string => id !== null);

            // If no assets found, return empty result
            if (userAssetIds.length === 0) {
                return json([], { status: 200 });
            }


            // 3. Batch fetch asset details
            const assetDetails: Record<string, AssetDetail> = {};
            
            try {
                // Process asset IDs in chunks
                for (let i = 0; i < userAssetIds.length; i += CONFIG.CHUNK_SIZE) {
                    const chunk = userAssetIds.slice(i, i + CONFIG.CHUNK_SIZE);
                    
                    try {
                        const batchResponse = await retryWithBackoff(async () => {
                            if (!ROBLOX_ACCOUNT_COOKIE) {
                                throw new Error('Missing Roblox account cookie configuration');
                            }
                            
                            const result = await ofetch(`https://develop.roblox.com/v1/assets?assetIds=${chunk.join(',')}`, {
                                headers: {
                                    'Cookie': `.ROBLOSECURITY=${ROBLOX_ACCOUNT_COOKIE}`                                },
                                timeout: CONFIG.REQUEST_TIMEOUT
                            });
                            
                            return validateBatchAssetResponse(result);
                        });

                        // Process and validate each asset
                        if (batchResponse.data && Array.isArray(batchResponse.data)) {
                            for (const rawAsset of batchResponse.data) {
                                const asset = validateAssetDetail(rawAsset);
                                if (!asset) {
                                    continue;
                                }

                                if (asset.isModerated) {
                                    continue;
                                }
                                
                                // Verify ownership - compare as strings to handle type inconsistencies
                                const assetCreatorId = String(asset.creator.targetId);
                                const userRobloxId = String(user.robloxId);
                                
                                if (assetCreatorId === userRobloxId) {
                                    // Convert asset ID to string for consistent indexing
                                    const assetIdKey = String(asset.id);
                                    assetDetails[assetIdKey] = asset;
                                }
                            }
                        }
                    } catch (chunkError) {
                        // Continue with other chunks
                    }
                }
            } catch (batchError) {
                // Continue with whatever assets we have
            }

            // 4. Parse and validate final results
            const parsedAssets: ParsedAsset[] = [];
            
            for (const item of userInventoryItems) {
                const assetId = extractAssetId(item);
                if (!assetId || !(assetId in assetDetails)) {
                    continue;
                }
                
                const detail = assetDetails[assetId];
                
                try {
                    const createdDate = new Date(detail.created);
                    if (isNaN(createdDate.getTime())) {
                        continue;
                    }
                    
                    parsedAssets.push({
                        id: String(detail.id), // Ensure consistent string format
                        name: detail.name || 'Unknown Asset',
                        created: createdDate
                    });
                } catch (parseError) {
                }
            }

            return json(parsedAssets, { status: 200 });

        } catch (apiError) {

            // Enhanced error classification
            const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
            const errorLower = errorMessage.toLowerCase();

            if (errorLower.includes('403') || errorLower.includes('forbidden')) {
                return json({
                    success: false,
                    error: 'Insufficient permissions to access user inventory',
                    requiresInventoryReadScope: true
                }, { status: 403 });
            }

            if (errorLower.includes('401') || errorLower.includes('unauthorized')) {
                return json({
                    success: false,
                    error: 'Invalid or expired access token',
                    requiresReauth: true
                }, { status: 401 });
            }

            if (errorLower.includes('timeout') || errorLower.includes('network')) {
                return json({
                    success: false,
                    error: 'Network timeout or connectivity issue',
                    retryable: true
                }, { status: 503 });
            }

            if (errorLower.includes('rate limit') || errorLower.includes('429')) {
                return json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryable: true
                }, { status: 429 });
            }

            return json({
                success: false,
                error: 'Failed to fetch user assets',
                details: dev ? errorMessage : 'Internal server error'
            }, { status: 500 });
        }

    } catch (error) {

        const errorMessage = error instanceof Error ? error.message : String(error);

        if (errorMessage === 'Authentication required') {
            return json({
                success: false,
                error: 'Authentication required',
                requiresAuth: true
            }, { status: 401 });
        }

        return json({
            success: false,
            error: 'Internal server error',
            details: dev ? errorMessage : undefined
        }, { status: 500 });
    }
};