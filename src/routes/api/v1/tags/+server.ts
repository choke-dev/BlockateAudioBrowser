import { db } from '$lib/server/db/index';
import { audios } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';

// Schema for updating audio tags
const UpdateAudioTagsSchema = z.object({
	audioId: z.string(),
	tags: z.array(z.string().min(1).max(50).trim())
});

// GET - Get popular tags from existing audios
export const GET = async (event: RequestEvent) => {
	try {
		const query = event.url.searchParams.get('q') || '';
		const limit = Math.min(parseInt(event.url.searchParams.get('limit') || '20'), 50);

		// Get all unique tags from the database
		const results = await db.execute(sql`
			SELECT tag, COUNT(*) as usage_count
			FROM (
				SELECT jsonb_array_elements_text(tags) as tag
				FROM ${audios}
				WHERE audio_visibility = 'PUBLIC' 
				AND audio_lifecycle = 'ACTIVE'
				AND jsonb_array_length(tags) > 0
			) tags_expanded
			WHERE tag ILIKE ${'%' + query + '%'}
			GROUP BY tag
			ORDER BY usage_count DESC, tag ASC
			LIMIT ${limit}
		`);

		return new Response(JSON.stringify(results), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('Error fetching tags:', error);
		return new Response(
			JSON.stringify({ error: 'Failed to fetch tags' }),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};