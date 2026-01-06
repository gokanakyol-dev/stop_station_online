import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY =
	process.env.SUPABASE_SERVICE_ROLE_KEY ||
	process.env.SUPABASE_SERVICE_KEY ||
	process.env.SUPABASE_ANON_KEY;

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_KEY exists:', !!SUPABASE_KEY);

if (!SUPABASE_URL || !SUPABASE_KEY) {
	console.error('❌ Supabase env değişkenleri eksik!');
	process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
	auth: { persistSession: false },
});

console.log('✅ Supabase client oluşturuldu');

// Basit bir sorgu test et
const testConnection = async () => {
	try {
		console.log('Routes tablosundan veri çekiliyor...');
		const { data, error } = await supabase.from('routes').select('id').limit(1);
		
		if (error) {
			console.error('❌ Supabase sorgu hatası:', error);
			process.exit(1);
		}
		
		console.log('✅ Supabase bağlantısı başarılı!');
		console.log('Veri:', data);
		process.exit(0);
	} catch (err) {
		console.error('❌ Beklenmeyen hata:', err);
		process.exit(1);
	}
};

testConnection();
