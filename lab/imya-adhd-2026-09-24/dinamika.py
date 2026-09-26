#!/usr/bin/env python3
"""Динамика дверей за 3 года (Google Ads отдаёт помесячный ряд до 4 лет назад).
Вопрос автора 25.09: «интересно посмотреть динамику за 1 и за 3 года».
Один пакет ≈$0,09. Считаем среднемесячное по «годам» (сентябрь→август) и изменение.
  python3 dinamika.py     → dinamika.csv + печать
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}
KEYS = [
    'brown noise for studying', 'deep focus music', 'focus sounds', 'focus music', 'study music',
    'brown noise generator', 'brown noise', 'brown noise no ads', 'white noise for studying',
    'adhd timer', 'adhd helper', 'visual timer adhd', 'minimalist timer', 'focus timer', 'pomodoro timer',
    'coffee shop sounds', 'work music', 'binaural beats', 'adhd music',
]


def god(y, m):
    """Сезонный год: сентябрь→август. Метка — год начала."""
    return y if m >= 9 else y - 1


def main():
    res, cost = call('keywords_data/google_ads/search_volume/live',
                     [dict(keywords=KEYS, date_from='2022-09-01', **US)])
    json.dump(res, open(os.path.join(HERE, 'raw', 'volume_dinamika.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tdinamika\t${cost:.4f}\t{len(KEYS)} ключей, 4 года\n")
    rows = []
    for it in res:
        ms = it.get('monthly_searches') or []
        by = {}
        for m in ms:
            by.setdefault(god(m['year'], m['month']), []).append(m.get('search_volume') or 0)
        sred = {g: round(sum(v) / len(v)) for g, v in sorted(by.items()) if len(v) >= 6}
        gg = sorted(sred)
        row = dict(kluch=it['keyword'], **{f"god_{g}": sred[g] for g in gg})
        if len(gg) >= 2:
            row['za_god'] = f"{(sred[gg[-1]] / sred[gg[-2]] - 1) * 100:+.0f}%" if sred[gg[-2]] else ''
        if len(gg) >= 4:
            row['za_3_goda'] = f"{(sred[gg[-1]] / sred[gg[-4]] - 1) * 100:+.0f}%" if sred[gg[-4]] else ''
        rows.append(row)
    rows.sort(key=lambda r: -(r.get(f"god_{max(int(k[4:]) for k in r if k.startswith('god_'))}", 0) if any(k.startswith('god_') for k in r) else 0))
    cols = ['kluch'] + sorted({k for r in rows for k in r if k.startswith('god_')}) + ['za_god', 'za_3_goda']
    with open(os.path.join(HERE, 'dinamika.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"ключей {len(KEYS)} · ${cost:.4f} → dinamika.csv\n")
    gods = [c for c in cols if c.startswith('god_')]
    print('  ' + ' '.join(f"{g[4:]:>8}" for g in gods) + f" {'за год':>8} {'за 3 года':>10}  ключ")
    for r in rows:
        print('  ' + ' '.join(f"{str(r.get(g, '-')):>8}" for g in gods) +
              f" {r.get('za_god', ''):>8} {r.get('za_3_goda', ''):>10}  {r['kluch']}")


if __name__ == '__main__':
    main()
