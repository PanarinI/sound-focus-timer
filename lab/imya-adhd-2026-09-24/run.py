#!/usr/bin/env python3
"""Имя продукта: дверь ADHD — перезамер спроса Google US, 2026-09-24.
Повод: решение автора 24.09 — ограничение «ADHD только в SEO-теле, не в публичном лице» снято;
кандидат в имя — `adhd timer`. Прежние числа (12.07) устарели, по этому ключу DFS шумел (🔶
`lab/seo-revision-2026-08-31.md`). `visual timer adhd` из семьи исключён: продукт аудиальный, не визуальный.
Занятость стора мерена отдельно переписью 24.09 (`census-adhd-2026-09-24.log`).

Шаги: python3 run.py suggest | volume | serp "k1" "k2"
Сырьё — raw/, итог — keys.csv и serp.md, цена каждого шага — spend.log."""
import csv, datetime, json, os, re, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402  мини-клиент студии, ключ из ~/.claude.json

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
os.makedirs(RAW, exist_ok=True)
US = {'location_code': 2840, 'language_code': 'en'}

GROUPS = {
    'adhd-таймер': [
        'adhd timer', 'timer for adhd', 'adhd timer app', 'adhd timer for adults', 'best adhd timer',
        'adhd timer online', 'adhd timer extension', 'adhd timer chrome extension', 'adhd focus timer',
        'adhd study timer', 'adhd work timer', 'adhd pomodoro timer', 'pomodoro timer for adhd',
        'adhd countdown timer', 'time blindness timer', 'timer for time blindness', 'adhd time timer',
    ],
    'adhd+звук (наш клин)': [
        'brown noise for adhd', 'brown noise adhd', 'white noise for adhd', 'pink noise for adhd',
        'noise for adhd', 'noise for adhd focus', 'adhd focus sounds', 'focus sounds for adhd',
        'adhd background noise', 'brown noise timer', 'timer with brown noise', 'noise timer',
        'brown noise for focus', 'adhd music', 'sounds for adhd focus',
    ],
    'adhd+расширение': [
        'adhd chrome extension', 'chrome extension for adhd', 'adhd browser extension', 'adhd focus app',
        'focus app for adhd', 'adhd productivity app', 'adhd focus tool',
    ],
    'наши нынешние двери': [
        'minimalist timer', 'minimal timer', 'calm timer', 'quiet timer', 'gentle timer', 'aesthetic timer',
        'silent timer', 'visual timer adhd', 'visual timer', 'focus timer', 'study timer', 'pomodoro timer',
        'simple timer', 'deep work timer',
    ],
    'звук (якоря)': [
        'brown noise', 'brown noise generator', 'noise generator', 'white noise generator',
        'pink noise generator', 'focus sounds', 'brown noise for studying', 'brown noise no ads',
    ],
}
SEEDS = ['adhd timer', 'noise for adhd']


def slug(s):
    return re.sub(r'[^a-z0-9]+', '_', s.lower()).strip('_')


def save(name, obj):
    with open(os.path.join(RAW, name), 'w') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)


def spend(step, cost, note=''):
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\t{step}\t${cost:.4f}\t{note}\n")


def suggest():
    for s in SEEDS:
        res, cost = call('dataforseo_labs/google/keyword_suggestions/live',
                         [dict(keyword=s, limit=100, include_seed_keyword=True, **US)])
        save(f'suggest_{slug(s)}.json', res)
        spend('suggest', cost, s)
        r = res[0] if res else {}
        items = r.get('items') or []
        print(f"== {s}: подсказок {len(items)} · ${cost:.4f}")
        for it in sorted(items, key=lambda x: -((x.get('keyword_info') or {}).get('search_volume') or 0))[:25]:
            ki, kp = it.get('keyword_info') or {}, it.get('keyword_properties') or {}
            print(f"   {ki.get('search_volume') or 0:>7}  kd {kp.get('keyword_difficulty')}  {it['keyword']}")


