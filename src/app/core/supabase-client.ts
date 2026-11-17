import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// Create the single instance
export const supabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabaseAnonKey,
  { auth: { persistSession: true, autoRefreshToken: true } }
);

// Create an Injection Token so Angular can share it
export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');