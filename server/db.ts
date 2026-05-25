import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
dotenv.config({ path: resolve(process.cwd(), '.env') });

console.log("Database URL:", process.env.DATABASE_URL ? "Set (not showing for security)" : "Not set");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function createPoolConfig(connectionString: string) {
  const url = new URL(connectionString);
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();

  if (sslMode) {
    url.searchParams.delete("sslmode");
  }

  const useSsl =
    sslMode === "require" ||
    (!sslMode && process.env.NODE_ENV === "production");

  return {
    connectionString: url.toString(),
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  };
}

export const pool = new Pool(createPoolConfig(process.env.DATABASE_URL));
export const db = drizzle(pool, { schema });
