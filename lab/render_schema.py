#!/usr/bin/env python3
"""SVG-схема → PNG нужного размера, headless-Chrome (тот же путь, что у рига кадров).

    python3 lab/render_schema.py schemas/*.svg            # ×2, светлая
    python3 lab/render_schema.py schemas/foo.svg --x3 --dark

Зачем это вообще существует (08-08). Схемы уехали в Bluesky размером 300×150 —
текст стал нечитаем. Это не сжатие площадки: в корне SVG стоял `width="100%"`
без `height`, а такой SVG без контейнера рисуется в дефолт замещаемого элемента,
то есть ровно 300×150. Лечится двумя вещами, обе сделаны:
  1) в самих схемах теперь стоят настоящие width/height (+ max-width для страниц);
  2) наружу отдаём PNG отсюда, а не тащим SVG в загрузчик площадки.

⚠️ Крупный PNG чинит «открыть в полный размер», но НЕ карточку в ленте: карточка
около 600 px шириной, и подпись 11 px там всё равно ~3 px. Для ленты нужен
отдельный вариант схемы с крупным кеглем и меньшим числом элементов, а не апскейл.
"""
import os, re, subprocess, sys, tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUTDIR = "schemas/export"

def viewbox(svg):
    m = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
    if not m: sys.exit("нет viewBox — не знаю размера")
    return float(m.group(1)), float(m.group(2))

def theme(svg, dark):
    """Тему задаём ПЕРЕПИСЫВАНИЕМ css, а не надеждой на настройку рендерера.
    Поймано 08-08: светлый и тёмный прогон дали байт в байт одинаковый PNG —
    headless-Chrome сам считал себя тёмным, и `@media (prefers-color-scheme:dark)`
    срабатывал в обоих случаях. Теперь блок либо разворачивается (тёмная), либо
    вырезается совсем (светлая), и результат не зависит от машины."""
    i = svg.find("@media (prefers-color-scheme:dark)")
    if i < 0: return svg
    j = svg.find("{", i); depth = 0; k = j
    while k < len(svg):
        if svg[k] == "{": depth += 1
        elif svg[k] == "}":
            depth -= 1
            if depth == 0: break
        k += 1
    inner = svg[j + 1:k] if dark else ""       # тёмная — развернуть, светлая — вырезать
    return svg[:i] + inner + svg[k + 1:]

def render(path, scale, dark):
    svg = open(path, encoding="utf-8").read()
    w, h = viewbox(svg)
    svg = theme(svg, dark)
    bg = "#1C1917" if dark else "#ffffff"
    html = (f'<!doctype html><meta charset="utf-8">'
            f'<style>html,body{{margin:0;padding:0;background:{bg}}}'
            f'svg{{display:block;width:{w:.0f}px;height:{h:.0f}px}}</style>{svg}')
    os.makedirs(OUTDIR, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(OUTDIR, f"{base}{'-dark' if dark else ''}@{scale}x.png")
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html); tmp = f.name
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                    f"--force-device-scale-factor={scale}",
                    f"--window-size={w:.0f},{h:.0f}",
                    f"--screenshot={os.path.abspath(out)}", f"file://{tmp}"],
                   check=True, capture_output=True)
    os.unlink(tmp)
    return out

def write_svg(path, dark, outdir):
    """SVG с ЗАФИКСИРОВАННОЙ темой. Нужен для страниц хаба: они всегда тёмные, а
    SVG, вставленный через <img>, слушает системную тему читателя, а не страницу —
    и у человека со светлой системой схема встала бы белым пятном на тёмной странице."""
    svg = theme(open(path, encoding="utf-8").read(), dark)
    os.makedirs(outdir, exist_ok=True)
    base = os.path.splitext(os.path.basename(path))[0]
    out = os.path.join(outdir, f"{base}{'-dark' if dark else '-light'}.svg")
    open(out, "w", encoding="utf-8").write(svg)
    return out

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    scale = next((int(a[3]) for a in sys.argv[1:] if re.fullmatch(r"--x\d", a)), 2)
    dark = "--dark" in sys.argv
    outdir = next((a.split("=", 1)[1] for a in sys.argv[1:] if a.startswith("--out=")), OUTDIR)
    if not args: sys.exit(__doc__)
    if "--svg" in sys.argv:
        for p in args:
            print(write_svg(p, dark, outdir))
        sys.exit(0)
    for p in args:
        out = render(p, scale, dark)
        dim = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", out],
                             capture_output=True, text=True).stdout
        px = re.findall(r"pixel(?:Width|Height): (\d+)", dim)
        print(f"{out}  —  {'×'.join(px)} px")
