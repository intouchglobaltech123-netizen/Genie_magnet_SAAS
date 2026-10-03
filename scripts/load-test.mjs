// Load test (P6-14): ten times Genie Magnet's load against an API with the sample data and test sign-in — a local or
// staging server, never one with real data. Genie Magnet has twelve people; each becomes ten virtual users (120 in
// all), each opening the screens they can see at a person's pace (a request every 2 to 6 seconds), for a minute.
// It prints throughput and response times per route, and fails when the 95th percentile or the error rate is too high.
//
//   node scripts/load-test.mjs [--api http://localhost:4000] [--origin http://localhost:3000]
//                              [--per-person 10] [--seconds 60] [--max-p95 500] [--max-errors 0.01]

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const API = arg("api", "http://localhost:4000");
const ORIGIN = arg("origin", "http://localhost:3000");
const PER_PERSON = Number(arg("per-person", "10"));
const SECONDS = Number(arg("seconds", "60"));
const MAX_P95 = Number(arg("max-p95", "500"));
const MAX_ERRORS = Number(arg("max-errors", "0.01"));

const PEOPLE = ["jana", "ashwin", "priya", "karthik", "vignesh", "divya", "surya", "meena", "harini", "anitha"]
  .map((p) => `${p}@geniemagnet.test`)
  .concat(["keerthana@freelance.test", "rahul@freelance.test"]);
// The screens people open most, read-only so the data does not change under the test.
const ROUTES = [
  "/me",
  "/notifications",
  "/agency",
  "/agency/setup",
  "/clients",
  "/videos",
  "/leads",
  "/invoices",
  "/packages",
  "/agreements",
  "/team",
  "/goals",
  "/projects",
  "/assets",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(email) {
  const res = await fetch(`${API}/api/auth/test-sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(`Test sign-in failed for ${email} (${res.status}). Is TEST_SIGN_IN on, with the sample data?`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

const timings = new Map(); // route → ms[]
const statuses = new Map(); // status → count
async function hit(cookie, route) {
  const started = performance.now();
  let status = 0;
  try {
    const res = await fetch(`${API}${route}`, { headers: { cookie } });
    status = res.status;
    await res.arrayBuffer();
  } catch {
    status = "network error";
  }
  const ms = performance.now() - started;
  if (!timings.has(route)) timings.set(route, []);
  timings.get(route).push(ms);
  statuses.set(status, (statuses.get(status) ?? 0) + 1);
  return status;
}

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] : 0);
const fmt = (ms) => `${Math.round(ms)} ms`;

// 1. Sign everyone in, and find the screens each can open (an editor cannot see invoices, say).
const people = [];
for (const email of PEOPLE) {
  const cookie = await signIn(email);
  const routes = [];
  for (const route of ROUTES) {
    const res = await fetch(`${API}${route}`, { headers: { cookie } });
    await res.arrayBuffer();
    if (res.status === 200) routes.push(route);
  }
  people.push({ email, cookie, routes });
}
console.log(`${people.length} people, ${people.length * PER_PERSON} virtual users, ${SECONDS} s against ${API}`);

// 2. Everyone at once, each at a person's pace.
const until = Date.now() + SECONDS * 1000;
const started = Date.now();
await Promise.all(
  people.flatMap((p) =>
    Array.from({ length: PER_PERSON }, async () => {
      await sleep(Math.random() * 3000); // not all on the same second
      while (Date.now() < until) {
        await hit(p.cookie, p.routes[Math.floor(Math.random() * p.routes.length)]);
        await sleep(2000 + Math.random() * 4000);
      }
    }),
  ),
);
const elapsed = (Date.now() - started) / 1000;

// 3. What it showed.
const all = [...timings.values()].flat().sort((a, b) => a - b);
const total = all.length;
const errors = [...statuses].filter(([s]) => s !== 200).reduce((n, [, c]) => n + c, 0);
console.log(`\n${total} requests in ${elapsed.toFixed(0)} s: ${(total / elapsed).toFixed(1)} a second (${Math.round((total / elapsed) * 60)} a minute)`);
console.log(`all routes: p50 ${fmt(pct(all, 50))} · p95 ${fmt(pct(all, 95))} · p99 ${fmt(pct(all, 99))} · max ${fmt(all.at(-1) ?? 0)}`);
console.log(`answers: ${[...statuses].map(([s, c]) => `${s} × ${c}`).join(", ")}\n`);
for (const [route, ms] of [...timings].sort((a, b) => a[0].localeCompare(b[0]))) {
  const s = [...ms].sort((a, b) => a - b);
  console.log(`${route.padEnd(16)} ${String(s.length).padStart(5)} requests · p50 ${fmt(pct(s, 50)).padStart(7)} · p95 ${fmt(pct(s, 95)).padStart(7)}`);
}

const p95 = pct(all, 95);
const errorRate = total ? errors / total : 1;
const passed = p95 <= MAX_P95 && errorRate <= MAX_ERRORS;
console.log(
  `\n${passed ? "PASSED" : "FAILED"}: p95 ${fmt(p95)} (at most ${MAX_P95} ms), errors ${(errorRate * 100).toFixed(2)}% (at most ${MAX_ERRORS * 100}%)`,
);
process.exit(passed ? 0 : 1);
