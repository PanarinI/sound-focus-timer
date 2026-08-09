#!/usr/bin/env bash
# build-zip.sh — сборка билда для Chrome Web Store.
#
# ЗАЧЕМ. До 08-06 zip собирался руками по памяти, и это ровно тот шов, где теряются НОВЫЕ файлы:
# `icon.js` и `tone.js` подключены так, что их отсутствие не роняет расширение — оно просто молча
# едет без иконки-таймера и без тона. Забытый файл прошёл бы модерацию и приехал юзерам.
# Поэтому список файлов теперь ЗДЕСЬ, и сборка падает, если хоть одного из них нет на диске.
#
# ЗАПУСК:  bash lab/build-zip.sh          — собрать dist/minimalist-timer-<версия из манифеста>.zip
#          bash lab/build-zip.sh --force  — перезаписать уже существующий архив
#
# Версия НЕ вычисляется и не подставляется: единственный источник — `extension/manifest.json`.
# Перед релизом версию поднимает человек, скрипт лишь берёт её и кладёт в имя архива.
set -euo pipefail

cd "$(dirname "$0")/.."          # корень проекта
EXT=extension
OUT=dist

# ── БЕЛЫЙ СПИСОК: только рантайм. Отжившие orb.* sidepanel.* popup.* dev.html ui.html
#    в стор не едут (решение 07-26) — здесь их просто нет.
FILES=(
  manifest.json
  background.js
  engine.js
  remote.js
  tone.js           # тоновый слой (08-06) — без него ручка «Air» есть, а тона за ней нет
  icon.js           # иконка-таймер (08-06) — без него в тулбаре нет дуги остатка
  offscreen.js
  offscreen.html
  hearth.html
  hearth.js
  glow.js
)
DIRS=( icons _locales )

for f in "${FILES[@]}"; do
  [[ -f "$EXT/$f" ]] || { echo "✗ НЕТ ФАЙЛА: $EXT/$f — сборка остановлена"; exit 1; }
done
for d in "${DIRS[@]}"; do
  [[ -d "$EXT/$d" ]] || { echo "✗ НЕТ ПАПКИ: $EXT/$d — сборка остановлена"; exit 1; }
done

VER=$(python3 -c "import json;print(json.load(open('$EXT/manifest.json'))['version'])")
ZIP="$OUT/minimalist-timer-$VER.zip"

if [[ -f "$ZIP" && "${1:-}" != "--force" ]]; then
  echo "✗ $ZIP уже существует."
  echo "  Это может быть архив, который УЖЕ ЛЕЖИТ В СТОРЕ — молча перезаписывать его нельзя."
  echo "  Подними версию в $EXT/manifest.json либо пересобери осознанно: bash lab/build-zip.sh --force"
  exit 1
fi

mkdir -p "$OUT"
rm -f "$ZIP"
( cd "$EXT" && zip -q -r -X "../$ZIP" "${FILES[@]}" "${DIRS[@]}" -x '*.DS_Store' )

# ── ПРОВЕРКА СОБРАННОГО: смотрим не на то, что хотели положить, а на то, что реально внутри.
# Список берём ОДИН раз в переменную: `unzip | grep -q` обрывает пайп на первом совпадении,
# и с `pipefail` успешная проверка выглядела бы как провал сборки.
LIST=$(unzip -Z1 "$ZIP")
IN_ZIP=$(printf '%s\n' "$LIST" | wc -l | tr -d ' ')
LOCALES=$(printf '%s\n' "$LIST" | grep -c '_locales/.*/messages.json' || true)
for must in tone.js icon.js manifest.json hearth.js; do
  printf '%s\n' "$LIST" | grep -qx "$must" || { echo "✗ в архиве НЕТ $must"; exit 1; }
done

echo "✓ $ZIP"
echo "  версия $VER · файлов $IN_ZIP · локалей $LOCALES · $(du -h "$ZIP" | cut -f1)"
echo "  дальше: VirusTotal → CWS Dashboard → Package → загрузить архив"
