# Права-обоснование для модерации CWS (этап 3.6)

> Собрано 2026-07-26. Канон — `app-studio/knowledge-base/module-3/3.6-publish-cws.md:143-162`.
> Правило: обосновывать КРАТКО, функционально-честно. Право, не задействованное функционалом,
> модерация заворачивает при ЛЮБОМ обосновании (`3.6:154`). Все 5 прав сверены по коду 07-26 (см. низ файла).
> Вставлять в CWS Dashboard → вкладка **Privacy** при заполнении карточки.

---

## Single Purpose (одно предложение — цель, без подробностей)

**A minimalist timer for focus and study sessions, with warm, generated background sound.**

*(запас, если попросят короче: `A minimalist focus and study timer with warm background sound.`)*

---

## Permissions — обоснования (вставить каждое в своё поле)

| Permission | Justification (EN — вставить дословно) |
|---|---|
| `sidePanel` | Show the timer and its sound controls in the browser side panel. |
| `storage` | Store the user's timer settings and preferences locally. |
| `offscreen` | Play the focus sound continuously, including while the side panel is closed. |
| `scripting` | Show the optional edge-glow tab (a quick way back to the session) on the current page. |
| host permissions `<all_urls>` (optional) | Show the optional edge-glow tab on any website. Requested only when the user turns the tab on. |

Тон сверен с примерами курса (`3.6:148-152`, напр. `host permissions — show extension action button on any website`).

---

## Remote code

**No, I am not using remote code.** *(вкладка Privacy, обязательный пункт `3.6:145`)*
Честно: весь звук генерируется на устройстве (Web Audio), внешний JS/wasm не загружается — все скрипты в пакете.

## Сбор данных (Data collection)

**Ничего не отмечать** (`3.6:156` — если ничего не собираешь, лучше не отмечать).
Честно: всё живёт в `chrome.storage.local` (на устройстве) — настройки, `glowEnabled`, счётчики сессий.
Ничего не уходит на серверы, аккаунтов нет. Это наш клин «private by design» — совпадает с листингом.
Не забыть 3 галки согласия ниже (`3.6:156`).

## Privacy Policy (ссылка обязательна даже при нулевом сборе)

Под-задача (нужен Google-аккаунт автора):
1. Взять шаблон курса — `3.6:158` (ссылка на Google Doc).
2. Заменить: `[COMPANY NAME]` → **Minimalist Timer**, `[EMAIL ADDRESS]` → **panarin2005@gmail.com**, `[DATE]` → дата публикации.
3. Опубликовать Doc → получить публичную ссылку → вставить в CWS.

---

## ⚖ Развилка автору (meaning — твоё решение): язычок в v1 или нет?

Факт (сверено по коду): **`scripting` и optional `<all_urls>` нужны ТОЛЬКО язычку** (`glow.js`).
Ядро продукта (таймер + звук) работает на `sidePanel / storage / offscreen` — **ноль host-прав**.

⚠️ **Основание «безопаснее для модерации» СНЯТО 07-26** (поймал автор). По канону host = норма
(`3.6:152` — штатный пример обоснования; запрет один — не просить СВЕРХ функционала), никакого
«внимательного ревью / риска reject» канон не содержит (это уже снимали как наслоение 07-17,
DECISIONS). Плюс наш host **optional** → на установке не предъявляется вовсе, `scripting` предупреждения
не даёт → **первая установка чистая в ОБОИХ вариантах**. По правам/модерации разница ≈ ноль.

Значит развилку решать по РЕАЛЬНЫМ причинам, не из страха ревью:
- **Оставить язычок (текущий манифест):** лестница присутствия целиком с v1. Побочно `optional_host`
  = готовая почва под будущую монетизацию аффилиатом в поисковиках (модуль `5.3:36-42`), если дорастём
  до ~4-5К WAU (`5.3:7`) — не придётся пугать базу апдейтом прав.
- **Убрать язычок из v1 (вернуть апдейтом v1.x):** одной поверхностью меньше («кнопочки убивают
  активацию»); узел №1 STATE (когерентность язычка новой рейс-сцене) и так открыт — v1 без него честнее,
  вернуть, когда узел решён. Цена: нет присутствия-у-кромки в первом релизе.

Не решаю за тебя — это стратегия/вкус. Обоснование выше готово под ПОЛНЫЙ манифест (дефолт = то, что построено).

---

## Сверка прав по коду (07-26 — каждое реально задействовано)

- `sidePanel` — `background.js:4,47,52,189` (`setPanelBehavior`, `sidePanel.open`)
- `storage` — `glow.js:95,104,140`, `background.js:74+` (`storage.local` get/set, `glowEnabled`)
- `offscreen` — `background.js:15,17` (`offscreen.hasDocument/createDocument`)
- `scripting` — `background.js:143,160` (`scripting.executeScript` — инжект `glow.js`)
- `optional_host <all_urls>` — `hearth.js:482` (`permissions.request(GLOW_ORIGINS)`, по жесту)
