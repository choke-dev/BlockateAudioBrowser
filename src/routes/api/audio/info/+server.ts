import { db } from '$lib/server/db/index';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const IDs = url.searchParams.get('id');
  if (!IDs) {
    return new Response(JSON.stringify({ errors: [{ message: 'Missing "id" query parameter' }] }), { status: 400 });
  }

  const audioIds = IDs.split(',').map(s => BigInt(s));
  const uniqueIds = Array.from(new Set(audioIds));

  const audiosFromDB = await db.query.audios.findMany({
    columns: { id: true, name: true, category: true, created_at: true },
    where: (t, { inArray }) => inArray(t.id, uniqueIds),
  });

  const audioMap = new Map(audiosFromDB.map(a => [a.id, a]));

  const ordered = audioIds.map(id => {
    const row = audioMap.get(id);
    return row
      ? { ...row, id: row.id.toString() }
      : null;
  });

  if (ordered.every(a => a === null)) {
    return new Response(JSON.stringify({ errors: [{ message: 'Audio not found' }] }), { status: 404 });
  }

  return new Response(JSON.stringify(ordered), { status: 200 });
};
