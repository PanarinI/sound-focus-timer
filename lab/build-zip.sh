#!/usr/bin/env bash
# build-zip.sh — сборка билда для Chrome Web Store.
#
# ЗАЧЕМ. До 08-06 zip собирался руками по памяти, и это ровно тот шов, где теряются НОВЫЕ файлы:
# `icon.js` и `tone.js` подключены так, что их отсутствие не роняет расширение — оно просто молча
# едет без иконки-таймера и без тона. Забытый файл прошёл бы модерацию и приехал юзерам.
# Поэтому список файлов теперь ЗДЕСЬ, и сборка падает, если хоть одного из них нет на диске.
#
# ДВА РЕЖИМА (закон сборки 08-10: дев на тест → прод после слова автора):
#   bash lab/build-zip.sh dev    → dist/minimalist-timer-<версия>-dev.zip + dist/unpacked-<версия>-dev/
#   bash lab/build-zip.sh prod   → dist/minimalist-timer-<версия>.zip
#
# Дев несёт `version_name: "<версия>-dev"` — в chrome://extensions видно, что стоит тестовая сборка,
# а не то, что уедет людям; пересобирается свободно (черновик). `load unpacked` берётся ИЗ ПАПКИ
# `unpacked-*`, а не из `extension/`: так тестируется ровно то, что уехало в архив — с белым списком,
# без .DS_Store, без отживших файлов. Прод собирается чистым номером (`version_name` снят) и молча
# НЕ перезаписывается: `--force` — осознанно.
#
# Версия НЕ вычисляется и не подставляется: единственный источник — `extension/manifest.json`.
# Перед релизом версию поднимает человек, скрипт лишь берёт её и кладёт в имя архива.
set -euo pipefail

MODE="${1:-}"
FORCE="${2:-}"
if [[ "$MODE" != dev && "$MODE" != prod ]]; then
  echo "Как: bash lab/build-zip.sh dev|prod [--force]"
  echo "  dev  — пакет на тест (маркер -dev в версии) + распакованная папка для load unpacked"
  echo "  prod — пакет в стор, только после пройденного дев-теста и слова автора"
  exit 2
fi

cd "$(dirname "$0")/.."          # корень проекта
ROOT=$(pwd)
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
if [[ "$MODE" == dev ]]; then NAME="minimalist-timer-$VER-dev"; else NAME="minimalist-timer-$VER"; fi
ZIP="$OUT/$NAME.zip"

if [[ -f "$ZIP" ]]; then
  if [[ "$MODE" == prod && "$FORCE" != "--force" ]]; then
    echo "✗ $ZIP уже существует."
    echo "  Это может быть архив, который УЖЕ ЛЕЖИТ В СТОРЕ — молча перезаписывать его нельзя."
    echo "  Подними версию в $EXT/manifest.json либо пересобери осознанно: bash lab/build-zip.sh prod --force"
    exit 1
  fi
  echo "(пересобираю поверх прежнего $ZIP)"
fi

# ── СТОЛ СБОРКИ. Пакуем не из `extension/` напрямую, а из копии: только в ней правится манифест
#    (version_name), рабочее дерево остаётся чистым.
STAGE="$(mktemp -d)/pkg"
mkdir -p "$STAGE"
trap 'rm -rf "$(dirname "$STAGE")"' EXIT
for f in "${FILES[@]}"; do cp "$EXT/$f" "$STAGE/$f"; done
for d in "${DIRS[@]}"; do rsync -a --exclude='.DS_Store' "$EXT/$d/" "$STAGE/$d/"; done

python3 - "$STAGE/manifest.json" "$MODE" "$VER" <<'PY'
import json, sys
path, mode, ver = sys.argv[1], sys.argv[2], sys.argv[3]
m = json.load(open(path))
if mode == 'dev':
    out = {}
    for k, v in m.items():            # version_name кладём сразу за version — так его видно глазами
        out[k] = v
        if k == 'version':
            out['version_name'] = f'{ver}-dev'
    m = out
else:
    m.pop('version_name', None)
json.dump(m, open(path, 'w'), ensure_ascii=False, indent=2)
open(path, 'a').write('\n')
PY

mkdir -p "$OUT"
rm -f "$ZIP"                       # zip -r ДОПИСЫВАЕТ в существующий архив: выпавший файл выжил бы в нём
( cd "$STAGE" && zip -q -r -X "$ROOT/$ZIP" . -x '*.DS_Store' )

# ── ПРОВЕРКА СОБРАННОГО: смотрим не на то, что хотели положить, а на то, что реально внутри.
# Список берём ОДИН раз в переменную: `unzip | grep -q` обрывает пайп на первом совпадении,
# и с `pipefail` успешная проверка выглядела бы как провал сборки.
LIST=$(unzip -Z1 "$ZIP")
IN_ZIP=$(printf '%s\n' "$LIST" | wc -l | tr -d ' ')
LOCALES=$(printf '%s\n' "$LIST" | grep -c '_locales/.*/messages.json' || true)
for must in tone.js icon.js manifest.json hearth.js; do
  printf '%s\n' "$LIST" | grep -qx "$must" || { echo "✗ в архиве НЕТ $must"; exit 1; }
done
VNAME=$(unzip -p "$ZIP" manifest.json | python3 -c 'import json,sys;print(json.load(sys.stdin).get("version_name",""))')
if [[ "$MODE" == dev && "$VNAME" != "$VER-dev" ]]; then echo "✗ дев-пакет без маркера версии"; exit 1; fi
if [[ "$MODE" == prod && -n "$VNAME" ]]; then echo "✗ в прод-пакете остался version_name=$VNAME"; exit 1; fi

if [[ "$MODE" == dev ]]; then
  UNPACKED="$OUT/unpacked-$VER-dev"
  rm -rf "$UNPACKED"
  mkdir -p "$UNPACKED"
  rsync -a "$STAGE/" "$UNPACKED/"
fi

echo "✓ $ZIP"
echo "  версия $VER · version_name ${VNAME:-нет (чистый номер)} · файлов $IN_ZIP · локалей $LOCALES · $(du -h "$ZIP" | cut -f1)"
if [[ "$MODE" == dev ]]; then
  echo "  тест: chrome://extensions → Load unpacked → $OUT/unpacked-$VER-dev/"
else
  echo "  дальше: VirusTotal → CWS Dashboard → Package → загрузить архив"
fi
