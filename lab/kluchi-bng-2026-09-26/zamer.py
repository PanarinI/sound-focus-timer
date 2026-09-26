#!/usr/bin/env python3
"""Ключи под имя Brown Noise Generator — две таблицы канона 2.1.3 (Main 15 + Extra 15), 2026-09-26.
Повод: автор выбрал имя 26.09 («давай Brown noise generator в имя, нужно составить 2 таблицы кейвордов
по канону; вспомни разнообразие семантики, которую мы рыли»).

Пул = подсказки DataForSEO Labs по трём затравкам (канон: Main — «Broad Match», у нас keyword_suggestions)
+ ВСЕ ключи, которые мы уже рыли 24–26.09 (`../imya-adhd-2026-09-24/*.csv`) и 07–08 (`../meta-keywords.md`).
Шаги (каждый пишет цену в spend.log):
  python3 zamer.py suggest   — подсказки по затравкам                       ≈ $0,03 за затравку
  python3 zamer.py volume    — один пакет Google Ads US, ряд за 4 года       ≈ $0,09
  python3 zamer.py kd        — сложность Labs по ключам с объёмом ≥ 30        ≈ $0,01 + $0,0001 за ключ
  python3 zamer.py pool      — сводка pool.csv (бесплатно, из raw/)
"""
import csv, datetime, glob, json, os, re, sys
sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402  мини-клиент студии, ключ из ~/.claude.json

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
os.makedirs(RAW, exist_ok=True)
US = {'location_code': 2840, 'language_code': 'en'}
SEEDS = ['brown noise generator', 'brown noise', 'noise generator']
DUG = os.path.join(HERE, '..', 'imya-adhd-2026-09-24')

# ключи, которые жили в листинге Minimalist Timer и в ревизии 08-31 — их тоже меряем заново
PRIOR = [
    'minimalist timer', 'minimal timer', 'focus timer', 'study timer', 'sound timer', 'noise timer',
    'adhd timer', 'quiet timer', 'gentle timer', 'calm timer', 'aesthetic timer', 'desktop timer',
    'concentration timer', 'brown noise app', 'brown noise black screen', 'deep brown noise',
    'pink noise', 'white noise for focus', 'noise for focus', 'focus noise', 'ambient noise',
    'focus sounds', 'focus music', 'brown noise timer', 'timer with brown noise',
    'brown noise chrome extension', 'white noise chrome extension', 'noise generator chrome extension',
    'brown noise extension', 'pink noise generator', 'white noise generator', 'green noise generator',
    'sound masking', 'noise to block out voices', 'block out talking', 'open office noise',
]


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def spend(step, cost, note=''):
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\t{step}\t${cost:.4f}\t{note}\n")


def ok(k):
    return len(k) <= 80 and len(k.split()) <= 10 and re.fullmatch(r"[a-z0-9 .'&-]+", k) is not None


def suggest():
    for s in SEEDS:
        res, cost = call('dataforseo_labs/google/keyword_suggestions/live',
                         [dict(keyword=s, limit=300, include_seed_keyword=True,
                               order_by=['keyword_info.search_volume,desc'], **US)])
        json.dump(res, open(os.path.join(RAW, f'suggest_{slug(s)}.json'), 'w'), ensure_ascii=False)
        spend('suggest', cost, s)
        r = res[0] if res else {}
        print(f"== {s}: подсказок {len(r.get('items') or [])} · ${cost:.4f}")


def labs():
    out = {}
    for s in SEEDS:
        p = os.path.join(RAW, f'suggest_{slug(s)}.json')
        if not os.path.exists(p):
            continue
        res = json.load(open(p))
        r = res[0] if res else {}
        for it in (r.get('items') or []) + ([r['seed_keyword_data']] if r.get('seed_keyword_data') else []):
            out.setdefault(it['keyword'], (it, s))
    return out


def dug():
    """Все ключи из прошлых раскопок: имя файла = слой семантики."""
    out = {}
    for f in sorted(glob.glob(os.path.join(DUG, '*.csv'))):
        sloj = os.path.basename(f)[:-4]
        for r in csv.DictReader(open(f)):
            k = (r.get('kluch') or '').strip().lower()
            if k and ok(k):
                out.setdefault(k, sloj)
    for k in PRIOR:
        out.setdefault(k, 'листинг MT / ревизия 08-31')
    return out


def kandidaty():
    L, D = labs(), dug()
    keys = {}
    for k, (it, s) in L.items():
        v = (it.get('keyword_info') or {}).get('search_volume') or 0
        if ok(k) and v >= 10:
            keys[k] = f'подсказка: {s}'
    for k, sloj in D.items():
        keys.setdefault(k, sloj)
    return keys


