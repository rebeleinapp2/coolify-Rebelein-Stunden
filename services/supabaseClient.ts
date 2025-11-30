import { createClient } from '@supabase/supabase-js';

// Self-Hosted Supabase Konfiguration (gemäß Benutzer-Input)
const supabaseUrl = 'https://supabaserebeleinstunden.rebeleinapp.de';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc2NDQ5NTMwMCwiZXhwIjo0OTIwMTY4OTAwLCJyb2xlIjoiYW5vbiJ9.vUGCwZcWsvI0PbjYIYBco7gamkA1PaDS7kFwkIufkwE';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const isSupabaseConfigured = true;