import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Debug: Check if DATABASE_URL is loaded
console.log("🔍 Environment variables loaded:");
console.log(
  "  - DATABASE_URL:",
  process.env.DATABASE_URL
    ? `${process.env.DATABASE_URL.substring(0, 30)}...`
    : "❌ NOT SET"
);
console.log(
  "  - JWT_SECRET:",
  process.env.JWT_SECRET ? "✅ SET" : "❌ NOT SET"
);
console.log("  - PORT:", process.env.PORT || "using default 3333");

if (!process.env.DATABASE_URL) {
  console.error("\n⚠️  WARNING: DATABASE_URL is not set!");
  console.error("⚠️  Your .env file needs a line like:");
  console.error(
    '⚠️  DATABASE_URL="postgresql://user:pass@host:port/database"\n'
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test pool connection
pool.on("error", (err) => {
  console.error("❌ Unexpected pool error:", err);
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["query", "error", "warn"],
});

export default prisma;
