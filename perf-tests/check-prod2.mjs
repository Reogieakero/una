for (const base of [
  "https://chekie-reogiem-2183s-projects.vercel.app",
  "https://chekie-ea768hmde-reogiem-2183s-projects.vercel.app",
]) {
  const r = await fetch(`${base}/login`, { redirect: "manual" });
  const html = await r.text();
  console.log(base);
  console.log("  status:", r.status, "loc:", r.headers.get("location"));
  console.log("  title:", (html.match(/<title>(.*?)<\/title>/) || [])[1]);
  const m = html.match(/\/_next\/static\/chunks\/[^"']+\.js/);
  console.log("  chunk:", m && m[0], "html_len:", html.length);
}
