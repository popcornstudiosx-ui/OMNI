import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL || "";
// Allow missing DATABASE_URL for build-only scenarios
if (!connectionString && process.env.NODE_ENV === "production") {
  throw new Error("DATABASE_URL is required in production");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
