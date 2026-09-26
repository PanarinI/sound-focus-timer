#!/usr/bin/env python3
"""Проверка переводов полного описания против en.md (бриф — lab/full/BRIEF-perevod.md).
Запуск: python3 lab/proverka-full.py  (из корня sound-focus-timer). $0, только чтение.
Столбцы: строки (= en) · маркеры-эмодзи (= en) · имя продукта · местное слово · подписи интерфейса ·
длина к en · остатки старого текста (Minimalist Timer, помидор)."""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
FULL = os.path.join(HERE, "full")
data = json.load(open(os.path.join(HERE, "locales-data.json"), encoding="utf-8"))
en = open(os.path.join(FULL, "en.md"), encoding="utf-8").read()

MARKERS = ["🌟", "➤", "🔊", "🎨", "🏢", "⏱", "🧠", "🖥", "1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "👀", "📌", "▸", "❓", "🧐", "⭐"]
UI = ["open office", "thin walls", "café", "deep reading", "racing thoughts", "too much", "Start", "Finish", "∞"]
OLD = re.compile(r"Minimalist Timer|(?i:pomodoro|помодоро)|ポモドーロ|뽀모도로|番茄")  # имя — с заглавных: строчное `minimalist timer` в EN — ключ
WAVE3 = {"bn", "ta", "te", "gu", "kn", "ml", "mr", "am"}
NO_LOCAL = {"id", "fil", "ms"}

def lines(t): return t.count("\n") + (0 if t.endswith("\n") else 1)
def marks(t): return [t.count(m) for m in MARKERS]

def stem_count(text, local):
    """Сколько раз встречается местное слово: по основам каждого слова (склонения), берём минимум."""
    t = text.casefold()
    counts = []
    for w in local.casefold().split():
        s = w if len(w) <= 4 else w[:max(4, len(w) - 2)]
        counts.append(t.count(s))
    return min(counts) if counts else 0

en_l, en_m, en_len = lines(en), marks(en), len(en)
print(f"en: {en_l} строк, {en_len} знаков\n")
print(f"{'код':6} {'строк':>5} {'марк':>4} {'имя':>3} {'мест':>4} {'UI':>3} {'длина':>5}  замечания")
bad = 0
for code, v in data.items():
    if code.startswith("_") or code in WAVE3 or code in ("en",):
        continue
    p = os.path.join(FULL, code + ".md")
    if not os.path.exists(p):
        print(f"{code:6} НЕТ ФАЙЛА"); bad += 1; continue
    t = open(p, encoding="utf-8").read()
    local = "brown noise" if (code in NO_LOCAL or code == "en_GB") else v["appName"].split(" - Brown Noise Generator")[0]
    n_local = stem_count(t, local)
    n_name = t.count("Brown Noise Generator")
    ui_miss = [u for u in UI if u not in t]
    notes = []
    if lines(t) != en_l: notes.append(f"строк {lines(t)}≠{en_l}")
    if marks(t) != en_m:
        diff = [f"{m}{a}/{b}" for m, a, b in zip(MARKERS, marks(t), en_m) if a != b]
        notes.append("маркеры " + " ".join(diff))
    if n_name < 3: notes.append("имя <3")
    if n_local < 5: notes.append(f"местное «{local}» <5")
    if ui_miss: notes.append("нет UI: " + ", ".join(ui_miss))
    if OLD.search(t): notes.append("ОСТАТОК: " + OLD.search(t).group(0))
    ratio = len(t) / en_len
    lo = 0.35 if code in ("ja", "zh_CN", "zh_TW", "ko") else 0.6   # иероглифы и хангыль короче по знакам
    if not lo < ratio < 1.8: notes.append(f"длина ×{ratio:.2f}")
    bad += bool(notes)
    print(f"{code:6} {lines(t):5} {sum(marks(t)):4} {n_name:3} {n_local:4} {len(UI)-len(ui_miss):3} {ratio:5.2f}  {'; '.join(notes) or 'ок'}")
print(f"\nс замечаниями: {bad}")
