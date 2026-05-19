import { createClient } from "@supabase/supabase-js";
import { getValidatedSupabaseEnv } from "@/lib/supabase/env";

const { supabaseUrl, serviceRoleKey } = getValidatedSupabaseEnv();

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
