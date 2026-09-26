#!/usr/bin/env python3
"""Слайд 1 «кокон» — заказ у генератора через референсы (`/v1/images/edits`), 26.09.2026.

Слово автора 26.09: «первый слайд, может и в нарушение канона, но про суть — переделанная работа в коконе:
человек перед экраном, из экрана тепло и уют, а вокруг — может не темнота… очертания стирающихся предметов,
мест, намёком, что ты в каком-то помещении (в кафе например)».
Логика Клода: в продукте вид — функция звука; зерно = видимый шум, маскировка = слой, затягивающий поле.
Значит кокон рисуем не темнотой, а ЗЕРНОМ: кафе вокруг стирается шумом, у экрана остаётся тёплый чёткий круг.
Законы прошлых кругов (gen_feel.py, 08-27): люди только со спины и мелко (лица и руки генератор портит);
не фотосток — рука, материал, неровность; уют И фокус; художников не называем. Буквы — только кодом.
Референс — принятая сцена силуэта (`gen/feel-far.png`): свет, палитра, масштаб человека.
    python3 gen_kokon.py --dry          → промпты без трат
    python3 gen_kokon.py --only a1,b1   → выбранные; выход — gen/kokon-<имя>.png
"""
from __future__ import annotations
import argparse, base64, json, mimetypes, os, sys, urllib.request, uuid

KEY_PATH = os.path.expanduser("~/.config/logoped/openai.key")
API = "https://api.openai.com/v1/images/edits"
HERE = os.path.dirname(os.path.abspath(__file__))
SIZE = "1536x1024"
REFS = [os.path.join(HERE, "gen", "feel-far.png")]

MATERIAL = ("Hand-made look, not a stock photo: visible film grain and soft painterly texture, slightly uneven "
            "edges, limited warm palette of amber, umber and deep brown-black. No text, no logos, no faces. ")
COCOON = ("The whole idea: sound builds a warm cocoon around one person. Close to the glowing screen the world is "
          "warm, clear and calm. Further away the room dissolves into fine grain, like visual noise erasing it. ")
CAFE = ("Around the person is a café, only hinted: faint outlines of small round tables, chairs, a few other "
        "people as soft blurred silhouettes, hanging pendant lamps, a counter and a large window. These outlines "
        "fade and break up into grain the further they are from the person, as if the noise is wiping them away. ")

