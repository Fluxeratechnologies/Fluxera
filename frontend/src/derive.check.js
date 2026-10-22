import assert from "node:assert/strict";
import { derive, dominantError, costBuckets } from "./derive.js";

const data = {
  totalRequests: 100,
  totalFailed: 40,
  totalLost: 10,
  impact: { revenueAtRisk: 1000 },
  logs: [
    { status: "fail", error: "timeout", endpoint: "/a", price: 1, ts: new Date() },
    { status: "fail", error: "server_error", endpoint: "/a", price: 1, ts: new Date() },
  ],
};
const d = derive(data);
assert.equal(d.reliability, 60);
assert.equal(d.recovered, 20);
assert.equal(d.recoverySuccess, 50);
assert.equal(d.savings, 500);
assert.equal(d.fidelity, 80);
assert.equal(dominantError(data.logs, "/a"), "timeout");

const now = Date.now();
const buckets = costBuckets([
  { status: "fail", error: "timeout", price: 4, ts: new Date(now - 1000) },
  { status: "fail", error: "server_error", price: 6, ts: new Date(now - 1000) },
  { status: "success", price: 9, ts: new Date(now - 1000) },
], "24h", now);
const last = buckets[buckets.length - 1];
assert.equal(buckets.length, 8);
assert.ok(Math.abs(last.failed - 10) < 0.001);
assert.ok(Math.abs(last.recovered - 4) < 0.001);
console.log("derive ok");
