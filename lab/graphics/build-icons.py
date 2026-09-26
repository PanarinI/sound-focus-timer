#!/usr/bin/env python3
"""Иконка расширения: мастер SVG → PNG 16 · 32 · 48 · 64 · 96 · 128, кодом.

Закон (LAUNCH.md, урок 09-02): иконку берут из своего мастер-файла, а не рисуют по памяти.
Мастер — SVG в этой папке; PNG только генерируются из него, руками не правятся.

Размеры. По канону 3.1 и правилам Chrome 128 — это картинка 96 × 96 и прозрачная рамка по 16 px:
в этом размере иконку показывает стор и окно установки. 16–96 — плашка во весь квадрат: в тулбаре
каждый пиксель на счету (16 — обычный экран, 32 — Retina).

Растеризует сам Chrome — тот же Skia, что потом нарисует иконку в тулбаре. SVG кладётся на canvas
ровно нужного размера (векторно, без пережатия картинки), PNG уходит из страницы через --dump-dom.

    python3 build-icons.py icon-2026-09-26-a-iskra.svg icon-2026-09-26-b-dajl.svg
        → icons-2026-09-26-a-iskra/{16,32,48,64,96,128}.png  и т. д.

В extension/icons/ отсюда копируют руками и только после слова автора; сборка — lab/build-zip.sh dev.
"""
import base64, json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIZES = [16, 32, 48, 64, 96, 128]

PAGE = """<!doctype html><meta charset="utf-8"><body><pre id="out"></pre><script>
const SOURCES = %s, SIZES = %s;
const load = (src, s) => new Promise((ok, bad) => {
  // собственный размер SVG = размер холста: Chrome растеризует вектор сразу в нужную сетку пикселей
  const svg = src.replace(/<svg\\b([^>]*?)\\swidth="[^"]*"/, '<svg$1')
                 .replace(/<svg\\b([^>]*?)\\sheight="[^"]*"/, '<svg$1')
                 .replace(/<svg\\b/, `<svg width="${s}" height="${s}"`);
  const im = new Image();
  im.onload = () => ok(im); im.onerror = bad;
  im.src = URL.createObjectURL(new Blob([svg], {type: 'image/svg+xml'}));
});
(async () => {
  const out = {};
  for (const [name, src] of Object.entries(SOURCES)) {
    out[name] = {};
    for (const s of SIZES) {
      const c = document.createElement('canvas'); c.width = c.height = s;
      const x = c.getContext('2d');
      if (s === 128) x.drawImage(await load(src, 96), 16, 16);   // 96 + прозрачная рамка по 16
      else x.drawImage(await load(src, s), 0, 0);
      out[name][s] = c.toDataURL('image/png').split(',')[1];
    }
  }
  document.getElementById('out').textContent = JSON.stringify(out);
})();
</script>"""


def render(masters):
    """masters: {имя: текст SVG} → {имя: {размер: байты PNG}}"""
    with tempfile.TemporaryDirectory() as tmp:
        page = os.path.join(tmp, "render.html")
        with open(page, "w", encoding="utf-8") as f:
            f.write(PAGE % (json.dumps(masters), json.dumps(SIZES)))
        dom = subprocess.run(
            # без --user-data-dir: свежий профиль вешал Chrome; mock-keychain — чтобы не трогать связку ключей
            [CHROME, "--headless=new", "--disable-gpu", "--use-mock-keychain", "--no-first-run",
             "--virtual-time-budget=8000", "--dump-dom", f"file://{page}"],
            capture_output=True, text=True, timeout=60).stdout
    m = re.search(r'<pre id="out">(.*?)</pre>', dom, re.S)
    if not m or not m.group(1).strip():
        sys.exit("Chrome не вернул картинки — страница рендера не отработала")
    data = json.loads(m.group(1).replace("&quot;", '"').replace("&amp;", "&"))
    return {n: {int(s): base64.b64decode(b) for s, b in sizes.items()} for n, sizes in data.items()}


def main(paths):
    masters, homes = {}, {}
    for p in paths:
        full = p if os.path.isabs(p) else os.path.join(HERE, p)
        name = os.path.splitext(os.path.basename(full))[0]
        masters[name] = open(full, encoding="utf-8").read()
        homes[name] = os.path.dirname(full)                   # PNG ложатся рядом со своим мастером
    for name, pngs in render(masters).items():
        outdir = os.path.join(homes[name], name.replace("icon-", "icons-", 1))
        os.makedirs(outdir, exist_ok=True)
        for s, b in pngs.items():
            with open(os.path.join(outdir, f"{s}.png"), "wb") as f:
                f.write(b)
        print("→", outdir, " ".join(f"{s}:{len(b)}б" for s, b in sorted(pngs.items())))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
