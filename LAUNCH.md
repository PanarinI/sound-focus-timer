# LAUNCH — путь публикации в CWS (веха 1)

> Орган рождён на вехе 1 (2026-07-27). Живой чеклист выкладки в Chrome Web Store по канону
> буткемпа `app-studio/knowledge-base/module-3` (3.5 pre-publish + 3.6 publish). Держать до
> публикации; после — организм линяет в продукт-ДНК, этот файл архивируется.
> Легенда: ✅ готово · ⚙️ за Клодом · 👤 за автором (аккаунт/руки).

## Артефакты (где что лежит)
- **Билд:** `dist/minimalist-timer-1.0.0.zip` (219 КБ, только рантайм, 53 локали, версия 1.0.0). VirusTotal ✅ (автор проверил 07-27).
- **FULL-описания:** `lab/full/<code>.md` — 45 нативных языков + `en.md`; транслит-8 идут на EN-fallback. Все зашиты в `_locales/<code>/messages.json` под ключом `storeDesc` (пересборка: `python3 lab/build-locales.py`).
- **Графика:** `lab/graphics/` — иконка 128² (`icon128.png`) · промо-tile 440×280 (`banner-small.png`) · скриншоты 1280×800 (`panel-blue/deep/blue2/shot.png`, `banner-final.png`).
- **Имя+краткое:** `_locales/` (53 локали), подтянутся из архива автоматически.

## Готовность (закрыто)
Имя+бронь ✅ · мета 2.1 ✅ · графика 3.1 ✅ · права 3.6 (`lab/permissions.md`) ✅ · feel-before-ship ✅ ·
переводы: **53 локали NAME+SHORT + 45 нативных FULL + 8 EN-fallback** ✅ · звук в расширении играет ✅ ·
finish-правка ✅ · билд 1.0.0 + VirusTotal ✅.

## Чеклист выкладки

### A. Билд и антивирус
- [x] ⚙️ Чистый zip 1.0.0 собран (отжившие `orb/sidepanel/popup/dev/ui` исключены)
- [x] 👤 VirusTotal — чисто (07-27)

### B. Аккаунт (метод `1.3-cws-account.md`)
- [ ] 👤 Отдельный Google-аккаунт `callmestewie90@gmail.com` (метод: «в идеале отдельный акк на каждое расширение» — изоляция сетки от бана-домино). Продукт №1 — на другом акке, изоляция уже есть.
- [ ] 👤 **2FA** на аккаунте (CWS может потребовать)
- [ ] 👤 Язык интерфейса аккаунта → **English (US)** на время выкладки
- Антидетект (Dolphin) + прокси у автора есть (бесплатно) → метод-грейд развязка за 0 усилий. Регионного риска НЕТ (Грузия ≠ РФ-гео-блок); без антидетекта теряется лишь страховка от будущего «домино» между аккаунтами. Решение автора — насколько строго.

### C. Store Listing
- [ ] 👤 Загрузить `dist/minimalist-timer-1.0.0.zip` в CWS Dashboard (имя+краткое подтянутся из архива)
- [ ] 👤 **FULL-описания** — способ загрузки ↓
- [ ] 👤 Графика: store-иконка 128², промо-tile 440×280, **выбрать до 5 скриншотов** 1280×800 (вкус автора)

**Загрузка FULL — скриптом метода (3.6):** в Dashboard → Store Listing → F12 → Console → вставить скрипт курса (`knowledge-base/module-3/3.6:46`). Он читает `storeDesc` из `_locales/<code>/messages.json` и раскладывает полные описания по всем языкам одним прогоном. `storeDesc` уже зашит генератором. Альтернатива — вручную вставлять `lab/full/<code>.md` по языку (муторно, 45 раз).

### D. Privacy tab (метод 3.6)
- **Single Purpose** (1 фраза): `A minimalist timer for focus and study.`
- **Remote code → No** (всё локально; offscreen/remote.js — не remote code)
- **Обоснование прав** (кратко):
  - `sidePanel` — Show the timer in the side panel
  - `storage` — Store user settings
  - `offscreen` — Keep the sound playing when the panel is closed
  - `scripting` — Inject the return-to-session tab on the current page
  - `host permissions` (`<all_urls>`, optional) — Show the return-to-session tab on any website
- **Data collection** — ничего не собираем (всё on-device) → ничего не отмечаем + 3 галки (не продаём · не для сторонних целей · не для кредитоспособности)
- [x] ⚙️ **Privacy Policy** — создана `focus-pages/privacy/index.html` (zero-collection, честная, контакт `callmestewie90@gmail.com`). Формулировка допускает privacy-friendly аналитику веб-страниц; сам таймер = private. Сбор в расширении = v2 (по DNA), потребует обновления policy + CWS Data-disclosure.
- [x] ⚙️ **welcome/uninstall** — переделаны из «Ember/очаг» в «Minimalist Timer» + синяя гамма/звезда (`focus-pages/welcome/`, `/uninstall/`).
- [ ] 👤 **Деплой `focus-pages`** (git push) — 3 страницы (welcome · uninstall · privacy) на github-pages. БЕЗ него живые URL показывают старое. После — вставить `panarini.github.io/focus-pages/privacy/` в CWS Privacy tab.
- [ ] 👤 **Save draft → Submit** на модерацию

## Решения (зафиксировано)
- **Права язычка — `optional_host`** (мягкий старт; DECISIONS 07-26). Цена: при будущем переходе на required (аффилиат-монетизация) окно Remove съест ~половину базы. На холодном старте с 0 юзеров — оправдано.
- **FULL длинного хвоста — догенерён нативно** (метод 3.3: «переводить все языки», не English-fallback). Тир 🔶 «моё знание» для major-неевропейских (ar/zh/ko/th/vi/hi/he/fa) — как у имён; носители могут вычитать позже, не блок.
- **Транслит-8** (am bn gu kn ml mr ta te) — SHORT+FULL на EN-fallback (принцип «инструмент=явь» 07-26: кривой перевод на языке, которым не владеем, носитель раскусит → хуже пустого/английского).
- **sr** — приведён к латинице везде (было: имя кириллица / тело латиница — рассинхрон). 🔶 латиница шире в сербском вебе; не выверено DFS, автор может переиграть на кириллицу.

## За автором после сабмита
- Сверить иконку-искру в тулбаре вживую (`chrome://extensions` → load unpacked)
- 8 транслит-имён (am bn gu kn ml mr ta te) — на вычитку носителем или оставить как есть
- После релиза — 1 живой ADHD-тестер (feel-before-ship, вторая половина)
- Метаморфоза: организм линяет в продукт-ДНК, `LAUNCH.md` → архив