PROMPTS = {
    "a1": ("Keep the camera, scale and light of this scene: a person seen from behind, small and low in the frame, "
           "at a desk with a laptop whose screen spills warm amber light. " + COCOON + CAFE + MATERIAL),
    "a2": ("Same scene as the reference: a person from behind, small, at a laptop glowing warm amber in a dark space. "
           + COCOON + "The room is a quiet café at evening; its tables, lamps and passers-by are drawn as thin fading "
           "lines and smudges that crumble into grain at the edges of the frame, while a soft sphere of warm light "
           "around the person stays intact. " + MATERIAL),
    "b1": ("Over-the-shoulder view from behind a person sitting at a laptop in a café: we see the back of the head "
           "and one shoulder in dark silhouette at the lower left, and the laptop screen in front of them. On the "
           "screen: a plain light document on the left and a narrow dark side panel on the right with one warm "
           "glowing amber orb in it, the only strong light in the picture. " + COCOON + CAFE + MATERIAL),
    "b2": ("A person seen from behind and slightly above, at a small café table with a laptop. The laptop screen "
           "shows a dark narrow side panel with a single warm golden orb; its light wraps the person in a warm "
           "halo. " + COCOON + "Beyond the halo the café — other tables, lamps, a window with the street, blurred "
           "people — is sketched faintly and dissolves into grain and darkness toward the edges. " + MATERIAL),
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
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"image[]\"; "
                     f"filename=\"{os.path.basename(path)}\"\r\nContent-Type: {mime}\r\n\r\n".encode()
                     + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(API, data=b"".join(parts), headers={
        "Authorization": f"Bearer {key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=420) as resp:
        data = json.loads(resp.read())
    path = os.path.join(out, f"kokon-{name}.png")
    with open(path, "wb") as fh:
        fh.write(base64.b64decode(data["data"][0]["b64_json"]))
    usage = data.get("usage") or {}
    with open(os.path.join(HERE, "gen", "spend.log"), "a") as f:
        f.write(f"kokon-{name}\tlow\t{json.dumps(usage)}\n")
    return path


# ── НАУШНИКИ (слово автора 26.09: «рисунок врёт — человек не может без наушников в кафе использовать продукт») ──
# Правка маской: генератор перерисовывает только прозрачный участок маски (голова и уши), остальное как было.
NAUSHNIKI = ("Add a pair of large over-ear headphones on this person's head: a dark headband over the top of the head "
             "and a round ear cup over the ear, in the same dark silhouette and the same grainy painterly texture as the "
             "person, with a thin warm amber rim of light from the laptop along the headband. Keep the head shape, pose "
             "and everything else exactly as it is.")


def naushniki(metka: str, api_key: str, n: int = 2) -> list:
    src, mask = os.path.join(HERE, "gen", "kokon-a2.png"), os.path.join(HERE, "gen", "kokon-a2-maska-golova.png")
    boundary = uuid.uuid4().hex
    parts = []

    def field(k, v):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    field("model", "gpt-image-1"); field("prompt", NAUSHNIKI)
    field("size", SIZE); field("quality", "low"); field("n", str(n))
    for name, path in (("image[]", src), ("mask", mask)):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
                     f"filename=\"{os.path.basename(path)}\"\r\nContent-Type: image/png\r\n\r\n".encode()
                     + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(API, data=b"".join(parts), headers={
        "Authorization": f"Bearer {api_key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=420) as resp:
        data = json.loads(resp.read())
    outs = []
    for i, d in enumerate(data["data"], 1):
        path = os.path.join(HERE, "gen", f"kokon-a2-naushniki-{metka}{i}.png")
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(d["b64_json"]))
        outs.append(path)
    with open(os.path.join(HERE, "gen", "spend.log"), "a") as f:
        f.write(f"kokon-a2-naushniki-{metka}\tlow n={n}\t{json.dumps(data.get('usage') or {})}\n")
    return outs


# ── ГОЛОВА В ЭКРАН (слово автора 26.09: «чтобы он не смотрел как бы с разворота на нас, а смотрел в монитор») ──
# Правим принятую сцену v12 маской по голове; вторым изображением — исходный эскиз a2, где человек строго спиной.
GOLOVA = ("Redraw only the person's head so they look straight ahead at the laptop screen, seen from directly behind: "
          "only the back of the head is visible, no face, no profile, no cheek turned toward us. Keep the over-ear "
          "headphones: the dark band over the top of the head and an ear cup on the side, with a thin warm amber rim of "
          "light from the screen. Same dark silhouette and grainy painterly texture; everything else exactly as it is.")


def png_maska(path, w, h, cx, cy, rx, ry):
    """Маска для правки: прозрачный эллипс = перерисовать, остальное непрозрачно (PNG с альфой, без библиотек)."""
    import struct, zlib
    rows = bytearray(); opaque = bytes((0, 0, 0, 255)) * w
    for y in range(h):
        row = bytearray(opaque); dy = (y - cy) / ry
        if abs(dy) < 1:
            half = int(rx * (1 - dy * dy) ** .5); x0, x1 = max(0, cx - half), min(w, cx + half)
            row[x0 * 4:x1 * 4] = bytes((0, 0, 0, 0)) * (x1 - x0)
        rows += b'\x00' + row
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                           + ch(b'IDAT', zlib.compress(bytes(rows), 9)) + ch(b'IEND', b''))


def golova(metka: str, api_key: str, n: int = 2) -> list:
    src = os.path.join(HERE, "gen", "kokon-a2-naushniki-v12.png")
    ref = os.path.join(HERE, "gen", "kokon-a2.png")
    mask = os.path.join(HERE, "gen", "kokon-v12-maska-golova.png")
    png_maska(mask, 1536, 1024, 760, 370, 115, 120)
    boundary = uuid.uuid4().hex
    parts = []

    def field(k, v):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    field("model", "gpt-image-1"); field("prompt", GOLOVA)
    field("size", SIZE); field("quality", "low"); field("n", str(n))
    for name, path in (("image[]", src), ("image[]", ref), ("mask", mask)):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
                     f"filename=\"{os.path.basename(path)}\"\r\nContent-Type: image/png\r\n\r\n".encode()
                     + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(API, data=b"".join(parts), headers={
        "Authorization": f"Bearer {api_key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=420) as resp:
        data = json.loads(resp.read())
    outs = []
    for i, d in enumerate(data["data"], 1):
        path = os.path.join(HERE, "gen", f"kokon-golova-{metka}{i}.png")
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(d["b64_json"]))
        outs.append(path)
    with open(os.path.join(HERE, "gen", "spend.log"), "a") as f:
        f.write(f"kokon-golova-{metka}\tlow n={n}\t{json.dumps(data.get('usage') or {})}\n")
    return outs


# ── ПРОПОРЦИИ ГОЛОВЫ (слово автора 26.09: «некрасиво… большая квадратная голова — комично и глупо») ──
# Правим сцену golova-v12 (поза верная) маской по голове; образец пропорций — исходный эскиз a2. Качество medium.
PROPORCII = ("Redraw only the head and the headphones with natural human proportions: a small rounded head, clearly "
             "narrower than the shoulders, slightly bowed toward the laptop, short hair, seen from directly behind. "
             "Slim over-ear headphones that hug the head closely — a thin band over the top and small ear cups, not "
             "bulky, not square. Same dark silhouette, same grainy painterly texture and warm amber rim light as the "
             "rest of the picture. Everything else exactly as it is.")


def proporcii(metka: str, api_key: str, n: int = 3) -> list:
    src = os.path.join(HERE, "gen", "kokon-golova-v12.png")
    ref = os.path.join(HERE, "gen", "kokon-a2.png")
    mask = os.path.join(HERE, "gen", "kokon-golova-v12-maska.png")
    png_maska(mask, 1536, 1024, 775, 385, 125, 130)
    boundary = uuid.uuid4().hex
    parts = []

    def field(k, v):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    field("model", "gpt-image-1"); field("prompt", PROPORCII)
    field("size", SIZE); field("quality", "medium"); field("n", str(n))
    for name, path in (("image[]", src), ("image[]", ref), ("mask", mask)):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
                     f"filename=\"{os.path.basename(path)}\"\r\nContent-Type: image/png\r\n\r\n".encode()
                     + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(API, data=b"".join(parts), headers={
        "Authorization": f"Bearer {api_key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = json.loads(resp.read())
    outs = []
    for i, d in enumerate(data["data"], 1):
        path = os.path.join(HERE, "gen", f"kokon-proporcii-{metka}{i}.png")
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(d["b64_json"]))
        outs.append(path)
    with open(os.path.join(HERE, "gen", "spend.log"), "a") as f:
        f.write(f"kokon-proporcii-{metka}\tmedium n={n}\t{json.dumps(data.get('usage') or {})}\n")
    return outs


# ── ЖЕНСКИЙ ОБРАЗ (слово автора 27.09: «давай женский образ лучше… он будет здесь привлекательнее») ──
# Правим принятую сцену (proporcii-v12) маской по всей фигуре: голова, плечи, спина. Стул, стол, ноутбук, кафе — как были.
ZHENSHCHINA = ("Replace only the seated person with a young woman seen from directly behind, looking at the laptop screen: "
               "natural proportions, a small head, hair loosely tied up with a few strands, slim over-ear headphones hugging "
               "the head, a soft sweater, relaxed calm posture, slightly leaning toward the screen. Same dark silhouette, "
               "same grainy painterly texture and warm amber rim light from the screen along her hair and shoulder. "
               "Keep the chair, table, laptop, café and everything else exactly as it is. No face visible.")


def zhenshchina(metka: str, api_key: str, n: int = 3) -> list:
    src = os.path.join(HERE, "gen", "kokon-proporcii-v12.png")
    mask = os.path.join(HERE, "gen", "kokon-maska-figura.png")
    png_maska(mask, 1536, 1024, 755, 560, 250, 330)
    boundary = uuid.uuid4().hex
    parts = []

    def field(k, v):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode())
    field("model", "gpt-image-1"); field("prompt", ZHENSHCHINA)
    field("size", SIZE); field("quality", "medium"); field("n", str(n))
    for name, path in (("image[]", src), ("mask", mask)):
        parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; "
                     f"filename=\"{os.path.basename(path)}\"\r\nContent-Type: image/png\r\n\r\n".encode()
                     + open(path, "rb").read() + b"\r\n")
    parts.append(f"--{boundary}--\r\n".encode())
    req = urllib.request.Request(API, data=b"".join(parts), headers={
        "Authorization": f"Bearer {api_key}", "Content-Type": f"multipart/form-data; boundary={boundary}"})
    with urllib.request.urlopen(req, timeout=600) as resp:
        data = json.loads(resp.read())
    outs = []
    for i, d in enumerate(data["data"], 1):
        path = os.path.join(HERE, "gen", f"kokon-zhenshchina-{metka}{i}.png")
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(d["b64_json"]))
        outs.append(path)
    with open(os.path.join(HERE, "gen", "spend.log"), "a") as f:
        f.write(f"kokon-zhenshchina-{metka}\tmedium n={n}\t{json.dumps(data.get('usage') or {})}\n")
    return outs


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "gen"))
    ap.add_argument("--only", default="")
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--naushniki", default="", help="ключ прогона правки маской, напр. v1")
    ap.add_argument("--golova", default="", help="ключ прогона правки головы, напр. v1")
    ap.add_argument("--proporcii", default="", help="ключ прогона правки пропорций головы, напр. v1")
    ap.add_argument("--zhenshchina", default="", help="ключ прогона: женский образ, напр. v1")
    a = ap.parse_args(argv)
    want = {s.strip() for s in a.only.split(",") if s.strip()}
    items = {k: v for k, v in PROMPTS.items() if not want or k in want}
    if a.dry:
        for k, v in items.items():
            print(f"\n=== {k} ===\n{v}")
        return 0
    key = open(KEY_PATH, encoding="utf-8").read().strip()
    if a.zhenshchina:
        for pth in zhenshchina(a.zhenshchina, key):
            print("→", pth)
        return 0
    if a.proporcii:
        for pth in proporcii(a.proporcii, key):
            print("→", pth)
        return 0
    if a.golova:
        for pth in golova(a.golova, key):
            print("→", pth)
        return 0
    if a.naushniki:
        for pth in naushniki(a.naushniki, key):
            print("→", pth)
        return 0
    for k, v in items.items():
        print("→", draw(k, v, a.out, key))
    return 0


if __name__ == "__main__":
    sys.exit(main())
