#!/usr/bin/env node
// Carbium's published benchmark script (carbium.sh/terms, 6.7): it times 34 JSON-RPC reads from your machine to
// services.carbium.sh with your own service key. Node 24, no dependencies. Set the key without leaving it in your shell
// history, then run it alone:  read -rs CARBIUM_KEY && export CARBIUM_KEY && node benchmark/benchmark.mjs
// One call at a time, never more than one every 200 ms: 34 methods, 1 untimed and 10 timed calls each, 374 calls in all,
// each billed as any call is. It calls services.carbium.sh only, reads nothing but CARBIUM_KEY and takes no argument.
// A refusal of the key (401, 402, 403) or of the rate (429) ends the run at once, and so do three connections in a row
// with no answer: nothing is retried. Run it once, then wait before the next run.
// Exit: 0 served, 1 nothing served or no answer three times in a row, 2 no key or an argument given, 3 the key was
// refused, 4 the rate was refused.
const URL = "https://services.carbium.sh/", WARM = 10, GAP_MS = 200, CALL_MS = 10000;
const ACCT = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9", USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", WSOL = "So11111111111111111111111111111111111111112",
  TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", ABSENT = "11111111111111111111111111111112", TOKACCT = "7KruwqvAhkV6Dykoi8SbZCh4zyxYfLShdjxtx7GNjVWs";
const C = { commitment: "confirmed" }, F = { commitment: "finalized" };
// [method, params(ctx)]: ctx.S is the finalized slot read first minus 64, ctx.bh the blockhash read second
const METHODS = [
  ["getSlot", () => [F]], ["getLatestBlockhash", () => [C]], ["getHealth", () => []], ["getVersion", () => []], ["getBlockHeight", () => [C]],
  ["getEpochInfo", () => [C]], ["getGenesisHash", () => []], ["getAgGenesisCert", () => []], ["getIdentity", () => []], ["getTransactionCount", () => [C]],
  ["getStakeMinimumDelegation", () => []], ["getInflationGovernor", () => [C]], ["getInflationRate", () => []], ["getEpochSchedule", () => []],
  ["getSlotLeader", () => [C]], ["getHighestSnapshotSlot", () => []], ["getMaxRetransmitSlot", () => []], ["getMaxShredInsertSlot", () => []],
  ["minimumLedgerSlot", () => []], ["getFirstAvailableBlock", () => []], ["getBalance", () => [ACCT, C]], ["getMinimumBalanceForRentExemption", () => [165]],
  ["isBlockhashValid", (c) => [c.bh, C]], ["getBlockCommitment", (c) => [c.S]], ["getRecentPerformanceSamples", () => [4]],
  ["getRecentPrioritizationFees", () => [[USDC]]], ["getSlotLeaders", (c) => [c.S, 10]],
  ["getBlockProduction", (c) => [{ ...F, range: { firstSlot: c.S - 99, lastSlot: c.S } }]], ["getBlockTime", (c) => [c.S]], ["getVoteAccounts", () => [F]],
  ["getAccountInfo", () => [USDC, { encoding: "base64", ...C }]], ["getTokenSupply", () => [USDC, C]],
  ["getMultipleAccounts", () => [[USDC, USDT, WSOL, TOKEN, ABSENT], { encoding: "base64", ...C }]], ["getTokenAccountBalance", () => [TOKACCT, C]],
];
if (process.argv.length > 2) { console.error("this script takes no argument: set CARBIUM_KEY and run it alone"); process.exit(2); }
const key = (process.env.CARBIUM_KEY || "").trim();
// a service key, checked before any call: an account key or anything else is refused here, and never printed
if (!/^c_serv_[A-Za-z0-9]+$/.test(key)) { console.error("set CARBIUM_KEY to your own service key (c_serv_...), on one line"); process.exit(2); }
const body = key.slice("c_serv_".length);
const clean = (s) => String(s).split(key).join("***").split(body).join("***");   // the key is never printed, even when an answer echoes it
const STOP = { 401: [3, "the key was refused"], 402: [3, "the account is out of credits"], 403: [3, "the key was refused"], 429: [4, "the rate was refused: wait before the next run"] };
let calls = 0, last = -GAP_MS, stop = null, dead = 0;
async function post(method, params) {
  const wait = last + GAP_MS - performance.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, Math.ceil(wait) + 1));   // a timer may fire a fraction early
  const t = last = performance.now(); calls++;
  let r, j;
  try {
    r = await fetch(URL, { method: "POST", redirect: "error", headers: { "content-type": "application/json", "x-api-key": key },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), signal: AbortSignal.timeout(CALL_MS) });
    dead = 0;
    j = await r.json();
    if (!j || typeof j !== "object" || (!j.error && !(r.ok && "result" in j))) throw new Error("not a JSON-RPC answer");
  } catch (e) {
    j = { error: { code: r ? r.status : "network", message: e.cause?.code || e.message } };
    if (!r && ++dead >= 3) stop = [1, "no answer three times in a row", method];
  }
  const reason = typeof j.error?.data?.reason === "string" ? ` (${clean(j.error.data.reason).slice(0, 40)})` : "";
  if (r && STOP[r.status]) stop = [STOP[r.status][0], `HTTP ${r.status}${reason}, ${STOP[r.status][1]}`, method];
  return { ms: performance.now() - t, result: j.result, err: j.error ? clean(`${j.error.code} ${j.error.message}`).slice(0, 90) : null };
}
const q = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.ceil(p * a.length) - 1)].toFixed(1) : "-");
console.log("times from this machine to services.carbium.sh with your key, one call at a time");
const ctx = {}, rows = [], t0 = performance.now();
for (const [method, params] of METHODS) {
  const p = params(ctx), ms = [];
  if (JSON.stringify(p).includes("null")) { rows.push([method, "0/0", "-", "-", "skipped: its slot or blockhash was not read"]); continue; }
  const first = await post(method, p);   // the untimed first call: the values the later calls need
  if (method === "getSlot" && typeof first.result === "number") ctx.S = first.result - 64;
  if (method === "getLatestBlockhash") ctx.bh = first.result?.value?.blockhash;
  let err = first.err, tried = 0;
  while (!stop && tried < WARM) { tried++; const x = await post(method, p); if (x.err) err ??= x.err; else ms.push(x.ms); }
  rows.push([method, `${ms.length}/${tried}`, q(ms, 0.5), q(ms, 0.9), err || ""]);
  if (stop) break;
}
const w = [0, 1, 2, 3].map((i) => Math.max(...rows.map((r) => r[i].length), ["method", "served", "p50 ms", "p90 ms"][i].length));
for (const r of [["method", "served", "p50 ms", "p90 ms", ""], ...rows]) console.log(r.map((c, i) => (i < 4 ? c.padEnd(w[i]) : c)).join("  ").trimEnd());
console.log(`services.carbium.sh: ${calls} calls in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
if (stop) console.error(`stopped at ${stop[2]}: ${stop[1]}`);
process.exit(stop ? stop[0] : rows.some((r) => !r[1].startsWith("0/")) ? 0 : 1);
