import "dotenv/config";

const rawUrl =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  "";

const cleanUrl = rawUrl
  .replace(/[?&]channel_binding=[^&]+/g, (match) => (match.startsWith("?") ? "?" : ""))
  .replace(/\?&/, "?")
  .replace(/\?$/, "");

export default {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: {
    url: cleanUrl,
  },
};
