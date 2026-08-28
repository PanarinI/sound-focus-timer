#!/usr/bin/env python3
"""Кадр «ощущение звука» — заказ у генератора ЧЕРЕЗ РЕФЕРЕНСЫ (`/v1/images/edits`).

Почему не `generations`. Первый заказ (08-27, `gen_promo.py`) шёл текстом без картинок и вернул
одинаковое оранжевое пятно на все три промпта — тот самый слоп. Автор напомнил: у нас есть
референсы, и с ними результат обычно попадает. `/v1/images/edits` принимает входные изображения
(multipart, поле `image[]`) — модель держит палитру и настроение наших же файлов.

Что заказываем. НЕ абстракцию (её кодом делать точнее), а СЦЕНУ: тёплое укрытие вокруг работы и
холодный мир снаружи. Это «что с тобой происходит от звука», а не «здесь есть звук». Людей рисуем
только со спины и мелко — лица и руки генератор портит, а на витрине это читается как дешёвка.

Запуск: python3 gen_feel.py --dry | python3 gen_feel.py --only dome
"""
from __future__ import annotations
import argparse, base64, json, mimetypes, os, sys, urllib.request, uuid

KEY_PATH = os.path.expanduser("~/.config/logoped/openai.key")
API = "https://api.openai.com/v1/images/edits"
HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = "1536x1024"          # 3:2 — ближайшее к кадру листинга 1280×800

# Референсы: наша плитка (палитра и характер свечения) и реальная панель (ночная синь продукта).
# Референсы: уже принятая сцена (композиция и свет) + наша плитка (палитра). Так перерисовка
# остаётся ТОЙ ЖЕ сценой, только в другой манере, а не новой картинкой.
REFS = [os.path.join(HERE, "gen", "feel-far.png")]

# ЧТО НА КАДРЕ — одно и то же во всех манерах; меняется только КАК нарисовано.
# Правки автора 08-27: (1) человек не должен быть манекеном из фотостока — нужна рисованная рука;
# (2) уют И фокус одновременно; (3) без стилевой нишевости — аудиторию мы ещё не знаем, а узкая
# манера отсекает тех, кого мы не разглядели.
# Задача второго круга (слово автора 08-27): не «манера вообще», а РУКА — чтобы сказали «блин,
# как уютно», а не «это сделал ИИ». Против ИИ-вида работает МАТЕРИАЛ и НЕРОВНОСТЬ: видимый мазок,
# зерно бумаги, непопадание краски в контур, сухая кисть. Против пустоты — несколько тёплых вещей
# в комнате. Против «медиокра» — несимметричная композиция и ограниченная палитра.
# ТРЕТИЙ КРУГ (слово автора 08-27): уйти в армянскую живописную традицию — там сходится ровно то,
# что он помнит: сюр, неровность, своя колористика и упрощённые формы. Черты выверены по источникам,
# а не по памяти: у армянской модернистской школы — насыщенные плоскости цвета, упрощённые массивные
# формы, влияние Гогена и Матисса (плоский цвет, выраженный контур), «пятнистый» живой мазок,
# слегка нереальная композиция; у Минаса — резкие цветовые контрасты и лиричность.
# ⚠️ Конкретных художников в промпте НЕ называем: подражание руке живого или недавнего автора мы не
# заказываем. Просим ТРАДИЦИЮ и её признаки — школа, а не подпись.
# ДОВОДКА СВЕТА (08-27). Сцена принята, менять её нельзя — правится только жизнь в ней:
# спина сливается с фоном, и экран не светит. Просим ровно две вещи и держим композицию референсом.
SCENE = ("Keep this exact scene and composition: a dark wide room at night, a person seen from behind, "
         "small and low in the frame, at a desk with a laptop, cold pale streaks of light in the darkness. ")

PROMPTS = {
    "rim": SCENE + (
        "Change only the light: a warm amber rim of light along the person's shoulders and the back of "
        "the head, separating them from the dark room, and the laptop screen glowing brighter, spilling "
        "warm light onto the desk. Everything else identical."
    ),
    "rim-soft": SCENE + (
        "Change only the light: a faint warm edge along the person's shoulders so the silhouette no "
        "longer merges with the background, and a living glow from the screen. Keep it subtle and dark, "
        "nothing bright, everything else identical."
    ),
}


def draw(name: str, prompt: str, out: str, key: str) -> str:
    boundary = uuid.uuid4().hex
    parts = []
    def field(k, v):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    field("model", "gpt-image-1"); field("prompt", prompt)
    field("size", SIZE); field("quality", "low"); field("n", "1")
    for path in REFS:
        mime = mimetypes.guess_type(path)[0] or "image/png"
        parts.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"image[]\"; "
            f"filename=\"{os.path.basename(path)}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
            + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(API, data=body, headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=420) as resp:
        data = json.loads(resp.read())
    path = os.path.join(out, f"feel-{name}.png")
    with open(path, "wb") as fh:
        fh.write(base64.b64decode(data["data"][0]["b64_json"]))
    return path


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "gen"))
    ap.add_argument("--only", default=""); ap.add_argument("--dry", action="store_true")
    a = ap.parse_args(argv)
    want = {s.strip() for s in a.only.split(",") if s.strip()}
    items = {k: v for k, v in PROMPTS.items() if not want or k in want}
    if a.dry:
        for k, v in items.items(): print(f"\n=== {k} ===\n{v}")
        print(f"\n[dry] {len(items)} шт., референсы: {', '.join(os.path.basename(r) for r in REFS)}")
        return 0
    for r in REFS:
        if not os.path.exists(r): print("нет референса:", r); return 1
    key = open(KEY_PATH, encoding="utf-8").read().strip()
    os.makedirs(a.out, exist_ok=True)
    for k, v in items.items(): print("→", draw(k, v, a.out, key))
    return 0


if __name__ == "__main__":
    sys.exit(main())
