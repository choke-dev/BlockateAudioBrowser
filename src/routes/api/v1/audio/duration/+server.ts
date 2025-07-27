import type { RequestHandler } from './$types';
import { z } from 'zod';

// Validation schema
const DurationRequestSchema = z.object({
  ids: z.array(z.string()).min(1).max(50) // Limit to 50 IDs per request
});

// Roblox API types
interface RobloxAudioDetails {
  data: Array<{
    asset: {
      id: number;
      name: string;
      duration: number;
      audioDetails: {
        audioType: string;
        artist: string;
        title: string;
        musicAlbum: string;
        musicGenre: string;
        tags: string[];
      };
    };
    creator: {
      id: number;
      name: string;
      type: number;
      isVerifiedCreator: boolean;
    };
  }>;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedBody = DurationRequestSchema.parse(body);
    
    const { ids } = validatedBody;
    
    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ durations: {} }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Make request to Roblox API
    const idsParam = ids.join(',');
    const robloxResponse = await fetch(
      `https://apis.roblox.com/toolbox-service/v1/items/details?assetIds=${idsParam}`,
      {
        headers: {
          'User-Agent': 'BlockateAudioBrowser/1.0',
          'Accept': 'application/json'
        }
      }
    );
    
    if (!robloxResponse.ok) {
      console.warn(`Roblox API returned ${robloxResponse.status}: ${robloxResponse.statusText}`);
      return new Response(
        JSON.stringify({ 
          durations: {},
          error: 'Failed to fetch from Roblox API'
        }),
        { 
          status: 200, // Return 200 but with empty durations
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    const robloxData: RobloxAudioDetails = await robloxResponse.json();
    
    // Build duration map
    const durations: Record<string, number> = {};
    robloxData.data.forEach(item => {
      durations[item.asset.id.toString()] = item.asset.duration;
    });
    
    return new Response(
      JSON.stringify({ durations }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
    
  } catch (error) {
    console.error('Duration API Error:', error);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid request format',
          details: error.issues 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Generic error response
    return new Response(
      JSON.stringify({ 
        durations: {},
        error: 'Internal server error' 
      }),
      { 
        status: 200, // Return 200 but with empty durations to not break the UI
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};