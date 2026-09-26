#!/usr/bin/env python3
"""Соседи имени: семантический прогон вокруг ADHD-таймера, 2026-09-24.
Ищем «чёрные дыры» — двери со спросом, которые никто не держит именем.

Двигатель — DataForSEO Labs: `related_keywords` (семантический граф «похожие запросы», глубина 2)
и `keyword_suggestions` (фразы, содержащие зерно). Объём и 12-месячный ряд берём прямо у Labs —
это те же числа Google Ads, отдельный платный пакет не нужен.

  python3 sosedi.py sbor    — собрать (платно, цена в spend.log)
  python3 sosedi.py svod    — свод из всего сырья папки (бесплатно) → sosedi.csv
Занятость проверяется переписью стора отдельно (census_run.py, $0), софтовость — выдачей ($0,002/ключ).
"""
import csv, datetime, glob, json, os, re, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
US = {'location_code': 2840, 'language_code': 'en'}
SEEDS_REL = ['adhd timer', 'adhd focus']
SEEDS_SUG = ['adhd focus', 'focus timer']

# в имя нельзя (канон 2.1.2) и просто мусор для имени продукта
STOP = re.compile(r'\b(best|free|premium|#1|recommended|reddit|amazon|walmart|etsy|youtube|app store|'
                  r'time timer|timetimer|kids|child|children|toddler|autism|watch|clock cube|'
                  r'meaning|symptoms|medication|test|quiz|definition|vs|near me|for sale|price)\b')


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def spend(step, cost, note=''):
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\t{step}\t${cost:.4f}\t{note}\n")


def sbor():
    for s in SEEDS_REL:
        res, cost = call('dataforseo_labs/google/related_keywords/live',
                         [dict(keyword=s, depth=2, limit=200, include_seed_keyword=True, **US)])
        json.dump(res, open(os.path.join(RAW, f'related_{slug(s)}.json'), 'w'), ensure_ascii=False)
        spend('related', cost, s)
        print(f"related «{s}»: {len((res[0].get('items') or []) if res else [])} строк · ${cost:.4f}")
    for s in SEEDS_SUG:
        p = os.path.join(RAW, f'suggest_{slug(s)}.json')
        if os.path.exists(p):
            print(f"suggest «{s}»: уже снято, пропускаю")
            continue
        res, cost = call('dataforseo_labs/google/keyword_suggestions/live',
                         [dict(keyword=s, limit=100, include_seed_keyword=True, **US)])
        json.dump(res, open(p, 'w'), ensure_ascii=False)
        spend('suggest', cost, s)
        print(f"suggest «{s}»: {len((res[0].get('items') or []) if res else [])} строк · ${cost:.4f}")


def harvest():
    """Все ключи из всего сырья папки: и сегодняшние подсказки, и семантический граф."""
    out = {}
    for p in glob.glob(os.path.join(RAW, '*.json')):
        if os.path.basename(p).startswith('serp_') or os.path.basename(p).startswith('volume'):
            continue
        try:
            res = json.load(open(p))
        except Exception:
            continue
        r = res[0] if isinstance(res, list) and res else {}
        rows = list(r.get('items') or [])
        if r.get('seed_keyword_data'):
            rows.append(r['seed_keyword_data'])
        for it in rows:
            # у related_keywords полезное лежит внутри keyword_data, у suggestions — прямо в строке
            it = it.get('keyword_data') or it
            k = it.get('keyword')
            if not k:
                continue
            ki = it.get('keyword_info') or {}
            kd = (it.get('keyword_properties') or {}).get('keyword_difficulty')
            v = ki.get('search_volume') or 0
            if k not in out or v > out[k]['obem']:
                ms = sorted(ki.get('monthly_searches') or [], key=lambda m: (m['year'], m['month']))[-12:]
                series = [m.get('search_volume') or 0 for m in ms]
                out[k] = dict(kluch=k, obem=v, avgust=series[-1] if series else None, kd=kd,
                              trend_god=(ki.get('search_volume_trend') or {}).get('yearly'),
                              mesyacy=' '.join(str(x) for x in series), istochnik=os.path.basename(p))
    return out


def imya_kandidat(k, v):
    """Годится ли строка в ИМЯ: 2–4 слова, без стоп-слов, со спросом."""
    n = len(k.split())
    return 2 <= n <= 4 and not STOP.search(k) and v >= 200


def svod():
    all_k = harvest()
    rows = sorted(all_k.values(), key=lambda r: -r['obem'])
    with open(os.path.join(HERE, 'sosedi.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['kluch', 'obem', 'avgust', 'kd', 'trend_god', 'kandidat_v_imya', 'mesyacy', 'istochnik'])
        w.writeheader()
        for r in rows:
            w.writerow(dict(r, kandidat_v_imya='да' if imya_kandidat(r['kluch'], r['obem']) else ''))
    print(f"всего ключей в сырье: {len(rows)} → sosedi.csv\n")
    print("── КАНДИДАТЫ В ИМЯ (2–4 слова, без запрещённых слов, от 200/мес) ──")
    print(f"{'объём':>7} {'август':>7} {'kd':>4}  ключ")
    for r in rows:
        if imya_kandidat(r['kluch'], r['obem']):
            print(f"{r['obem']:>7} {str(r['avgust']):>7} {str(r['kd']):>4}  {r['kluch']}")


if __name__ == '__main__':
    step = sys.argv[1] if len(sys.argv) > 1 else ''
    {'sbor': sbor, 'svod': svod}.get(step, lambda: print(__doc__))()
