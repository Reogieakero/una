const r = await fetch("http://localhost:3100/login");
const html = await r.text();
const m = html.match(/\/_next\/static\/chunks\/[^"']+\.js/);
console.log("CHUNK_URL", m && m[0]);
if (m) {
  const r2 = await fetch("http://localhost:3100" + m[0]);
  const t = await r2.text();
  console.log("STATIC", r2.status, "LEN", t.length);
}
