"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const SRC = path.join(ROOT, "functions", "index.js");
const HDR = path.join(ROOT, "server", "lib", "commerce", "handlersHeader.cjs.fragment");
const OUT = path.join(ROOT, "server", "lib", "commerce", "handlers.generated.cjs");

function braceClose(lines, startIdx) {
  const base = lines[startIdx];
  let d = (base.match(/\{/g) || []).length - (base.match(/\}/g) || []).length;
  for (let k = startIdx + 1; k < lines.length; k += 1) {
    d += (lines[k].match(/\{/g) || []).length;
    d -= (lines[k].match(/\}/g) || []).length;
    if (d <= 0) return k;
  }
  return -1;
}

function trimIndent(ls, chars) {
  return ls.map((l) => (l.startsWith(chars) ? l.slice(chars.length) : l));
}

function exportHttpsHandler(outLines, i, exportedNameHint) {
  const line = outLines[i];

  /*
   * exports.X = functions.https.onRequest(async (req,res)=>{ ...
   */
  const mInline = line.match(/^exports\.(\w+)\s*=\s*functions\.https\.onRequest\(async\s*\(req,\s*res\)\s*=>\s*\{\s*$/);
  if (mInline) {
    const nm = exportedNameHint || mInline[1];
    const clo = braceClose(outLines, i);
    const body = trimIndent(outLines.slice(i + 1, clo), "  ");
    return {
      nm,
      end: clo,
      fn: [`async function ${nm}(req, res) {`, ...body, "}", "", `exports.${nm} = ${nm};`, ""]
    };
  }

  /*
   * exports.X = functions.https.onRequest((req,res)=>{ ...
   */
  const mSync = line.match(/^exports\.(\w+)\s*=\s*functions\.https\.onRequest\(\(req,\s*res\)\s*=>\s*\{\s*$/);
  if (mSync) {
    const nm = exportedNameHint || mSync[1];
    const clo = braceClose(outLines, i);
    const body = trimIndent(outLines.slice(i + 1, clo), "  ");
    return {
      nm,
      end: clo,
      fn: [`function ${nm}(req, res) {`, ...body, "}", "", `exports.${nm} = ${nm};`, ""]
    };
  }

  /*
   * exports.X = functions
   *   .runWith(...)
   *   .https.onRequest(async ...
   */
  const mLead = line.match(/^exports\.(\w+)\s*=\s*functions\s*$/);
  if (!mLead) return null;

  let j = i + 1;
    while (
      j < outLines.length &&
      !/^\s*\.https\.onRequest\(async\s*\(req,\s*res\)\s*=>\s*\{\s*$/.test(outLines[j])
    )
    j += 1;

  if (j >= outLines.length) return null;

  const nm = exportedNameHint || mLead[1];
  const clo = braceClose(outLines, j);
  const bodyRaw = outLines.slice(j + 1, clo);

  /*
   * strip 4-space indent relative to firebase inner body
   */
  const body = trimIndent(bodyRaw, "    ");
  return {
    nm,
    end: clo,
    fn: [`async function ${nm}(req, res) {`, ...body, "}", "", `exports.${nm} = ${nm};`, ""]
  };
}

function exportFirestoreUpdate(outLines, i) {
  /*
   * expects line exports.onOrderUpdate = functions
   */
  let j = i + 1;
  while (j < outLines.length && !/^\s*\.firestore\.document\(/.test(outLines[j])) j += 1;
  while (
    j < outLines.length &&
    !/^\s*\.onUpdate\(async\s*\(change,\s*context\)\s*=>\s*\{/.test(outLines[j])
  )
    j += 1;
  if (j >= outLines.length) throw new Error("parse onOrderUpdate");

  const clo = braceClose(outLines, j);
  const body = trimIndent(outLines.slice(j + 1, clo), "    ");
  return {
    end: clo,
    lines: [
      "async function runOrderUpdateInventorySideEffects(change, context) {",
      ...body,
      "}",
      "",
      "exports.runOrderUpdateInventorySideEffects = runOrderUpdateInventorySideEffects;",
      ""
    ]
  };
}

function exportFirestoreDelete(outLines, i) {
  let j = i + 1;
  while (j < outLines.length && !/^\s*\.firestore\.document\(/.test(outLines[j])) j += 1;
  while (
    j < outLines.length &&
    !/^\s*\.onDelete\(async\s*\(snap,\s*context\)\s*=>\s*\{/.test(outLines[j])
  )
    j += 1;
  if (j >= outLines.length) throw new Error("parse onOrderDelete");

  const clo = braceClose(outLines, j);
  const body = trimIndent(outLines.slice(j + 1, clo), "    ");
  return {
    end: clo,
    lines: [
      "async function runOrderDeleteInventorySideEffects(snap, context) {",
      ...body,
      "}",
      "",
      "exports.runOrderDeleteInventorySideEffects = runOrderDeleteInventorySideEffects;",
      ""
    ]
  };
}

function exportPubsubCron(outLines, i) {
  let j = i + 1;
  while (j < outLines.length && !/^\s*\.pubsub\.schedule\(/.test(outLines[j])) j += 1;
  while (j < outLines.length && !/^\s*\.onRun\(async\s*\(\)\s*=>\s*\{/.test(outLines[j]))
    j += 1;
  if (j >= outLines.length) throw new Error("parse cron");

  const clo = braceClose(outLines, j);
  const body = trimIndent(outLines.slice(j + 1, clo), "    ");
  return {
    end: clo,
    lines: [
      "async function runAbandonedCartReminderJob() {",
      ...body,
      "}",
      "",
      "exports.runAbandonedCartReminderJob = runAbandonedCartReminderJob;",
      ""
    ]
  };
}

/*
 * ----------------------------
 */
const tail = fs.readFileSync(SRC, "utf8").split(/\n/);
let startCut = tail.findIndex((l) => /^admin\.initializeApp\(\);\s*$/.test(l));
if (startCut < 0) throw new Error("admin.initializeApp marker missing");
const outLines = tail.slice(startCut + 1);

const parts = [];

for (let i = 0; i < outLines.length; i += 1) {
  const ln = outLines[i];

  if (/^exports\.onOrderUpdate\s*=/.test(ln)) {
    const b = exportFirestoreUpdate(outLines, i);
    parts.push(...b.lines);
    i = b.end;
    while (i + 1 < outLines.length && /^\);\s*$/.test(outLines[i + 1].trim())) i += 1;
    continue;
  }

  if (/^exports\.onOrderDelete\s*=/.test(ln)) {
    const b = exportFirestoreDelete(outLines, i);
    parts.push(...b.lines);
    i = b.end;
    while (i + 1 < outLines.length && /^\);\s*$/.test(outLines[i + 1].trim())) i += 1;
    continue;
  }

  if (/^exports\.abandonedCartReminderJob\s*=/.test(ln)) {
    const b = exportPubsubCron(outLines, i);
    parts.push(...b.lines);
    i = b.end;
    while (i + 1 < outLines.length && /^\);\s*$/.test(outLines[i + 1].trim())) i += 1;
    continue;
  }

  /*
   * https handlers (including chained runWith): must come after specialised exports
   */
  if (/^exports\.\w+\s*=/.test(ln)) {
    let r = exportHttpsHandler(outLines, i, null);

    /*
     * single-line HTTPS could also be `.https.onRequest` on continuation - exportHttps resolves
     */
    if (!r) {
      throw new Error(`Could not unwrap export:\n${ln}`);
    }

    parts.push(...r.fn);
    i = r.end;
    while (i + 1 < outLines.length && /^\);\s*$/.test(outLines[i + 1].trim())) i += 1;
    continue;
  }

  parts.push(ln);
}

const hdr = fs.readFileSync(HDR, "utf8");
const outFinal = hdr + parts.join("\n");
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, outFinal, "utf8");
console.log("OK", OUT);
