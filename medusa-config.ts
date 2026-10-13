import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Supabase pooler presents a cert chain Node rejects with
    // SELF_SIGNED_CERT_IN_CHAIN under strict TLS. pg-connection-string
    // turns ?sslmode=require into strict verification that OVERRIDES any
    // explicit ssl object — so the DATABASE_URL must NOT contain an sslmode
    // param; TLS is enabled below with verification skipped instead.
    databaseDriverOptions: process.env.NODE_ENV !== "development" ?
      { connection: { ssl: { rejectUnauthorized: false } } } : {},
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  }
})
