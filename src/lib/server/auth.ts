import type { RequestEvent } from '@sveltejs/kit';
import { getSessionWithUser } from './session.js';

export async function requireAuth(event: RequestEvent) {
  const sessionData = await getSessionWithUser(event.cookies);
  
  if (!sessionData?.user) {
    throw new Error('Authentication required');
  }
  
  return sessionData.user;
}