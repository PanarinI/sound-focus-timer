#!/usr/bin/env python3
"""Слой ambient: как ещё называют то, что мы делаем (генеративный звук, а не треки).
Вопрос автора 25.09: «focus music — ищут именно музыку, а у нас что? это можно отнести к ambient?
а нет ключей с эмбиент?»
Пакет Google Ads с `date_from` — объём И четырёхлетний ряд за одну цену ≈$0,09.
  python3 ambient.py     → ambient.csv + печать (годы сентябрь→август)
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}
KEYS = [
    'adhd sounds', 'sounds for adhd', 'adhd noise', 'adhd white noise', 'white noise for adhd', 'adhd brown noise',
    'brown noise for adhd', 'adhd sound therapy', 'adhd focus noise', 'adhd study sounds', 'adhd work sounds',
    'white noise for studying', 'white noise for work', 'white noise for focus', 'white noise for concentration',
    'white noise for homework', 'white noise studying', 'white noise office', 'office white noise',
    'brown noise for work', 'brown noise for focus', 'brown noise for concentration', 'brown noise for productivity',
    'brown noise for homework', 'noise for productivity', 'noise for work', 'study noise', 'work noise',
    'homework noise', 'noise while studying', 'sounds while studying', 'best noise for studying',
    'does white noise help you study', 'white noise vs brown noise', 'study sounds app', 'focus noise app',
    'focus music', 'brown noise for studying', 'ambient sounds', 'ambient noise', 'ambient music for studying',
    'ambient music for work', 'ambient sounds for focus', 'ambient noise generator', 'ambient sound generator',
    'ambient mixer', 'ambient sounds app', 'ambient focus music', 'ambient study music', 'ambient background noise',
    'ambient soundscape', 'soundscape', 'soundscape generator', 'soundscapes app',
    'generative music', 'generative ambient', 'generative audio', 'drone music', 'drone sounds',
    'sound masking', 'noise masking', 'sound masking app', 'background ambience', 'atmospheric sounds',
    'lofi', 'lofi music', 'lofi study music', 'lofi radio', 'chillhop',
    'nature sounds', 'rain sounds', 'white noise', 'pink noise', 'green noise',
    'focus music', 'brown noise for studying', 'focus sounds',
]


def god(y, m):
    return y if m >= 9 else y - 1


def main():
    res, cost = call('keywords_data/google_ads/search_volume/live',
                     [dict(keywords=KEYS, date_from='2022-09-01', **US)])
    json.dump(res, open(os.path.join(HERE, 'raw', 'volume_shum.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tshum\t${cost:.4f}\t{len(KEYS)} ключей, 4 года\n")
    rows = []
    for it in res:
        by = {}
        for m in (it.get('monthly_searches') or []):
            by.setdefault(god(m['year'], m['month']), []).append(m.get('search_volume') or 0)
        sred = {g: round(sum(v) / len(v)) for g, v in sorted(by.items()) if len(v) >= 6}
        gg = sorted(sred)
        row = dict(kluch=it['keyword'], **{f"god_{g}": sred[g] for g in gg})
        row['za_god'] = (f"{(sred[gg[-1]] / sred[gg[-2]] - 1) * 100:+.0f}%" if len(gg) >= 2 and sred[gg[-2]] else '')
        row['za_3_goda'] = (f"{(sred[gg[-1]] / sred[gg[-4]] - 1) * 100:+.0f}%" if len(gg) >= 4 and sred[gg[-4]] else '')
        row['_last'] = sred[gg[-1]] if gg else 0
        rows.append(row)
    rows.sort(key=lambda r: -r['_last'])
    cols = ['kluch'] + sorted({k for r in rows for k in r if k.startswith('god_')}) + ['za_god', 'za_3_goda']
    with open(os.path.join(HERE, 'shum.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(rows)
    gods = [c for c in cols if c.startswith('god_')]
    print(f"ключей {len(KEYS)} · ${cost:.4f} → ambient.csv\n")
    print('  ' + ' '.join(f"{g[4:]:>8}" for g in gods) + f" {'год':>7} {'3 года':>8}  ключ")
    for r in rows:
        print('  ' + ' '.join(f"{str(r.get(g, '-')):>8}" for g in gods) +
              f" {r['za_god']:>7} {r['za_3_goda']:>8}  {r['kluch']}")


if __name__ == '__main__':
    main()
