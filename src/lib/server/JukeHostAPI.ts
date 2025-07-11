import { ofetch } from "ofetch";
import { getAvailableCredentials } from "./credentialService";
import pLimit from "p-limit";

// Cache for storing the number of uploads per owner
const ownerUploadsCache = new Map<number, { count: number; timestamp: number }>();
// Cache expiration time (6 hours)
const CACHE_EXPIRATION = 1000 * 60 * 60 * 6;
// Maximum uploads per account
const MAX_UPLOADS_PER_ACCOUNT = 1000;

/**
 * Get the number of tracks for a specific owner
 * @param apiKey The JukeHost API key
 * @param ownerId The owner ID to check
 * @returns The number of tracks for the owner
 */
const getOwnerTrackCount = async (apiKey: string, ownerId: number): Promise<number> => {
    try {
        const response = await ofetch<{ name: string; tracks: { id: string; name: string; }[] }[]>(`https://jukehost.co.uk/api/jhc/${apiKey}`);
        // Filter tracks by owner ID and count them
        const tracks = response[0].tracks;
        return tracks.length;
    } catch (error) {
        console.error(`Failed to get track count for owner ${ownerId}:`, error);
        return 0;
    }
};

/**
 * Get an available owner ID that hasn't reached the upload limit
 * @returns An object containing the owner ID and API key, or null if no available owner
 */
const getAvailableOwner = async (): Promise<{ ownerId: number; apiKey: string } | null> => {
    const credentials = await getAvailableCredentials();
    
    if (!credentials || credentials.length === 0) {
        console.error("No credentials available");
        return null;
    }

    // Check each credential to find one that hasn't reached the limit
    for (const credential of credentials) {
        const { ownerId, apiKey } = credential;
        
        // Check if we have a cached count and if it's still valid
        const cacheKey = ownerId;
        const cachedData = ownerUploadsCache.get(cacheKey);
        const now = Date.now();
        
        let trackCount;
        if (cachedData && (now - cachedData.timestamp) < CACHE_EXPIRATION) {
            trackCount = cachedData.count;
        } else {
            // Get the current track count for this owner
            trackCount = await getOwnerTrackCount(apiKey, ownerId);
            // Update the cache
            ownerUploadsCache.set(cacheKey, { count: trackCount, timestamp: now });
        }
        
        // If this owner hasn't reached the limit, use it
        console.log(`Owner ${ownerId} has ${trackCount} tracks`);
        if (trackCount < MAX_UPLOADS_PER_ACCOUNT) {
            return { ownerId, apiKey };
        }
    }
    
    // If all owners have reached the limit, return null
    return null;
};

/**
 * Upload audio to JukeHost
 * @param file The audio file to upload
 * @param filename Optional filename
 * @returns True if upload was successful, false otherwise
 */
export const uploadAudio = async (file: Blob, filename?: string): Promise<boolean> => {
    // Get an available owner
    const owner = await getAvailableOwner();
    
    if (!owner) {
        console.error("No available owners found. All accounts have reached the upload limit.");
        return false;
    }
    
    const { ownerId } = owner;
    
    const formData = new FormData();
    formData.append("file", file, filename);
    formData.append("owner", ownerId.toString());

    console.log(`Uploading audio preview for ID: ${filename} using owner ${ownerId}`);
    const response = await fetch("https://audio.jukehost.co.uk/upload", {
        method: "POST",
        body: formData
    });
    
    if (response.ok) {
        console.log(`Uploaded audio preview for ID: ${filename} using owner ${ownerId}`);
        
        // Update the cache to increment the track count for this owner
        const cacheKey = ownerId;
        const cachedData = ownerUploadsCache.get(cacheKey);
        
        if (cachedData) {
            ownerUploadsCache.set(cacheKey, {
                count: cachedData.count + 1,
                timestamp: cachedData.timestamp
            });
        }
        
        return true;
    }
    
    console.log(`Failed to upload audio preview for ID: ${filename} using owner ${ownerId}`);
    console.log(await response.text());
    return false;
};

/**
 * Get all audios from JukeHost
 * @returns Array of audio objects with id and name
 */
export const getAudios = async (): Promise<{ id: string; name: string }[]> => {
    // Get all available credentials to fetch audios
    const credentials = await getAvailableCredentials();
    
    if (!credentials || credentials.length === 0) {
        console.error("No credentials available");  
        return [];
    }
    
    // Create an array of promises for each API request
    const fetchPromises = credentials.map(({ apiKey }) => {
        return ofetch(`https://jukehost.co.uk/api/jhc/${apiKey}`)
            .then(response => {
                if (response && response[0] && response[0].tracks) {
                    return response[0].tracks;
                }
                return [];
            })
            .catch(error => {
                console.error(`Failed to get audios for API key ${apiKey}:`, error);
                return []; // Return empty array on error to keep Promise.all working
            });
    });
    
    // Execute all promises concurrently
    const tracksArrays = await Promise.all(fetchPromises);
    
    // Flatten the array of arrays into a single array of tracks
    const allTracks = tracksArrays.flat();
    
    return allTracks;
};

/**
 * Check if an audio URL is still valid
 * @param url The audio URL to check
 * @returns True if the URL is valid, false otherwise
 */
export const isAudioUrlValid = async (url: string): Promise<boolean> => {
    try {
        const response = await fetch(url, {
            method: "HEAD"
        });
        return response.status === 200;
    } catch (error) {
        console.error(`Failed to check audio URL ${url}:`, error);
        return false;
    }
};

/**
 * Check multiple audio URLs with concurrency limit
 * @param urls Array of audio URLs to check
 * @param concurrency Maximum number of concurrent requests
 * @returns Object mapping URLs to their validity status
 */
export const checkAudioUrls = async (
    urls: string[],
    concurrency = 5
): Promise<Record<string, boolean>> => {
    const limit = pLimit(concurrency);
    const results: Record<string, boolean> = {};
    
    const promises = urls.map(url =>
        limit(async () => {
            const isValid = await isAudioUrlValid(url);
            results[url] = isValid;
            return { url, isValid };
        })
    );
    
    await Promise.all(promises);
    return results;
};