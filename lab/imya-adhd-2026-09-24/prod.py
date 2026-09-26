#!/usr/bin/env python3
"""Слой продуктивности: что ищут вокруг productivity — и есть ли там наша полка.
Повод: мысль автора 25.09 «мы ведь явно про productivity! для adhd».
Два шага в одном прогоне: подсказки Labs по зерну `productivity` (≈$0,02) и пакет своих ключей
Google Ads (≈$0,09 за запрос независимо от числа). Пустой объём = запроса нет ⬜.
  python3 prod.py     → prod.csv + печать
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}

KEYS = [
    # сама полка
    'productivity app', 'productivity apps', 'productivity tools', 'productivity tool', 'productivity extension',
    'productivity chrome extension', 'chrome extension for productivity', 'productivity timer',
    'productivity tracker', 'productivity planner', 'productivity system', 'productivity hacks',
    'productivity booster', 'work productivity app', 'productivity software', 'productivity widget',
    # продуктивность × сдвг
    'adhd productivity', 'productivity for adhd', 'adhd productivity hacks', 'adhd productivity system',
    'productivity apps for adhd', 'best productivity app for adhd', 'productivity tips for adhd',
    # время и задачи
    'time management app', 'time management tool', 'time tracker', 'time tracking app', 'task timer',
    'work timer', 'work timer app', 'deep work app', 'flow state app', 'focus mode', 'focus mode chrome',
    # продуктивность × звук (наш клин)
    'productivity music', 'productivity sounds', 'work music', 'background music for work',
    'office noise', 'coffee shop sounds', 'coffee shop noise', 'cafe sounds for working', 'coworking sounds',
    'ambient noise for work', 'background noise for work', 'background noise for focus', 'работа',
]
KEYS = [k for k in KEYS if k.isascii()]


def main():
    res, cost = call('dataforseo_labs/google/keyword_suggestions/live',
                     [dict(keyword='productivity', limit=100, include_seed_keyword=True, **US)])
    json.dump(res, open(os.path.join(HERE, 'raw', 'suggest_productivity.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tsuggest\t${cost:.4f}\tproductivity\n")
    items = (res[0].get('items') or []) if res else []
    print(f"== подсказки по зерну «productivity»: {len(items)} · ${cost:.4f}")
    for it in sorted(items, key=lambda x: -((x.get('keyword_info') or {}).get('search_volume') or 0))[:25]:
        ki, kp = it.get('keyword_info') or {}, it.get('keyword_properties') or {}
        print(f"   {ki.get('search_volume') or 0:>7}  kd {str(kp.get('keyword_difficulty')):>4}  {it['keyword']}")

    res2, cost2 = call('keywords_data/google_ads/search_volume/live', [dict(keywords=KEYS, **US)])
    json.dump(res2, open(os.path.join(HERE, 'raw', 'volume_prod.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tprod\t${cost2:.4f}\t{len(KEYS)} ключей\n")
    rows = []
    for it in res2:
        ms = sorted(it.get('monthly_searches') or [], key=lambda m: (m['year'], m['month']))[-12:]
        series = [m.get('search_volume') or 0 for m in ms]
        head, tail = (sum(series[:3]) / 3 if series else 0), (sum(series[-3:]) / 3 if series else 0)
        rows.append(dict(kluch=it['keyword'], obem=it.get('search_volume'), avgust=series[-1] if series else None,
                         trend=(f"{(tail/head-1)*100:+.0f}%" if head else ''), mesyacy=' '.join(str(v) for v in series)))
    rows.sort(key=lambda r: -(r['obem'] or 0))
    with open(os.path.join(HERE, 'prod.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"\n== свои ключи: {len(KEYS)} · ${cost2:.4f} → prod.csv")
    for r in rows:
        if r['obem']:
            print(f"   {r['obem']:>7} (авг {str(r['avgust']):>6}) {r['trend']:>7}  {r['kluch']}")
    print("   нет в базе ⬜: " + ', '.join(r['kluch'] for r in rows if not r['obem']))


if __name__ == '__main__':
    main()
