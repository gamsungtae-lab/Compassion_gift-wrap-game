#!/usr/bin/env bash
# 정적 배포본(_site) 생성: GitHub Pages / Netlify 공용
#   SHEETS_URL : Apps Script 웹 앱 주소 (필수)
#   BASE_URL   : 공개 주소 (공유 미리보기 og:image 용, 끝 / 없이)
set -euo pipefail

SHEETS_URL="${SHEETS_URL:-}"
BASE_URL="${BASE_URL:-}"

if ! [[ "$SHEETS_URL" =~ ^https://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec$ ]]; then
  echo "ERROR: SHEETS_URL 이 없거나 형식이 올바르지 않습니다 (https://script.google.com/macros/s/.../exec)" >&2
  exit 1
fi
if [[ -n "$BASE_URL" ]] && ! [[ "$BASE_URL" =~ ^https://[A-Za-z0-9./_-]+$ ]]; then
  echo "ERROR: BASE_URL 형식이 올바르지 않습니다" >&2
  exit 1
fi

rm -rf _site
mkdir -p _site
cp -r src/main/resources/static/. _site/
sed -i "s#__PUBLIC_BASE_URL__#${BASE_URL%/}#g" _site/index.html
printf "// 배포 시 자동 생성된 파일\nexport const SHEETS_URL = '%s';\n" "$SHEETS_URL" > _site/js/config.js
touch _site/.nojekyll
echo "built _site (base: ${BASE_URL:-relative})"
