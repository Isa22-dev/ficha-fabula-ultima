const SUPABASE_URL = "https://wqhypwznwgqllajmfdhe.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_De1UXdU4zBZ7CObKahpFDg_u-sxSnMJ";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

window.supabaseClient = supabaseClient;
