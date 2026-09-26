#!/usr/bin/env python3
"""Проверка текстов листинга по канону 2.1.3–2.1.6 перед Тургеневым (локально, $0).
Считает: длину, частоты слов и «классическую тошноту» (√ самого частого слова), вхождения каждого
ключа Main/Extra с учётом вхождений в хвосты (канон 2.1.4: «считаем и вхождения ключа в ключи с
хвостами»), запрещённые слова, правила краткого (≤132, ключ имени 1× и не первым словом).
Эталон конверта — текст Minimalist Timer, прошедший Тургенева 09-01: `timer` 31 раз, 3,0 %, тошнота 5,57.
  python3 proverka.py <полное.md> "<краткое>"
"""
import math, re, sys
from collections import Counter

NAME = 'brown noise generator'
MAIN = ['brown noise generator', 'brownian noise generator', 'online brown noise generator', 'brown noise generator app',
        'white brown pink noise generator', 'brown noise', 'brown noise no ads', 'brown noise black screen',
        'brown noise for studying', 'deep brown noise', 'play brown noise', 'smooth brown noise', 'brown noise app',
        'brown noise for adhd', 'white pink brown noise', 'brown noise for focus', 'brown noise for concentration',
        'brown noise for work']
EXTRA = ['pink noise', 'white noise generator', 'white noise for studying', 'pink noise generator', 'white noise for focus',
         'white noise generator for office', 'sound masking', 'white noise for work', 'study sounds', 'ambient noise',
         'noise generator', 'focus sounds', 'ambient noise generator', 'focus noise', 'background noise for studying',
         'focus timer', 'work timer', 'adhd timer', 'minimalist timer', 'white noise for adhd']
BANNED = ['free', 'best', 'premium', 'recommended', '#1']
STOP = set('a an the and or of to in on for is it its it s you your with as at by be this that are no not from so '
           'when there one if i we our what how do does can any all up out into than then until while about who'.split())


def norm(t):
    return ' ' + re.sub(r'\s+', ' ', re.sub(r"[^a-z0-9#]+", ' ', t.lower())).strip() + ' '


def count(text, key):
    return norm(text).count(' ' + ' '.join(norm(key).split()) + ' ')


def main(path, short):
    full = open(path).read()
    # как Тургенев: noisy/noises считаются за noise, sounds — за sound (сверено по прогону автора 26.09)
    LEM = {'noisy': 'noise', 'noises': 'noise', 'sounds': 'sound', 'timers': 'timer'}
    words = [LEM.get(w, w) for w in re.findall(r"[a-z0-9]+", full.lower())]
    freq = Counter(w for w in words if w not in STOP)
    print(f"ПОЛНОЕ: {len(full)} знаков · {len(words)} слов")
    top = freq.most_common(12)
    print('частые: ' + ' · '.join(f"{w} {n} ({n / len(words) * 100:.1f} %)" for w, n in top))
    print(f"частота главного слова {top[0][1] / len(words) * 100:.1f} % — гейт канона 2.1.6: около 3 %, 1–2 вхождения сверху допустимы; "
          f"тошноту канон не проверяет (для справки √{top[0][1]} = {math.sqrt(top[0][1]):.2f})")
    for name, keys in (('MAIN', MAIN), ('EXTRA', EXTRA)):
        rows = [(k, count(full, k)) for k in keys]
        print(f"\n{name}: всего вхождений {sum(n for k, n in rows if k != NAME and ' '.join(k.split()) not in ('brown noise', 'noise generator', 'pink noise', 'ambient noise'))} "
              f"(без ключей-подстрок) · пустых {sum(1 for _, n in rows if n == 0)}")
        for k, n in rows:
            print(f"  {n:>2}  {k}{'   ← ключ имени (канон 7–10)' if k == NAME else ''}{'   ⚠ нет' if n == 0 else ''}")
    low = full.lower()
    bad = [b for b in BANNED if re.search(r'(?<![a-z])' + re.escape(b) + r'(?![a-z])', low) or (b == 'free' and 'free' in low)]
    print(f"\nзапрещённые слова: {bad or 'нет'}")
    cap = len(re.findall(r'Brown Noise Generator', full)); lowname = len(re.findall(r'brown noise generator', full))
    print(f"имя с заглавных {cap} · строчными {lowname} (канон: ~50 % строчными)")
    if short:
        sw = re.findall(r"[a-z0-9]+", short.lower())
        sf = Counter(w for w in sw if w not in STOP)
        first = sw[0] if sw else ''
        print(f"\nКРАТКОЕ: {len(short)} знаков (≤132) · ключ имени {count(short, NAME)}× (нужно 1) · "
              f"первое слово «{first}» {'— не ключ ✓' if first != 'brown' else '— ✗ ключ имени первым словом'}")
        print('  повторы: ' + ' · '.join(f"{w} {n}" for w, n in sf.most_common(5)) + '  (главное слово ≤3, остальные ≤2)')
        keys_in = [k for k in MAIN + EXTRA if count(short, k)]
        print('  ключи: ' + ' · '.join(keys_in))
        print(f"  запрещённые: {[b for b in BANNED if b in short.lower()] or 'нет'}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else '')