def labs_items():
    out = {}
    for s in SEEDS:
        p = os.path.join(RAW, f'suggest_{slug(s)}.json')
        if not os.path.exists(p):
            continue
        res = json.load(open(p))
        r = res[0] if res else {}
        for it in (r.get('items') or []) + ([r['seed_keyword_data']] if r.get('seed_keyword_data') else []):
            out[it['keyword']] = it
    return out


def ok_for_ads(k):
    return len(k) <= 80 and len(k.split()) <= 10 and re.fullmatch(r"[a-z0-9 .'&-]+", k) is not None


def volume():
    group_of = {k: g for g, ks in GROUPS.items() for k in ks}
    labs = labs_items()
    for k, it in labs.items():
        if k not in group_of and ((it.get('keyword_info') or {}).get('search_volume') or 0) >= 100 and ok_for_ads(k):
            group_of[k] = 'подсказка Labs'
    keys = list(dict.fromkeys(list(group_of)))[:1000]
    res, cost = call('keywords_data/google_ads/search_volume/live', [dict(keywords=keys, **US)])
    save('volume_us.json', res)
    spend('volume_us', cost, f'{len(keys)} ключей')
    rows = []
    for it in res:
        k = it['keyword']
        ms = sorted(it.get('monthly_searches') or [], key=lambda m: (m['year'], m['month']))[-12:]
        series = [m.get('search_volume') or 0 for m in ms]
        head, tail = sum(series[:3]) / 3 if series else 0, sum(series[-3:]) / 3 if series else 0
        trend = f"{(tail / head - 1) * 100:+.0f}%" if head else ('новый' if tail else '')
        kp = (labs.get(k) or {}).get('keyword_properties') or {}
        rows.append(dict(kluch=k, gruppa=group_of.get(k, '?'), obem_us_mes=it.get('search_volume'),
                         posledniy_mesyac=series[-1] if series else None, kd_labs=kp.get('keyword_difficulty'),
                         konkurenciya_ads=it.get('competition'), trend_3m_k_3m=trend,
                         mesyacy=' '.join(str(v) for v in series),
                         s=f"{ms[0]['year']}-{ms[0]['month']:02d}" if ms else '',
                         po=f"{ms[-1]['year']}-{ms[-1]['month']:02d}" if ms else ''))
    order = list(GROUPS) + ['подсказка Labs']
    rows.sort(key=lambda r: (order.index(r['gruppa']) if r['gruppa'] in order else 99, -(r['obem_us_mes'] or 0)))
    with open(os.path.join(HERE, 'keys.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"ключей {len(keys)} · ответов {len(res)} · ${cost:.4f} → keys.csv\n")
    g = None
    for r in rows:
        if r['gruppa'] != g:
            g = r['gruppa']
            print(f"── {g}")
        print(f"   {str(r['obem_us_mes']):>7} (авг {str(r['posledniy_mesyac']):>6})  kd {str(r['kd_labs']):>4}  {r['trend_3m_k_3m']:>7}  {r['kluch']}")


def serp(keys):
    lines = []
    for k in keys:
        res, cost = call('serp/google/organic/live/advanced', [dict(keyword=k, depth=10, **US)])
        save(f'serp_{slug(k)}.json', res)
        spend('serp', cost, k)
        items = (res[0].get('items') if res else None) or []
        kinds = sorted({i.get('type') for i in items})
        lines.append(f"\n## `{k}` — Google US, верхние 10 · ${cost:.4f}\nблоки выдачи: {', '.join(kinds)}\n")
        for i in items:
            if i.get('type') == 'organic':
                lines.append(f"{i.get('rank_group')}. {i.get('domain')} — {i.get('title')}  \n   {i.get('url')}")
    with open(os.path.join(HERE, 'serp.md'), 'a') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))


if __name__ == '__main__':
    step = sys.argv[1] if len(sys.argv) > 1 else ''
    {'suggest': suggest, 'volume': volume}.get(step, lambda: serp(sys.argv[2:]) if step == 'serp' else print(__doc__))()
