const BASE = "https://chekie-ea768hmde-reogiem-2183s-projects.vercel.app";
const r = await fetch(`${BASE}/login`);
const html = await r.text();
console.log("LOGIN", r.status);
const m = html.match(/\/_next\/static\/chunks\/[^"']+\.js/);
console.log("CHUNK_URL", m && m[0]);
if (m) {
  const r2 = await fetch(BASE + m[0]);
  const t = await r2.text();
  console.log("STATIC", r2.status, "LEN", t.length);
}
const r3 = await fetch(`${BASE}/referrals`, { redirect: "manual" });
console.log("REFERRALS", r3.status, "LOC", r3.headers.get("location"));
