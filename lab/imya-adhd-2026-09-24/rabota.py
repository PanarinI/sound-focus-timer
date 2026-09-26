#!/usr/bin/env python3
"""Ядро 25.09: звук как СОПРОВОЖДЕНИЕ РАБОТЫ И УЧЁБЫ (не сон, не таймер).
Слово автора: «ключ тут — продуктивность, сопровождение работы/учёбы».
Меряем всю семью сопровождения: звук/шум/музыка × работа/учёба/концентрация, плюс кандидаты в имя.
Один пакет Google Ads US ≈$0,09. Пустой объём = запроса нет ⬜.
  python3 rabota.py     → rabota.csv + печать
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}

KEYS = [
    # звук × учёба
    'study music', 'study sounds', 'sounds for studying', 'noise for studying', 'brown noise for studying',
    'white noise for studying', 'music for studying', 'background noise for studying', 'study ambience',
    'study with me sounds', 'library ambience', 'study background noise',
    # звук × работа
    'work music', 'work sounds', 'sounds for working', 'noise for working', 'background noise for work',
    'background music for work', 'office ambience', 'office noise', 'work from home sounds', 'work ambience',
    # звук × концентрация и фокус
    'focus sounds', 'focus noise', 'focus music', 'sounds for focus', 'noise for focus', 'concentration sounds',
    'concentration music', 'music for concentration', 'sounds for concentration', 'deep focus music',
    'deep work music', 'focus background noise', 'ambient sound for focus', 'ambient noise for focus',
    # кафе и окружение (пример Coffitivity)
    'coffee shop sounds', 'coffee shop ambience', 'cafe sounds', 'cafe ambience', 'coffitivity',
    'restaurant ambience', 'rain sounds for studying', 'nature sounds for focus',
    # кандидаты в имя
    'brown noise generator', 'noise generator', 'focus sound generator', 'ambient sound generator',
    'study noise generator', 'work noise generator',
]


def main():
    res, cost = call('keywords_data/google_ads/search_volume/live', [dict(keywords=KEYS, **US)])
    json.dump(res, open(os.path.join(HERE, 'raw', 'volume_rabota.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\trabota\t${cost:.4f}\t{len(KEYS)} ключей\n")
    rows = []
    for it in res:
        ms = sorted(it.get('monthly_searches') or [], key=lambda m: (m['year'], m['month']))[-12:]
        series = [m.get('search_volume') or 0 for m in ms]
        head, tail = (sum(series[:3]) / 3 if series else 0), (sum(series[-3:]) / 3 if series else 0)
        rows.append(dict(kluch=it['keyword'], obem=it.get('search_volume'), avgust=series[-1] if series else None,
                         trend=(f"{(tail/head-1)*100:+.0f}%" if head else ''), mesyacy=' '.join(str(v) for v in series)))
    rows.sort(key=lambda r: -(r['obem'] or 0))
    with open(os.path.join(HERE, 'rabota.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"ключей {len(KEYS)} · ${cost:.4f} → rabota.csv\n")
    for r in rows:
        if r['obem']:
            print(f"   {r['obem']:>7} (авг {str(r['avgust']):>6}) {r['trend']:>7}  {r['kluch']}")
    print("   нет в базе ⬜: " + ', '.join(r['kluch'] for r in rows if not r['obem']))


if __name__ == '__main__':
    main()
