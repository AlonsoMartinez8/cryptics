#!/usr/bin/env bash
# Descarga todos los crípticos de un año ejecutando, dentro de la web,
#   await fetchDailyPuzzleFromSupabase("YYYY-MM-DD")
# con un navegador headless (Playwright), guarda los datos en la app Astro
# (app/src/data/cripticos.json) y genera el sitio estático en app/dist.
#
# Uso:
#   ./fetch-cripticos.sh https://web.com            # año actual
#   ./fetch-cripticos.sh https://web.com 2026
#   ./fetch-cripticos.sh https://web.com 2026 --from 2026-03-01 --to 2026-03-31 --concurrency 6 --headed
#
# Requiere Node.js 18+.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRAPER_DIR="$SCRIPT_DIR/scraper"
APP_DIR="$SCRIPT_DIR/app"
OUT_DIR="$APP_DIR/src/data"

URL="${1:-}"
if [[ -z "$URL" ]]; then
  read -rp "URL de la página web (p.ej. https://web.com): " URL
fi
[[ -z "$URL" ]] && { echo "✖ Falta la URL" >&2; exit 1; }
[[ "$URL" =~ ^https?:// ]] || URL="https://$URL"

if [[ $# -gt 0 ]]; then shift; fi
YEAR="$(date +%Y)"
if [[ "${1:-}" =~ ^[0-9]{4}$ ]]; then YEAR="$1"; shift; fi

INSTALL_DEPS=0
ARGS=()
for a in "$@"; do
  if [[ "$a" == "--install-deps" ]]; then INSTALL_DEPS=1; else ARGS+=("$a"); fi
done
set -- "${ARGS[@]+"${ARGS[@]}"}"

command -v node >/dev/null || { echo "✖ Node.js no está instalado" >&2; exit 1; }

cd "$SCRAPER_DIR"
if [[ ! -d node_modules/playwright ]]; then
  echo "→ Instalando Playwright (solo la primera vez)…"
  npm install --silent
fi
# Descarga Chromium si falta (no hace nada si ya está)
npx --yes playwright install chromium >/dev/null

# En Linux/WSL, Chromium necesita librerías del sistema (libnspr4, libnss3…)
if [[ "$INSTALL_DEPS" == 1 && "$(uname -s)" == Linux ]]; then
  echo "→ Instalando dependencias del sistema para Chromium (pide sudo)…"
  # sudo limpia el PATH: se lo pasamos para que encuentre node (nvm, fnm…)
  sudo env "PATH=$PATH" npx --yes playwright install-deps chromium
fi

node fetch.mjs --url "$URL" --year "$YEAR" --out "$OUT_DIR" "$@"


echo
echo "→ Generando la web estática (Astro)…"
cd "$APP_DIR"
if [[ ! -d node_modules/astro ]]; then
  npm install --silent
fi
# Si node_modules se instaló en otro sistema (Windows vs WSL), reinstala y reintenta
if ! npm run build --silent; then
  echo "→ Reinstalando dependencias de la app para este sistema…"
  rm -rf node_modules
  npm install --silent
  npm run build --silent
fi

echo
echo "✔ Web lista en: $APP_DIR/dist"
echo "  Para verla:  cd \"$APP_DIR\" && npm run preview"
