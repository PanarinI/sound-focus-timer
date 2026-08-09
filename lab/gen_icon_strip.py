#!/usr/bin/env python3
"""Полоска состояний иконки-таймера для страницы хаба.

    python3 lab/gen_icon_strip.py

Рисует НАСТОЯЩИЙ `extension/icon.js` — тот же файл, что работает в service worker.
Не иллюстрация иконки, а сама иконка в шести положениях.

Зачем полоска вообще (правка автора 08-09): на странице стоял абзац прозы про то,
что иконка несёт дугу оставшегося пути. Описание того, что можно показать, — лишний
текст. Закон автора: «меньше текста лучше, чем больше; текст должен быть редким —
только если нельзя показать».
"""
import json, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = os.path.join(ROOT, "..", "panarini.github.io", "projects", "img", "icon-states.png")

CELL, PAD, LABEL_H = 108, 26, 34
STATES = [(1.0, False, "start"), (0.75, False, "¾ of the way"), (0.5, False, "half"),
          (0.25, False, "¼ left"), (0.04, False, "arriving"), (0.6, True, "paused")]
W = len(STATES) * CELL + (len(STATES) + 1) * PAD
H = CELL + PAD * 2 + LABEL_H

HTML = f"""<!doctype html><meta charset="utf-8">
<style>
  html,body{{margin:0;background:#0f0f11}}
  .row{{display:flex;gap:{PAD}px;padding:{PAD}px}}
  .cell{{width:{CELL}px;text-align:center}}
  canvas{{width:{CELL}px;height:{CELL}px;display:block;image-rendering:auto}}
  span{{display:block;margin-top:10px;font:11.5px/1.3 system-ui,-apple-system,sans-serif;color:#8d8981}}
</style>
<div class="row" id="row"></div>
<script src="../extension/icon.js"></script>
<script>
  // список приходит из питона через JSON: питоновский repr дал бы False вместо false
  const S = {json.dumps([[s[0], s[1], s[2]] for s in STATES])};
  const row = document.getElementById('row');
  for (const [frac, paused, label] of S) {{
    const cell = document.createElement('div'); cell.className = 'cell';
    const c = document.createElement('canvas'); c.width = c.height = {CELL};
    c.getContext('2d').putImageData(drawTimerIcon({CELL}, frac, paused), 0, 0);
    const s = document.createElement('span'); s.textContent = label;
    cell.appendChild(c); cell.appendChild(s); row.appendChild(cell);
  }}
</script>"""

with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8", dir=HERE) as f:
    f.write(HTML); tmp = f.name
subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                "--force-device-scale-factor=2", f"--window-size={W},{H}",
                f"--screenshot={os.path.abspath(OUT)}", f"file://{tmp}"],
               check=True, capture_output=True)
os.unlink(tmp)
dim = subprocess.run(["sips", "-g", "pixelWidth", "-g", "pixelHeight", OUT],
                     capture_output=True, text=True).stdout.split()
print(f"{os.path.normpath(OUT)} — {dim[-3]}×{dim[-1]} px")
