import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (.env takes priority, then .env.local)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

function optional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  // ── Aiven Cloud MySQL ────────────────────────────────────────────────────
  mysql: {
    host:     optional('MYSQL_HOST', 'localhost'),
    port:     parseInt(optional('MYSQL_PORT', '3306'), 10),
    database: optional('MYSQL_DATABASE', 'defaultdb'),
    user:     optional('MYSQL_USER', 'root'),
    password: optional('MYSQL_PASSWORD', ''),
    // Path to the Aiven CA certificate (required for SSL verification)
    sslCaPath: optional('MYSQL_SSL_CA', './certs/ca.pem'),
  },

  firebase: {
    serviceAccountPath: optional('FIREBASE_SERVICE_ACCOUNT_PATH', ''),
    projectId:    optional('FIREBASE_PROJECT_ID', ''),
    clientEmail:  optional('FIREBASE_CLIENT_EMAIL', ''),
    privateKey:   optional('FIREBASE_PRIVATE_KEY', '').replace(/\\n/g, '\n'),
  },

  jwt: {
    secret:    optional('JWT_SECRET', 'change_me_in_production'),
    expiresIn: optional('JWT_EXPIRES_IN', '7d'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    max:      parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
  },
} as const;
