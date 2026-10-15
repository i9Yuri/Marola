#!/usr/bin/env bash
# ==============================================================================
# JustPlay - Launcher de Inicialização Rápida em Modo Desenvolvimento
# Permite disparo direto por duplo clique em gerenciadores de arquivos (Dolphin/Nautilus)
# ou execução via terminal sem necessidade de empacotamento (dist/build).
# ==============================================================================

set -euo pipefail

# 1. Resolução determinística do diretório raiz do projeto
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR" || exit 1

# 2. Configuração de arquivo de log para execuções não-interativas (duplo clique gráfico)
LOG_FILE="$DIR/justplay-dev.log"
if [ ! -t 1 ]; then
  exec >> "$LOG_FILE" 2>&1
  echo "--- JustPlay Dev Session Iniciada: $(date '+%Y-%m-%d %H:%M:%S') ---"
fi

# 3. Prevenção de instâncias concorrentes (anti-sobreposição por cliques múltiplos)
LOCK_FILE="/tmp/justplay-dev-${USER:-$UID}.lock"
if command -v flock >/dev/null 2>&1; then
  exec 200>"$LOCK_FILE"
  if ! flock -n 200; then
    echo "[JustPlay] Uma instância da aplicação já está em execução." >&2
    if command -v notify-send >/dev/null 2>&1; then
      notify-send "JustPlay" "A aplicação já está em execução." -u normal -i audio-player 2>/dev/null || true
    fi
    exit 0
  fi
fi

# 4. Verificação de integridade de dependências locais
if [ ! -d "$DIR/node_modules" ] || { [ ! -x "$DIR/node_modules/.bin/electron" ] && ! command -v npm >/dev/null 2>&1; }; then
  MSG="Dependências não instaladas ou incompletas. Execute 'npm install' no diretório do projeto antes de iniciar o JustPlay."
  echo "[JustPlay ERRO] $MSG" >&2
  if command -v notify-send >/dev/null 2>&1; then
    notify-send "JustPlay - Erro de Inicialização" "$MSG" -u critical -i dialog-error 2>/dev/null || true
  fi
  exit 1
fi

# 5. Tratamento de encerramento gracioso de subprocessos filhos (sem zumbis)
ELECTRON_PID=""
cleanup() {
  trap - SIGINT SIGTERM EXIT
  if [ -n "$ELECTRON_PID" ] && kill -0 "$ELECTRON_PID" 2>/dev/null; then
    kill -TERM "$ELECTRON_PID" 2>/dev/null || true
    wait "$ELECTRON_PID" 2>/dev/null || true
  fi
  kill 0 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

# 6. Invocação do Electron em tempo real (runtime de desenvolvimento)
if [ -x "$DIR/node_modules/.bin/electron" ]; then
  "$DIR/node_modules/.bin/electron" . --no-sandbox "$@" &
  ELECTRON_PID=$!
else
  npm run start -- "$@" &
  ELECTRON_PID=$!
fi

# Aguarda encerramento da janela principal
wait "$ELECTRON_PID"