def volume():
    """Пачками по 1000 (цена за запрос, не за ключ). Уже померенное не шлём повторно."""
    keys = list(kandidaty())
    est = set()
    for p in sorted(glob.glob(os.path.join(RAW, 'volume*.json'))):
        est |= {it['keyword'] for it in json.load(open(p))}
    ostatok = [k for k in keys if k not in est]
    for i in range(0, len(ostatok), 1000):
        spisok = ostatok[i:i + 1000]
        res, cost = call('keywords_data/google_ads/search_volume/live',
                         [dict(keywords=spisok, date_from='2022-09-01', **US)])
        n = len(glob.glob(os.path.join(RAW, 'volume*.json'))) + 1
        json.dump(res, open(os.path.join(RAW, f'volume_{n}.json'), 'w'), ensure_ascii=False)
        spend('volume', cost, f'{len(spisok)} ключей, 4 года, пачка {n}')
        print(f"пачка {n}: ключей {len(spisok)} · ответов {len(res)} · ${cost:.4f}")
    print(f"всего кандидатов {len(keys)} · не хватало {len(ostatok)}")


def vse_obemy():
    out = {}
    for p in sorted(glob.glob(os.path.join(RAW, 'volume*.json'))):
        for it in json.load(open(p)):
            out.setdefault(it['keyword'], it)
    return out


def kd():
    vol = vse_obemy()
    L = labs()
    nuzhno = [k for k, it in vol.items() if (it.get('search_volume') or 0) >= 30
              and ((L.get(k) or ({},))[0].get('keyword_properties') or {}).get('keyword_difficulty') is None]
    est = set()
    for p in glob.glob(os.path.join(RAW, 'kd*.json')):
        for r in json.load(open(p)):
            est |= {it['keyword'] for it in r.get('items') or []}
    nuzhno = [k for k in nuzhno if k not in est][:1000]
    if not nuzhno:
        print('сложность: всё уже померено'); return
    res, cost = call('dataforseo_labs/google/bulk_keyword_difficulty/live', [dict(keywords=nuzhno, **US)])
    n = len(glob.glob(os.path.join(RAW, 'kd*.json'))) + 1
    json.dump(res, open(os.path.join(RAW, f'kd_{n}.json'), 'w'), ensure_ascii=False)
    spend('kd', cost, f'{len(nuzhno)} ключей')
    print(f"сложность: {len(nuzhno)} ключей · ${cost:.4f}")


def god(y, m):
    return y if m >= 9 else y - 1  # сезонный год сентябрь→август, как в dinamika.py


def pool():
    keys = kandidaty()
    vol = vse_obemy()
    L = labs()
    kdmap = {}
    for p in glob.glob(os.path.join(RAW, 'kd*.json')):
        for r in json.load(open(p)):
            for it in r.get('items') or []:
                kdmap[it['keyword']] = it.get('keyword_difficulty')
    rows = []
    for k, src in keys.items():
        it = vol.get(k)
        if not it:
            continue
        by = {}
        for m in it.get('monthly_searches') or []:
            by.setdefault(god(m['year'], m['month']), []).append(m.get('search_volume') or 0)
        sred = {g: round(sum(v) / len(v)) for g, v in sorted(by.items()) if len(v) >= 6}
        gg = sorted(sred)
        lab = (L.get(k) or ({},))[0]
        kdv = (lab.get('keyword_properties') or {}).get('keyword_difficulty')
        if kdv is None:
            kdv = kdmap.get(k)
        intent = ((lab.get('search_intent_info') or {}).get('main_intent')) or ''
        row = dict(kluch=k, obem=it.get('search_volume') or 0, kd=kdv if kdv is not None else '',
                   intent=intent, istochnik=src)
        for g in gg:
            row[f'god_{g}'] = sred[g]
        row['za_god'] = f"{(sred[gg[-1]] / sred[gg[-2]] - 1) * 100:+.0f}%" if len(gg) >= 2 and sred[gg[-2]] else ''
        row['za_3_goda'] = f"{(sred[gg[-1]] / sred[gg[-4]] - 1) * 100:+.0f}%" if len(gg) >= 4 and sred[gg[-4]] else ''
        rows.append(row)
    rows.sort(key=lambda r: -r['obem'])
    cols = ['kluch', 'obem', 'kd', 'intent'] + sorted({c for r in rows for c in r if c.startswith('god_')}) + \
           ['za_god', 'za_3_goda', 'istochnik']
    with open(os.path.join(HERE, 'pool.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"пул: {len(rows)} ключей с объёмом → pool.csv")


if __name__ == '__main__':
    {'suggest': suggest, 'volume': volume, 'kd': kd, 'pool': pool}.get(
        sys.argv[1] if len(sys.argv) > 1 else '', lambda: print(__doc__))()
