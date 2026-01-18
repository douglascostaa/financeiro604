
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Export a function to create a client (useful for server components if needed, though simple auth here)
export const createClient = () => createSupabaseClient(supabaseUrl, supabaseKey);

// Export a singleton for client-side usage
export const supabase = createClient();
