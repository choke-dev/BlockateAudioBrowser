import { writable } from 'svelte/store';

export const playingTrackId = writable<string | null>(null);