#!/usr/bin/env python3
"""Семантика сильных игроков звука: по каким ключам реально стоят brain.fm и endel.io в Google US.
Мысль автора 25.09: «brain.fm — сильный игрок, изучи семантику ключей Эндела и Брейн-фм, возьмём идеи».
Берём ranked_keywords (Labs): ключ · объём · позиция · адрес страницы. Цена — в spend.log.
  python3 konkurenty.py            — прогон по обоим доменам
Итог: konkurenty.csv, сырьё: raw/ranked_<домен>.json
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}
TARGETS = ['brain.fm', 'endel.io']


def main():
    rows = []
    for t in TARGETS:
        res, cost = call('dataforseo_labs/google/ranked_keywords/live',
                         [dict(target=t, limit=200, load_rank_absolute=True,
                               order_by=['keyword_data.keyword_info.search_volume,desc'], **US)])
        json.dump(res, open(os.path.join(HERE, 'raw', f'ranked_{t.replace(".", "_")}.json'), 'w'), ensure_ascii=False)
        with open(os.path.join(HERE, 'spend.log'), 'a') as f:
            f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tranked\t${cost:.4f}\t{t}\n")
        items = (res[0].get('items') or []) if res else []
        print(f"\n== {t}: {len(items)} ключей в выдаче · ${cost:.4f}")
        print(f"{'объём':>7} {'поз':>4}  ключ")
        for it in items:
            kd = it.get('keyword_data') or {}
            ki = kd.get('keyword_info') or {}
            se = (it.get('ranked_serp_element') or {}).get('serp_item') or {}
            rows.append(dict(igrok=t, kluch=kd.get('keyword'), obem=ki.get('search_volume'),
                             poziciya=se.get('rank_group'), stranica=se.get('url')))
        for r in sorted([r for r in rows if r['igrok'] == t], key=lambda r: -(r['obem'] or 0))[:30]:
            print(f"{str(r['obem']):>7} {str(r['poziciya']):>4}  {r['kluch']}")
    with open(os.path.join(HERE, 'konkurenty.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['igrok', 'kluch', 'obem', 'poziciya', 'stranica'])
        w.writeheader()
        w.writerows(rows)
    print(f"\nвсего строк {len(rows)} → konkurenty.csv")


if __name__ == '__main__':
    main()
