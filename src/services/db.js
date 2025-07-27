import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Pastikan file .env berisi:
// SUPABASE_URL=https://xyzcompany.supabase.co
// SUPABASE_KEY=public-anon-key

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);