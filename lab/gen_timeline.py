#!/usr/bin/env python3
"""Хронология внешности проекта — из гита, а не руками.

    python3 lab/gen_timeline.py            # снять кадры и напечатать фрагмент HTML
    python3 lab/gen_timeline.py --list     # только показать, какие коммиты нашлись

Задача (слово автора 08-10): полоска «было · сейчас · будет» не должна быть хардкодом.
У проекта есть внешность, она менялась, и история этих изменений уже лежит в гите —
значит кадры надо ДОСТАВАТЬ, а не выбирать вручную раз и навсегда.

Как работает: для каждого коммита, тронувшего видимую поверхность, разворачиваем дерево
этого коммита во временную папку (`git archive`) и снимаем панель headless-Chrome.
Ничего не рисуем: каждый кадр — настоящая панель того дня, поднятая из истории.

Чего скрипт НЕ делает и делать не должен:
— не решает, какие кадры оставить. Соседние коммиты часто выглядят одинаково; выбор
  «здесь внешность действительно сменилась» — человеческий, кадры отбирает автор.
— не знает про периоды, когда исходников в гите ещё не было. Там кадр может дать
  только автор (скриншот из переписки, из стора, из памяти) — спрашивать его.
"""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT = os.path.abspath(os.path.join(ROOT, "..", "panarini.github.io", "projects", "img", "timeline"))
W, H = 760, 440

# видимые поверхности панели по эпохам, от новой к старой. Первый найденный в коммите — и снимаем.
SURFACES = ["extension/hearth.html", "extension/orb.html",
            "extension/sidepanel.html", "extension/ui.html"]

def git(*a):
    return subprocess.run(["git", "-C", ROOT, *a], capture_output=True, text=True).stdout.strip()

def commits():
    seen, out = set(), []
    for path in SURFACES:
        # сортируем по ПОЛНОЙ метке времени, не по дате: 26 июля палитра менялась дважды
        # за день, и по одной дате кадры вставали в обратном порядке
        log = git("log", "--follow", "--date=iso-strict", "--pretty=%H|%ad|%s", "--", path)
        for line in filter(None, log.splitlines()):
            sha, ts, subj = line.split("|", 2)
            if sha in seen: continue
            seen.add(sha); out.append({"sha": sha, "short": sha[:7], "ts": ts, "date": ts[:10],
                                       "subject": subj, "surface": path})
    return sorted(out, key=lambda c: c["ts"])

def shoot(c, tmp):
    d = os.path.join(tmp, c["short"]); os.makedirs(d, exist_ok=True)
    tar = subprocess.run(["git", "-C", ROOT, "archive", c["sha"], "extension"],
                         capture_output=True)
    subprocess.run(["tar", "-x", "-C", d], input=tar.stdout, check=False)
    page = None
    for s in SURFACES:                       # берём самую новую поверхность, что есть в коммите
        p = os.path.join(d, s)
        if os.path.exists(p): page = p; break
    if not page: return None
    os.makedirs(OUT, exist_ok=True)
    name = f'{c["date"]}-{c["short"]}.png'
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={W},{H}", "--virtual-time-budget=2500",
                    f"--screenshot={os.path.join(OUT, name)}", f"file://{page}"],
                   check=False, capture_output=True)
    got = os.path.join(OUT, name)
    return name if os.path.exists(got) else None

if __name__ == "__main__":
    cs = commits()
    if "--list" in sys.argv:
        for c in cs: print(f'{c["date"]}  {c["short"]}  {os.path.basename(c["surface"]):<16} {c["subject"][:60]}')
        sys.exit(0)
    frames = []
    with tempfile.TemporaryDirectory() as tmp:
        for c in cs:
            n = shoot(c, tmp)
            print(("снят  " if n else "ПУСТО ") + f'{c["date"]} {c["short"]} {os.path.basename(c["surface"])}')
            if n: frames.append({**c, "file": n})
    man = os.path.join(OUT, "frames.json")
    json.dump(frames, open(man, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nкадров: {len(frames)} → {OUT}\nманифест: {man}")
    print("\n--- фрагмент для страницы (подписи дописать руками: подпись = ЧТО изменилось) ---")
    for f in frames:
        print(f'  <figure class="tl"><span data-zoom="img/timeline/{f["file"]}">'
              f'<img src="img/timeline/{f["file"]}" alt=""></span>'
              f'<figcaption><time>{f["date"]}</time> …</figcaption></figure>')
