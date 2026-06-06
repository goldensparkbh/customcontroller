"use strict";

module.exports.FieldValue = {
  serverTimestamp() {
    return { __fv_ts: true };
  },
  increment(delta) {
    return { __fv_inc: Number(delta) || 0 };
  }
};
