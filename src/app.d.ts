import 'unplugin-icons/types/svelte';
import { users } from '$lib/server/db/schema';
import type { InferSelectModel } from 'drizzle-orm';

interface User {
  id: string;
  robloxId: string;
  username: string;
  avatar: string | null;
  createdAt: string;
  permissions: string[];
}

// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Handle } from '@sveltejs/kit';
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
