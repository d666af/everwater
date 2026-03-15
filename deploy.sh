#!/bin/bash
# ─── Everwater Deploy Script ──────────────────────────────────────────────────
# Запускайте от root на сервере: bash deploy.sh
# Совместим с Ubuntu 20.04+ / Debian 11+
set -e

REPO_URL="https://github.com/d666af/everwater"   # замените на ваш репозиторий
INSTALL_DIR="/root/everwater"
SERVICE_NAME="everwater"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║     Everwater — Deploy Script        ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# ── 1. Проверка прав ──────────────────────────────────────────────────────────
[[ "$EUID" -ne 0 ]] && error "Запустите от root: sudo bash deploy.sh"

# ── 2. Docker ─────────────────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  warn "Docker не найден — устанавливаю..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  info "Docker установлен: $(docker --version)"
else
  info "Docker: $(docker --version)"
fi

if ! docker compose version &>/dev/null; then
  warn "Docker Compose plugin не найден — устанавливаю..."
  apt-get install -y docker-compose-plugin
fi
info "Docker Compose: $(docker compose version)"

# ── 3. Получение кода ─────────────────────────────────────────────────────────
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Репозиторий уже скачан — обновляю..."
  cd "$INSTALL_DIR"
  git fetch origin
  git reset --hard origin/claude/telegram-water-delivery-bot-FXOGT
else
  info "Клонирую репозиторий в $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  git checkout claude/telegram-water-delivery-bot-FXOGT
fi

# ── 4. .env файл ─────────────────────────────────────────────────────────────
if [ ! -f "$INSTALL_DIR/.env" ]; then
  warn ".env не найден — создаю из шаблона..."
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  ВАЖНО: заполните .env файл перед запуском!${NC}"
  echo -e "${YELLOW}  nano $INSTALL_DIR/.env${NC}"
  echo -e "${YELLOW}  Обязательно укажите:${NC}"
  echo -e "${YELLOW}    BOT_TOKEN   — токен вашего Telegram-бота${NC}"
  echo -e "${YELLOW}    ADMIN_IDS   — ваш Telegram ID (узнайте у @userinfobot)${NC}"
  echo -e "${YELLOW}    MINI_APP_URL — http://ВАШ_IP:3000${NC}"
  echo -e "${YELLOW}    POSTGRES_PASSWORD — придумайте надёжный пароль${NC}"
  echo -e "${YELLOW}    SECRET_KEY  — openssl rand -hex 32${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  read -p "  Нажмите Enter чтобы открыть редактор .env (или Ctrl+C для отмены)..." _
  nano "$INSTALL_DIR/.env"
else
  info ".env уже существует"
fi

# ── 5. Лого ───────────────────────────────────────────────────────────────────
LOGO_PATH="$INSTALL_DIR/frontend/public/logo.jpg"
if [ ! -f "$LOGO_PATH" ]; then
  warn "Файл $LOGO_PATH не найден!"
  warn "Скопируйте logo.jpg: cp /путь/к/logo.jpg $LOGO_PATH"
  warn "Продолжаем без лого — приложение запустится, лого будет пустым"
fi

# ── 6. Systemd сервис ─────────────────────────────────────────────────────────
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
if [ ! -f "$SERVICE_FILE" ]; then
  info "Устанавливаю systemd сервис..."
  # Обновляем путь в service-файле на реальный
  sed "s|/root/everwater|$INSTALL_DIR|g" \
    "$INSTALL_DIR/everwater.service" > "$SERVICE_FILE"
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  info "Сервис зарегистрирован: sudo systemctl start $SERVICE_NAME"
else
  info "Systemd сервис уже установлен — обновляю..."
  sed "s|/root/everwater|$INSTALL_DIR|g" \
    "$INSTALL_DIR/everwater.service" > "$SERVICE_FILE"
  systemctl daemon-reload
fi

# ── 7. Открываем порт в firewall (если ufw активен) ──────────────────────────
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  FRONTEND_PORT=$(grep FRONTEND_PORT "$INSTALL_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')
  PORT=${FRONTEND_PORT:-3000}
  ufw allow "$PORT/tcp" 2>/dev/null && info "UFW: порт $PORT открыт" || true
fi

# ── 8. Запуск ─────────────────────────────────────────────────────────────────
echo ""
read -p "  Запустить everwater сейчас? [y/N] " LAUNCH
if [[ "$LAUNCH" =~ ^[Yy]$ ]]; then
  info "Запускаю — сборка займёт 2-5 минут..."
  systemctl start "$SERVICE_NAME"
  sleep 3
  systemctl status "$SERVICE_NAME" --no-pager
  echo ""
  FRONTEND_PORT=$(grep FRONTEND_PORT "$INSTALL_DIR/.env" | cut -d= -f2 | tr -d '[:space:]')
  PORT=${FRONTEND_PORT:-3000}
  SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
  info "Готово! Открывайте: http://$SERVER_IP:$PORT"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Команды управления:${NC}"
echo -e "  sudo systemctl start   $SERVICE_NAME   — запустить"
echo -e "  sudo systemctl stop    $SERVICE_NAME   — остановить"
echo -e "  sudo systemctl restart $SERVICE_NAME   — перезапустить"
echo -e "  sudo systemctl status  $SERVICE_NAME   — статус"
echo -e "  sudo systemctl reload  $SERVICE_NAME   — пересобрать (hot reload)"
echo ""
echo -e "  Логи бота:      docker compose -f $INSTALL_DIR/docker-compose.prod.yml logs -f bot"
echo -e "  Логи бэкенда:   docker compose -f $INSTALL_DIR/docker-compose.prod.yml logs -f backend"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
