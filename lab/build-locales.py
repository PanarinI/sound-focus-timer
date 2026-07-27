#!/usr/bin/env python3
"""Раскладывает lab/locales-data.json → extension/_locales/<code>/messages.json (формат Chrome i18n).
Запуск: python3 lab/build-locales.py  (из корня sound-focus-timer). Идемпотентно."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "locales-data.json")
LOCALES = os.path.join(HERE, "..", "extension", "_locales")
FULL = os.path.join(HERE, "full")  # родные FULL-описания per-язык (storeDesc)

def store_desc(code):
    """FULL для CWS: родной full/<code>.md, иначе EN-fallback (full/en.md).
    Chrome это поле НЕ читает — его берёт скрипт массовой загрузки листинга (метод 3.6)."""
    p = os.path.join(FULL, code + ".md")
    if not os.path.exists(p):
        p = os.path.join(FULL, "en.md")
    return open(p, encoding="utf-8").read().strip()

data = json.load(open(DATA, encoding="utf-8"))
n = 0
fb = 0
for code, v in data.items():
    if code.startswith("_"):
        continue
    d = os.path.join(LOCALES, code)
    os.makedirs(d, exist_ok=True)
    if not os.path.exists(os.path.join(FULL, code + ".md")):
        fb += 1
    msgs = {
        "appName":   {"message": v["appName"],   "description": "Extension name (CWS listing title / SEO door)"},
        "shortDesc": {"message": v["shortDesc"], "description": "Short description (<=132 chars)"},
        "storeDesc": {"message": store_desc(code), "description": "Full CWS description — loaded by the listing-upload script, NOT read by Chrome"},
    }
    with open(os.path.join(d, "messages.json"), "w", encoding="utf-8") as f:
        json.dump(msgs, f, ensure_ascii=False, indent=2)
    n += 1
print(f"{n} locales built → extension/_locales/  ({n-fb} native FULL · {fb} EN-fallback storeDesc)")
