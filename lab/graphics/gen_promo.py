#!/usr/bin/env python3
"""Заказ ПОДЛОЖЕК для графики листинга у генератора (gpt-image-1).

Зачем отдельный файл, а не конвейер логопеда. Там стиль зашит под контурные рисунки без
заливки — «чёрный контур, плоский цвет, белая бумага». Нам нужно ровно обратное: тёплая
светящаяся фактура на ночном фоне. Стиль — не в данных, а здесь, одни правила на весь заказ.

ЧТО ЗАКАЗЫВАЕМ И ЧТО НЕТ. Только ПОДЛОЖКУ — фактуру света. Текст и звезду накладывает код
(`build-promo.py`), потому что генератор рисует буквы криво, а канон `3.1` требует аккуратности:
кривая надпись на витрине хуже отсутствия надписи.

УРОК ЧУЖОГО ОПЫТА (взят из `logoped-generator/tools/gen_kartinki.py`, DECISIONS 08-25):
перечисление запретов НАЗЫВАЕТ предмет, и названное рисуется. Поэтому промпт написан
утверждениями: сказано, что есть в кадре, а не чего в нём быть не должно.

Запуск:  python3 gen_promo.py --dry          # печатает промпты, денег не тратит
         python3 gen_promo.py --only warm    # заказать один вариант
Цена: ~1 цент за картинку на quality:low.
"""
from __future__ import annotations

import argparse, base64, json, os, sys, urllib.request

KEY_PATH = os.path.expanduser("~/.config/logoped/openai.key")
API = "https://api.openai.com/v1/images/generations"
HERE = os.path.dirname(os.path.abspath(__file__))

# Общий стиль заказа: ночь продукта + тёплый свет. Палитра взята из самого расширения
# (#05060f · #131c40 · #FFC061 · #F2941F), чтобы подложка и панель были одной кожей.
STYLE = (
    "Abstract background texture, no objects, no letters, no numbers, no logo. "
    "Deep midnight-navy field, almost black at the edges, with warm amber and honey light "
    "glowing from within it. Colours are exactly: near-black navy #05060f, deep blue #131c40, "
    "warm amber #FFC061, ember orange #F2941F. "
    "Smooth, calm, softly out of focus, generous empty space, nothing sharp. "
    "The image reads as warmth and quiet, like a lamp seen through night air. "
)

# Три подхода к одному и тому же: чем ощущается звук. Отбираем глазом автора.
PROMPTS = {
    # 1. Звук как тепло, идущее волнами — самое прямое прочтение «время сделано из звука»
    "waves": STYLE + (
        "Wide slow concentric bands of warm amber light spreading outward through the dark, "
        "like heat rising or a sound spreading through air, each band softer than the last."
    ),
    # 2. Звук как укрытие — прямая иллюстрация маскировки: тёплый купол внутри холодной ночи
    "dome": STYLE + (
        "A single wide dome of warm amber haze holding the lower centre of the frame, "
        "the cold blue night resting outside it, the boundary soft and diffuse."
    ),
    # 3. Звук как плотная тёплая ткань — ближе к «тёплой подушке» brown-шума
    "cloth": STYLE + (
        "A dense soft field of warm amber grain, like very fine warm dust or velvet lit from "
        "behind, thinning into deep blue darkness towards the corners."
    ),
}

SIZE = "1536x1024"    # 3:2 — ближайшее к плитке 440×280 (1.57); модель умеет 1:1, 2:3, 3:2


def draw(name: str, prompt: str, out: str, key: str) -> str:
    body = json.dumps({"model": "gpt-image-1", "prompt": prompt, "n": 1,
                       "size": SIZE, "quality": "low"}).encode()
    req = urllib.request.Request(API, data=body, headers={
        "Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = json.loads(resp.read())
    path = os.path.join(out, f"promo-bg-{name}.png")
    with open(path, "wb") as fh:
        fh.write(base64.b64decode(data["data"][0]["b64_json"]))
    return path


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "gen"))
    ap.add_argument("--only", default="")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args(argv)

    want = {s.strip() for s in args.only.split(",") if s.strip()}
    items = {k: v for k, v in PROMPTS.items() if not want or k in want}

    if args.dry:
        for k, v in items.items():
            print(f"\n=== {k} ({SIZE}) ===\n{v}")
        print(f"\n[dry] {len(items)} шт., денег не потрачено")
        return 0

    with open(KEY_PATH, encoding="utf-8") as fh:
        key = fh.read().strip()
    os.makedirs(args.out, exist_ok=True)
    for k, v in items.items():
        print("→", draw(k, v, args.out, key))
    print(f"готово → {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
