"use strict";

/**
 * Minimal Firestore-admin shaped API on top of `documents(path, data jsonb, created_at, updated_at)`.
 */

const crypto = require("crypto");

function isoNow() {
  return new Date().toISOString();
}

function deepCopy(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

function applyFieldLeaf(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return v;
  if ("__fv_ts" in v) return isoNow();
  return v;
}

function mergeFirestoreUpdate(existing, patch) {
  const base = deepCopy(existing || {});
  const incoming = deepCopy(patch || {});
  const next = { ...base };

  for (const [k, vRaw] of Object.entries(incoming)) {
    let v = vRaw;
    if (v && typeof v === "object" && !Array.isArray(v) && "__fv_ts" in v) {
      v = isoNow();
    }
    if (v && typeof v === "object" && !Array.isArray(v) && "__fv_inc" in v) {
      const cur = Number(next[k]);
      const safe = Number.isFinite(cur) ? cur : 0;
      next[k] = safe + (Number(v.__fv_inc) || 0);
    } else {
      next[k] = applyFieldLeaf(vRaw);
    }
  }

  if (!incoming.updatedAt) next.updatedAt = isoNow();
  return next;
}

function docFromSetPayload(raw) {
  const incoming = deepCopy(raw || {});
  const flat = {};
  for (const [k, v] of Object.entries(incoming)) {
    if (v && typeof v === "object" && !Array.isArray(v) && "__fv_ts" in v) {
      flat[k] = isoNow();
    } else {
      flat[k] = v;
    }
  }
  if (!flat.createdAt) flat.createdAt = isoNow();
  flat.updatedAt = flat.updatedAt || isoNow();
  return flat;
}

class DocumentSnapshot {
  constructor(ref, exists, data) {
    this.ref = ref;
    this.exists = !!exists;
    this._data = data;
    this.id = ref.id;
  }

  data() {
    return deepCopy(this._data || {});
  }
}

class DocRef {
  constructor(fs, path) {
    this._fs = fs;
    this.path = String(path || "").replace(/^\//, "").trim();
    const parts = this.path.split("/").filter(Boolean);
    this.id = parts[parts.length - 1] || "";
  }

  async get() {
    const row = await this._fs._getRow(null, this.path);
    return new DocumentSnapshot(this, !!(row && row.data), row && row.data);
  }

  collection(name) {
    return new CollRef(this._fs, `${this.path}/${String(name).replace(/^\/+|\/+$/g, "")}`);
  }

  async set(data, options = {}) {
    const merge = !!(options && options.merge);
    await this._fs._setOrMergeDoc(null, this.path, data || {}, merge, false);
  }

  async update(patch) {
    await this._fs._setOrMergeDoc(null, this.path, patch || {}, true, true);
  }

  async delete() {
    await (this._fs.pool).query("DELETE FROM documents WHERE path=$1", [this.path]);
  }
}

class CollRef {
  constructor(fs, path) {
    this._fs = fs;
    this.path = String(path || "").trim().replace(/^\//, "").replace(/\/+$/g, "");
    this.id = "";
    this.fs = fs;
    this.pool = fs.pool;
  }

  doc(inner) {
    const id = String(inner || "").replace(/^\//, "").trim();
    if (id.includes("/")) return new DocRef(this._fs, id);
    const fullPath = `${this.path}/${id}`.replace(/\/+/g, "/");
    return new DocRef(this._fs, fullPath);
  }

  async add(raw) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `gen_${Math.random().toString(36).slice(2, 11)}`;
    const docPath = `${this.path}/${id}`.replace(/\/+/g, "/");
    const payload = docFromSetPayload(raw || {});
    await this._fs._setOrMergeDoc(null, docPath, payload, false, false);
    return new DocRef(this._fs, docPath);
  }

  where(fieldPath, op, value) {
    if (op !== "==") throw new Error("compat: only == supported");
    return new Query(this._fs, this.path, [{ fieldPath, value }]);
  }
}

class Query {
  constructor(fs, collectionPath, filters) {
    this._fs = fs;
    this._collectionPath = collectionPath.replace(/\/+$/g, "");
    this._filters = [...filters];
    this._limit = null;
    this._orderField = null;
    this._orderDir = "asc";
  }

  limit(n) {
    this._limit = Number(n) || null;
    return this;
  }

  orderBy(fieldPath, dir) {
    this._orderField = String(fieldPath || "");
    this._orderDir = String(dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    return this;
  }

  async get() {
    const rows = await this._fs._queryCollection(
      this._collectionPath,
      this._filters,
      this._limit,
      this._orderField,
      this._orderDir
    );
    const docs = rows.map((r) => new DocumentSnapshot(new DocRef(this._fs, r.path), true, r.data));
    return {
      get empty() {
        return docs.length === 0;
      },
      docs,
      forEach(fn) {
        docs.forEach(fn);
      }
    };
  }
}

class TxWriteLayer {
  constructor(fs, client) {
    this._fs = fs;
    this._c = client;
  }

  async get(docRef) {
    const path = docRef.path;
    const { rows } = await this._c.query(
      "SELECT path, data, created_at FROM documents WHERE path=$1 FOR UPDATE LIMIT 1",
      [path]
    );
    const ref = new DocRef(this._fs, path);
    return new DocumentSnapshot(ref, !!(rows[0] && rows[0].data), rows[0] ? rows[0].data : null);
  }

  async set(docRef, data, opts = {}) {
    const merge = !!(opts && opts.merge);
    await this._fs._setOrMergeDoc(this._c, docRef.path, data || {}, merge, false);
  }

  async update(docRef, patch) {
    await this._fs._setOrMergeDoc(this._c, docRef.path, patch || {}, true, true);
  }
}

class BatchSetOp {
  constructor(path, payload, merge) {
    this.path = path;
    this.payload = payload;
    this.merge = !!merge;
  }
}

class BatchUpdateOp {
  constructor(path, patch) {
    this.path = path;
    this.patch = patch;
  }
}

class BatchDeleteOp {
  constructor(path) {
    this.path = path;
  }
}

class Batch {
  constructor(fs) {
    this._fs = fs;
    this.ops = [];
  }

  set(ref, data, opts = {}) {
    this.ops.push(new BatchSetOp(ref.path, data || {}, !!(opts && opts.merge)));
    return this;
  }

  update(ref, patch) {
    this.ops.push(new BatchUpdateOp(ref.path, patch || {}));
    return this;
  }

  delete(ref) {
    this.ops.push(new BatchDeleteOp(ref.path));
    return this;
  }

  async commit() {
    const pool = this._fs.pool;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const op of this.ops) {
        if (op instanceof BatchDeleteOp) {
          await client.query("DELETE FROM documents WHERE path=$1", [op.path]);
        } else if (op instanceof BatchSetOp) {
          await this._fs._setOrMergeDoc(client, op.path, op.payload, op.merge, false);
        } else if (op instanceof BatchUpdateOp) {
          await this._fs._setOrMergeDoc(client, op.path, op.patch, true, true);
        }
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

async function runPoolTx(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ret = await fn(client);
    await client.query("COMMIT");
    return ret;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

class PgFirestore {
  constructor(pool) {
    this.pool = pool;
  }

  doc(absPath) {
    return new DocRef(this, String(absPath || "").trim());
  }

  collection(part) {
    return new CollRef(this, String(part || "").trim());
  }

  batch() {
    return new Batch(this);
  }

  runTransaction(fn) {
    return runPoolTx(this.pool, async (client) => fn(new TxWriteLayer(this, client)));
  }

  async _getRow(client, path) {
    const q = (client || this.pool).query(
      "SELECT path, data, created_at, updated_at FROM documents WHERE path=$1 LIMIT 1",
      [path]
    );
    const r = await q;
    const row = r.rows[0];
    return row ? { path: row.path, data: row.data, created_at: row.created_at, updated_at: row.updated_at } : null;
  }

  /*
   * @param {boolean} updateOnly Firestore `.update()` fails if missing
   */
  async _setOrMergeDoc(client, path, incoming, merge, updateOnly) {
    const cq = client || this.pool;
    const prevRow = await this._getRow(client, path);

    if (!merge && !updateOnly) {
      const nextPayload = docFromSetPayload(incoming);
      const ca = coerceCreatedAt(nextPayload.createdAt) || new Date();
      const ua = nextPayload.updatedAt || isoNow();
      if (!prevRow) {
        await cq.query(
          "INSERT INTO documents (path, data, created_at, updated_at) VALUES ($1,$2::jsonb,$3,$4)",
          [path, JSON.stringify(nextPayload), ca, ua]
        );
        return;
      }
      await cq.query("UPDATE documents SET data=$2::jsonb, updated_at=$3 WHERE path=$1", [path, JSON.stringify(nextPayload), ua]);
      return;
    }

    if (updateOnly && !prevRow) {
      throw new Error(`DOCUMENT_NOTFOUND ${path}`);
    }

    const base = merge || updateOnly ? mergeFirestoreUpdate(prevRow?.data || {}, incoming) : {};
    const nextPayload = base;
    if (!prevRow) {
      const ca = coerceCreatedAt(nextPayload.createdAt) || coerceCreatedAt(incoming.createdAt) || new Date();
      const ua = nextPayload.updatedAt || isoNow();
      await cq.query(
        "INSERT INTO documents (path, data, created_at, updated_at) VALUES ($1,$2::jsonb,$3,$4)",
        [path, JSON.stringify(nextPayload), ca, ua]
      );
      return;
    }
    await cq.query("UPDATE documents SET data=$2::jsonb, updated_at=$3 WHERE path=$1", [
      path,
      JSON.stringify(nextPayload),
      nextPayload.updatedAt || isoNow()
    ]);
  }

  /*
   * list paths under `${collectionPrefix}/`
   */
  async _queryCollection(collectionPrefix, filters, limitNum, orderField, orderDir) {
    const clauses = [`path LIKE $1`];
    const params = [`${collectionPrefix.replace(/\/+$/u, "")}/%`];

    /*
     * top-level equality only (`data ->> field`)
     */
    if (filters && filters.length) {
      let ix = 2;
      filters.forEach((f) => {
        const key = String(f.fieldPath).replace(/[^a-zA-Z0-9_]/gu, "");
        if (!key) return;
        clauses.push(`COALESCE(data ->> '${key}', '') = $${ix}`);
        params.push(String(f.value));
        ix += 1;
      });
    }

    let orderClause = "";
    if (orderField) {
      const ok = String(orderField).replace(/[^a-zA-Z0-9_]/gu, "");
      const dir = orderDir === "desc" ? "DESC" : "ASC";
      if (ok === "createdAt") {
        orderClause = ` ORDER BY COALESCE(created_at, (data ->> '${ok}')::timestamptz) ${dir} NULLS LAST`;
      } else {
        orderClause = ` ORDER BY COALESCE((data ->> '${ok}')::timestamptz, created_at) ${dir} NULLS LAST`;
      }
    }

    const lim =
      typeof limitNum === "number" && Number.isFinite(limitNum) && limitNum > 0 ?
        ` LIMIT ${Math.floor(limitNum)}` :
        "";

    const sql =
      `SELECT path, data, created_at FROM documents WHERE ${clauses.join(" AND ")}` +
      orderClause +
      lim;
    const { rows } = await this.pool.query(sql, params);
    return rows;
  }
}

function coerceCreatedAt(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

module.exports = { PgFirestore };
