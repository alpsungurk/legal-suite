export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>LexKasa</title>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="application-name" content="LexKasa" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #f4f6fb; color: #0c1c3f; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #64748b; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.5rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #143064; color: #fff; }
      .secondary { background: #fff; color: #0c1c3f; border-color: #cbd5e1; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Sayfa yüklenemedi</h1>
      <p>Bir sorun oluştu. Yenileyebilir veya girişe dönebilirsiniz.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tekrar dene</button>
        <a class="secondary" href="/giris">Giriş</a>
      </div>
    </div>
  </body>
</html>`;
}
