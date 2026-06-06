"use strict";

async function getRow(pool, path) {
  const { rows } = await pool.query(
    "SELECT path, data, created_at, updated_at FROM documents WHERE path = $1 LIMIT 1",
    [path]
  );
  return rows[0] || null;
}

async function upsert(pool, path, data) {
  await pool.query(
    `
      INSERT INTO documents (path, data, created_at, updated_at)
      VALUES ($1, $2::jsonb, now(), now())
      ON CONFLICT (path)
      DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    `,
    [path, JSON.stringify(data)]
  );
}

function shallowMergeFirestore(baseDoc, patch) {
  const b = baseDoc ? { ...baseDoc } : {};
  return Object.assign(b, patch, {
    updatedAt: patch.updatedAt != null ? patch.updatedAt : new Date().toISOString()
  });
}

async function mergeShallow(pool, path, patch) {
  const prev = await getRow(pool, path);
  const merged = shallowMergeFirestore(prev && prev.data, patch);
  if (!prev) {
    merged.createdAt = merged.createdAt || new Date().toISOString();
  }
  if (prev) {
    await pool.query("UPDATE documents SET data=$2::jsonb, updated_at=now() WHERE path=$1", [
      path,
      JSON.stringify(merged)
    ]);
  } else {
    await pool.query(
      "INSERT INTO documents (path,data,created_at,updated_at) VALUES ($1,$2::jsonb,now(),now())",
      [path, JSON.stringify(merged)]
    );
  }
  return merged;
}

async function replace(pool, path, data) {
  const prev = await getRow(pool, path);
  if (prev) {
    await pool.query("UPDATE documents SET data=$2::jsonb, updated_at=now() WHERE path=$1", [
      path,
      JSON.stringify(data)
    ]);
  } else {
    await pool.query(
      "INSERT INTO documents (path,data,created_at,updated_at) VALUES ($1,$2::jsonb,now(),now())",
      [path, JSON.stringify(data)]
    );
  }
}

async function deletePath(pool, path) {
  const prev = await getRow(pool, path);
  await pool.query("DELETE FROM documents WHERE path=$1", [path]);
  return prev;
}

/*
 * Rows under prefix `orders/` ordered by timestamp field
 */
async function listPrefix(pool, prefix, orderByDescField) {
  const like = `${prefix.replace(/\/+$/u, "")}/%`;

  /*
   * Prefer created_at column, then nested json string for createdAt
   */
  const orderClause =
    orderByDescField === "createdAt" ?
      `
      ORDER BY COALESCE(
        created_at,
        NULLIF(trim(data ->> 'createdAt'),'')::timestamptz
      ) DESC NULLS LAST
    ` :
      " ORDER BY path ASC ";

  const { rows } = await pool.query(
    `SELECT path, data FROM documents WHERE path LIKE $1 ${orderClause}`,
    [like]
  );
  return rows;
}

/*
 * Paths matching exact depth for configurator part roots
 */
async function pathsRegex(pool, regex) {
  const { rows } = await pool.query("SELECT path, data FROM documents WHERE path ~ $1 ORDER BY path", [
    regex
  ]);
  return rows;
}

async function allocateCounter(pool, key, startAt) {
  const path = `system_counters/${encodeURIComponent(key)}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      "SELECT data FROM documents WHERE path=$1 FOR UPDATE",
      [path]
    );
    const curDoc = rows[0] ? rows[0].data || {} : {};
    const prev = rows[0] ? Number(curDoc.current) : NaN;
    const seed = Number(startAt);
    const safePrev = Number.isFinite(prev) ? prev : Number.isFinite(seed) ? seed - 1 : 0;
    const next = safePrev + 1;
    const nextData = {
      ...(rows[0] ? curDoc : {}),
      current: next,
      updatedAt: new Date().toISOString()
    };

    await client.query(
      `
      INSERT INTO documents(path,data,created_at,updated_at)
      VALUES($1,$2::jsonb,now(),now())
      ON CONFLICT(path)
      DO UPDATE SET data=$2::jsonb, updated_at=now()
    `,
      [path, JSON.stringify(nextData)]
    );
    await client.query("COMMIT");
    return String(next);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getRow,
  upsert,
  mergeShallow,
  replace,
  deletePath,
  listPrefix,
  pathsRegex,
  allocateCounter
};
