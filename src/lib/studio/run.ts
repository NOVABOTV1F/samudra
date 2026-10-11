export function toRunnableDocument(lang: string, code: string) {
  const kind = lang.trim().toLowerCase();
  const source = code.trim();

  if (kind === "css") {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; min-height: 100%; background: #061018; color: #e6f2f4; font: 16px/1.5 Figtree, system-ui, sans-serif; }
    main { padding: 24px; max-width: 720px; margin: 0 auto; }
    .card { margin-top: 16px; padding: 16px; border: 1px solid rgba(230,242,244,.12); border-radius: 16px; }
    ${source}
  </style>
</head>
<body>
  <main>
    <h1>Pratinjau CSS</h1>
    <p>Gaya di blok kode diterapkan ke halaman ini.</p>
    <div class="card">Kartu contoh</div>
  </main>
</body>
</html>`;
  }

  if (kind === "js" || kind === "javascript") {
    const safe = source.replace(/<\/script/gi, "<\\/script");
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { margin: 0; background: #061018; color: #d7ecea; }
    #out { font: 13px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 16px; white-space: pre-wrap; }
    .err { color: #e07a72; }
  </style>
</head>
<body>
  <div id="out"></div>
  <script>
    const out = document.getElementById("out");
    const write = (cls, args) => {
      const line = document.createElement("div");
      if (cls) line.className = cls;
      line.textContent = args.map((a) => {
        if (a instanceof Error) return a.stack || a.message;
        if (typeof a === "object") {
          try { return JSON.stringify(a, null, 2); } catch { return String(a); }
        }
        return String(a);
      }).join(" ");
      out.appendChild(line);
    };
    console.log = (...a) => write("", a);
    console.warn = (...a) => write("", a);
    console.error = (...a) => write("err", a);
    try {
      ${safe}
    } catch (error) {
      console.error(error);
    }
  </script>
</body>
</html>`;
  }

  if (kind === "svg" || source.startsWith("<svg")) {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <style>html,body{margin:0;min-height:100%;background:#061018;display:grid;place-items:center}</style>
</head>
<body>${source}</body>
</html>`;
  }

  if (!/<html/i.test(source)) {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>html,body{margin:0;min-height:100%}</style>
</head>
<body>${source}</body>
</html>`;
  }

  return source;
}
