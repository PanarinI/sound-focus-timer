#!/usr/bin/env python3
"""Раскладывает lab/locales-data.json → extension/_locales/<code>/messages.json (формат Chrome i18n).
Запуск: python3 lab/build-locales.py  (из корня sound-focus-timer). Идемпотентно."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "locales-data.json")
LOCALES = os.path.join(HERE, "..", "extension", "_locales")

data = json.load(open(DATA, encoding="utf-8"))
n = 0
for code, v in data.items():
    if code.startswith("_"):
        continue
    d = os.path.join(LOCALES, code)
    os.makedirs(d, exist_ok=True)
    msgs = {
        "appName":   {"message": v["appName"],   "description": "Extension name (CWS listing title / SEO door)"},
        "shortDesc": {"message": v["shortDesc"], "description": "Short description (<=132 chars)"},
    }
    with open(os.path.join(d, "messages.json"), "w", encoding="utf-8") as f:
        json.dump(msgs, f, ensure_ascii=False, indent=2)
    n += 1
print(f"{n} locales built → extension/_locales/")
