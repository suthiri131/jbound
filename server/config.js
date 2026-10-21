import 'dotenv/config';

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  console.warn(`[config] Missing env vars: ${missing.join(', ')} — DB/auth routes will fail until set.`);
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || 'development',
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    anonKey: process.env.SUPABASE_ANON_KEY || 'missing-anon-key',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing-service-key',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'jbound-images',
  },

  lta: {
    accountKey: process.env.LTA_ACCOUNT_KEY || '',
    trafficImagesUrl: 'https://datamall2.mytransport.sg/ltaodataservice/Traffic-Imagesv2',
  },

  google: {
    // Server-side key for the Places API (New). Keep it out of the client.
    placesKey: process.env.GOOGLE_PLACES_API_KEY || '',
    placesBaseUrl: 'https://places.googleapis.com/v1',
  },

  frankfurterBaseUrl: process.env.FRANKFURTER_BASE_URL || 'https://api.frankfurter.dev',
  ors: {
    apiKey: process.env.ORS_API_KEY || '',
    baseUrl: process.env.ORS_BASE_URL || 'https://api.heigit.org/openrouteservice',
  },
};
