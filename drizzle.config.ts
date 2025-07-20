require("dotenv").config();

import type { Config } from "drizzle-kit";

export default {
  schema: "./src/models/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DB_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
    // url: "http://localhost:8080",
  },
} satisfies Config;
