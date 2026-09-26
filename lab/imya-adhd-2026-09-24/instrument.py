#!/usr/bin/env python3
"""Инструментальность в семантике: ищем слова-инструменты вокруг adhd · focus · noise · study.
Мысль автора 25.09: «инструменты говоришь... а какую-то инструментальность мы можем найти в семантике?
условно adhd helpER». Проверяем весь слой суффиксов-инструментов одним пакетом Google Ads (≈$0,09 за
запрос независимо от числа ключей). Пустой ответ = такого запроса в базе нет — тоже результат ⬜.
  python3 instrument.py            — прогон и печать по убыванию объёма
Итог: instrument.csv, сырьё: raw/volume_instrument.json, цена: spend.log
"""
import csv, datetime, json, os, sys

sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
US = {'location_code': 2840, 'language_code': 'en'}

KEYS = [
    # adhd × слово-инструмент
    'adhd helper', 'adhd helper app', 'adhd assistant', 'adhd app', 'adhd apps', 'adhd tool', 'adhd tools',
    'adhd planner', 'adhd organizer', 'adhd tracker', 'adhd reminder app', 'adhd alarm', 'adhd buddy',
    'adhd coach app', 'adhd companion', 'adhd focus tool', 'adhd focus app', 'adhd productivity tool',
    'adhd productivity app', 'adhd task manager', 'adhd to do list', 'adhd time tracker',
    'adhd time management app', 'adhd study tool', 'adhd extension', 'adhd widget', 'adhd dashboard',
    'adhd body double', 'body doubling app', 'adhd focus assistant', 'adhd sound machine', 'adhd noise machine',
    'adhd white noise machine', 'adhd brown noise app', 'adhd focus generator',
    # focus × слово-инструмент
    'focus helper', 'focus assistant', 'focus tool', 'focus tools', 'focus app', 'focus apps', 'focus buddy',
    'focus coach', 'focus companion', 'focus widget', 'focus extension', 'focus dashboard', 'focus station',
    'focus booster', 'focus enhancer', 'focus machine', 'focus generator', 'focus sound generator',
    'focus noise generator', 'focus music generator', 'focus sound machine',
    # шум × слово-инструмент
    'noise machine', 'white noise machine', 'brown noise machine', 'brown noise app', 'brown noise player',
    'brown noise website', 'noise maker', 'noise player', 'noise app', 'sound machine',
    'ambient sound generator', 'background noise generator', 'noise generator online', 'online noise generator',
    # учёба и внимание
    'study helper', 'study tool', 'study app', 'study assistant', 'study buddy', 'study companion',
    'study timer online', 'study focus app', 'concentration app', 'concentration tool', 'concentration timer',
    'attention trainer', 'attention tool',
    # помодоро и время
    'pomodoro app', 'pomodoro tool', 'pomodoro extension', 'pomodoro helper',
    'time blindness app', 'time blindness tool', 'time awareness app', 'time perception app',
]


def main():
    res, cost = call('keywords_data/google_ads/search_volume/live', [dict(keywords=KEYS, **US)])
    json.dump(res, open(os.path.join(HERE, 'raw', 'volume_instrument.json'), 'w'), ensure_ascii=False)
    with open(os.path.join(HERE, 'spend.log'), 'a') as f:
        f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tinstrument\t${cost:.4f}\t{len(KEYS)} ключей\n")
    rows = []
    for it in res:
        ms = sorted(it.get('monthly_searches') or [], key=lambda m: (m['year'], m['month']))[-12:]
        series = [m.get('search_volume') or 0 for m in ms]
        head, tail = (sum(series[:3]) / 3 if series else 0), (sum(series[-3:]) / 3 if series else 0)
        rows.append(dict(kluch=it['keyword'], obem=it.get('search_volume'), avgust=series[-1] if series else None,
                         trend=(f"{(tail/head-1)*100:+.0f}%" if head else ('новый' if tail else '')),
                         konkurenciya=it.get('competition'), mesyacy=' '.join(str(v) for v in series)))
    rows.sort(key=lambda r: -(r['obem'] or 0))
    with open(os.path.join(HERE, 'instrument.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"ключей {len(KEYS)} · ответов {len(res)} · ${cost:.4f} → instrument.csv\n")
    print(f"{'объём':>7} {'август':>7} {'год':>7}  ключ")
    nul = []
    for r in rows:
        if r['obem']:
            print(f"{r['obem']:>7} {str(r['avgust']):>7} {r['trend']:>7}  {r['kluch']}")
        else:
            nul.append(r['kluch'])
    print(f"\nнет в базе ⬜ ({len(nul)}): " + ', '.join(nul))


if __name__ == '__main__':
    main()
