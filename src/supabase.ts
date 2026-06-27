import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://zkqvqztadbzqwdwqhyjw.supabase.co'

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprcXZxenRhZGJ6cXdkd3FoeWp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI1MzYwNTUsImV4cCI6MjA5ODExMjA1NX0.qUEUX7Csd5mK4qPciGE-Zc_6TY_3888Faewkv99uFqU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
