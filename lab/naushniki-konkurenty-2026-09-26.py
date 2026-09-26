#!/usr/bin/env python3
"""Говорят ли звуковые расширения стора про наушники — вопрос автора 26.09.
(«меня волнует, что у нас нигде нет про наушники… посмотреть, призывают ли эксты со звуком их использовать»)
Дискавери — внутренний поиск стора США (как в переписи census_run.py), $0. По каждой карточке берём полное
описание и ищем упоминания наушников. Выход — naushniki-konkurenty-2026-09-26.csv.
"""
import csv, html as H, os, re, subprocess, sys
sys.path.insert(0, os.path.expanduser('~/PycharmProjects/app-studio/research/lib/sky'))
from census_run import store_search, curl  # noqa: E402

DOORS = ['brown noise', 'white noise', 'noise generator', 'focus sounds', 'ambient sound', 'background noise',
         'rain sounds', 'focus music', 'study music', 'lofi', 'binaural beats']
NAUSH = re.compile(r'head ?phones?|ear ?buds?|headsets?|earphones?|air ?pods', re.I)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'naushniki-konkurenty-2026-09-26.csv')


def card_text(url):
    h = curl(re.sub(r"\?.*", "", url) + "?hl=en")
    mt = re.search(r"<title>([^<]+)", h)
    title = mt.group(1).replace(" - Chrome Web Store", "").strip() if mt else ""
    mu = re.search(r"([\d,\.]+)\s*users", h)
    users = int(re.sub(r"[,\.]", "", mu.group(1))) if mu and re.sub(r"[,\.]", "", mu.group(1)).isdigit() else None
    og = re.search(r'property="og:description"\s+content="([^"]*)"', h)
    short = H.unescape(og.group(1)) if og else ""
    txt = short
    if og:
        m = re.search(r">\s*" + re.escape(og.group(1)[:40]), h)
        if m:
            ps = re.findall(r"<p[^>]*>(.*?)</p>", h[m.start(): m.start() + 20000], re.S)
            txt = H.unescape(re.sub(r"<[^>]+>", " ", " ".join(ps)).replace("\\n", " "))
    return title, users, short, re.sub(r"\s+", " ", txt).strip()


def main():
    urls, door_of = [], {}
    for d in DOORS:
        for u in store_search(d)[:12]:
            if u not in door_of:
                door_of[u] = d; urls.append(u)
    rows = []
    for u in urls:
        title, users, short, txt = card_text(u)
        hits = [m.group(0) for m in NAUSH.finditer(txt)]
        snip = ''
        if hits:
            i = NAUSH.search(txt).start()
            snip = txt[max(0, i - 140): i + 160]
        rows.append(dict(zapros=door_of[u], title=title, users=users or '', naushniki=len(hits),
                         v_kratkom='да' if NAUSH.search(short) else '', dlina=len(txt), fragment=snip, url=u))
        print(f"{len(hits):>2} {'К' if NAUSH.search(short) else ' '} {str(users or ''):>8}  {title[:60]}")
    with open(OUT, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader(); w.writerows(rows)
    s = [r for r in rows if r['naushniki']]
    print(f"\nкарточек {len(rows)} · упоминают наушники {len(s)} · в кратком {sum(1 for r in rows if r['v_kratkom'])}")


if __name__ == '__main__':
    main()
