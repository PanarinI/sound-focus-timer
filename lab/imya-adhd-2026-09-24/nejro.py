#!/usr/bin/env python3
"""Нейро-слой: спрос вокруг binaural / brainwaves / alpha-gamma — тот, на котором стоит brain.fm.
Повод: 25.09 автор снял наш самодельный запрет на нейро-обещания и спросил, что там вообще ищут.
Один пакет Google Ads (US), цена ≈$0,09 независимо от числа ключей. Пустой объём = запроса нет ⬜.
  python3 nejro.py     → nejro.csv + печать по убыванию
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}

KEYS = [
    'binaural beats', 'binaural beats for focus', 'binaural beats for studying', 'binaural beats for adhd',
    'binaural beats app', 'binaural beats generator', 'isochronic tones', 'brainwave entrainment', 'brainwaves',
    'brain waves for focus', 'alpha waves', 'alpha waves music', 'alpha wave generator', 'gamma waves',
    'gamma waves music', 'gamma brainwave', '40 hz binaural beats', '40 hz gamma', 'theta waves', 'delta waves',
    'neuroacoustic music', 'focus frequency', 'concentration frequency', 'hz for focus', 'frequency for focus',
    'sound frequency for focus', 'adhd binaural beats', 'adhd brain waves', 'adhd frequency', 'brain fm',
    'brain fm alternative', 'endel alternative', 'focus music app', 'music for concentration', 'study music',
    'white noise for focus', 'noise for concentration', 'sound for focus', 'dopamine music adhd',
    'brown noise dopamine', 'music that helps you focus', 'sounds that help you focus',
]


def main():
    res, cost = call('keywords_data/google_ads/search_volume/live', [dict(keywords=KEYS, **US)])
    json.dump(res, open(os.path.join(HERE, 'raw', 'volume_nejro.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tnejro\t${cost:.4f}\t{len(KEYS)} ключей\n")
    rows = []
    for it in res:
        ms = sorted(it.get('monthly_searches') or [], key=lambda m: (m['year'], m['month']))[-12:]
        series = [m.get('search_volume') or 0 for m in ms]
        head, tail = (sum(series[:3]) / 3 if series else 0), (sum(series[-3:]) / 3 if series else 0)
        rows.append(dict(kluch=it['keyword'], obem=it.get('search_volume'), avgust=series[-1] if series else None,
                         trend=(f"{(tail/head-1)*100:+.0f}%" if head else ''), mesyacy=' '.join(str(v) for v in series)))
    rows.sort(key=lambda r: -(r['obem'] or 0))
    with open(os.path.join(HERE, 'nejro.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"ключей {len(KEYS)} · ${cost:.4f} → nejro.csv\n")
    for r in rows:
        if r['obem']:
            print(f"{r['obem']:>7} (авг {str(r['avgust']):>6}) {r['trend']:>7}  {r['kluch']}")
    print("нет в базе ⬜: " + ', '.join(r['kluch'] for r in rows if not r['obem']))


if __name__ == '__main__':
    main()
