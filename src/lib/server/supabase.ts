import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/private';

if (!env.SUPABASE_URL) throw new Error('SUPABASE_URL is not set');
if (!env.SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_SERVICE_KEY is not set');

export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);