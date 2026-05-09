"use strict";

/*
 * Creates/replaces an admin user for cookie-based authentication.
 *
 * Usage (from repo root, with DATABASE_URL set):
 *   node server/scripts/seed-admin-user.cjs your@email.com yourPassword
 */

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const [, , emailRaw, password] = process.argv;
const email = String(emailRaw || "").trim().toLowerCase();

if (!email || !password) {
  console.error("Usage: node server/scripts/seed-admin-user.cjs <email> <password>");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const hash = bcrypt.hashSync(password, 12);
    const { rowCount } = await pool.query(
      `
      INSERT INTO admin_users (email, password_hash)
      VALUES ($1, $2)
      ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    `,
      [email, hash]
    );
    console.log(`OK (${rowCount} rows affected) admin_users ${email}`);
  } finally {
    await pool.end();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
