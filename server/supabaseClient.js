// Supabase bağlantısı için temel client
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// .env veya Render ortam değişkenlerinden alınacak
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);