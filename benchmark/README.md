# Benchmark

`benchmark.mjs` times 34 JSON-RPC reads from your machine to `services.carbium.sh` with your own service key. It is
Carbium's published benchmark script: [Carbium's Terms](https://carbium.sh/terms) (6.7) let you run it with your own
key at its built-in rate.

## Run it

Node 24 or later, no dependencies. Set the key without leaving it in your shell history, then run the script once:

```sh
read -rs CARBIUM_KEY && export CARBIUM_KEY
node benchmark/benchmark.mjs
```

It reads nothing but `CARBIUM_KEY` and takes no argument. The key travels in the `x-api-key` header only and is never
printed.

## What it does

One call at a time, never more than one every 200 ms. Each of the 34 methods gets one untimed call and ten timed calls,
374 calls in all, and each call is billed as usual. It calls `services.carbium.sh` only, and it sends no transaction.

It prints one row per method: how many of the ten timed calls were served, their p50 and p90 in milliseconds and the
first error, then the number of calls and the seconds the run took. The times are from your machine, over your network.

## When it stops

A refused key (401, 402, 403) or a refused rate (429) ends the run at once with the reason, and so do three connections
in a row with no answer. Nothing is retried. Run it once, then wait before the next run: on the free plan, the callers on
one network share a request budget.

| Exit | Meaning |
|---|---|
| 0 | at least one method was served |
| 1 | nothing was served, or three connections in a row had no answer |
| 2 | no service key in `CARBIUM_KEY`, or an argument was given |
| 3 | the key was refused, or the account is out of credits |
| 4 | the rate was refused |

It is not a load test. Probing or load testing the services needs Carbium's written consent
([Terms](https://carbium.sh/terms), 6.7).
