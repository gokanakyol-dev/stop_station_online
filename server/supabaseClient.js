// Supabase bağlantısı için temel client
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// .env veya Render ortam değişkenlerinden alınacak
const SUPABASE_URL = process.env.SUPABASE_URL;
// Farklı isimlerle set edilmiş olabilir; hepsini destekle
const SUPABASE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.SUPABASE_SERVICE_KEY ||
	process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
	const missing = [
		!SUPABASE_URL ? 'SUPABASE_URL' : null,
		!SUPABASE_KEY
			? 'SUPABASE_SERVICE_ROLE_KEY (veya SUPABASE_SERVICE_KEY / SUPABASE_ANON_KEY)'
			: null,
	].filter(Boolean);
	throw new Error(`Supabase env eksik: ${missing.join(', ')}`);
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
	auth: { persistSession: false },
});