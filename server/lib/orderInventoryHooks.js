"use strict";

function changeShim(beforeData, afterData) {
  return {
    before: { data() { return beforeData; }},
    after: { data() { return afterData; }}
  };
}

function snapshotShim(data) {
  return { data() { return data; }};
}

function orderParamsFromPath(path) {
  const id = path.replace(/^orders\//u, "").split("/")[0] || "";
  return { params: { orderId: id } };
}

async function maybeRunOrderUpdate(handlersMod, prevData, mergedData, docPath) {
  if (!docPath.startsWith("orders/")) return;
  await handlersMod.runOrderUpdateInventorySideEffects(
    changeShim(prevData || null, mergedData || {}),
    orderParamsFromPath(docPath)
  );
}

async function maybeRunOrderDelete(handlersMod, prevSnapshotData, docPath) {
  if (!docPath.startsWith("orders/")) return;
  await handlersMod.runOrderDeleteInventorySideEffects(
    snapshotShim(prevSnapshotData || {}),
    orderParamsFromPath(docPath)
  );
}

module.exports = {
  maybeRunOrderUpdate,
  maybeRunOrderDelete
};
