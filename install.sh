#!/bin/bash
# =============================================================================
# HomeMaint — Standalone Install Script
# Tested on: Debian 12 (Bookworm), Raspberry Pi OS (Bookworm)
#
# Usage (one command from a fresh machine):
#   curl -fsSL https://raw.githubusercontent.com/jnkilgo/homemaint/main/install.sh | sudo bash
#
#   Or download and run manually:
#   wget https://raw.githubusercontent.com/jnkilgo/homemaint/main/install.sh
#   sudo bash install.sh
#
# What this does:
#   1. Installs system dependencies (Python, Node.js, git)
#   2. Clones HomeMaint from GitHub
#   3. Builds the frontend
#   4. Sets up a systemd service
#   5. Starts the app
#
# After install the app will be available at http://<device-IP>:8000
# Default login: admin / changeme  (change in Settings after first login)
# =============================================================================

set -e

REPO_URL="https://github.com/jnkilgo/homemaint.git"
INSTALL_DIR="/opt/homemaint"
APP_USER="homemaint"

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ── Root check ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "Run as root: sudo bash install.sh"

echo ""
echo -e "${GREEN}  HomeMaint — Home & Property Maintenance Tracker${NC}"
echo ""

# ── Config prompts ────────────────────────────────────────────────────────────
section "Configuration"
echo ""
echo "Press Enter to accept defaults."
echo ""

read -p "App port [8000]: " APP_PORT
APP_PORT=${APP_PORT:-8000}

echo ""
echo "MQTT / Home Assistant notifications (optional)."
echo "Skip this if you don't use Home Assistant."
read -p "Enable MQTT notifications? [y/N]: " ENABLE_NOTIF
NOTIFICATIONS_ENABLED="false"

if [[ "$ENABLE_NOTIF" =~ ^[Yy]$ ]]; then
    NOTIFICATIONS_ENABLED="true"
    read -p "  MQTT broker IP: " MQTT_BROKER
    [[ -z "$MQTT_BROKER" ]] && error "MQTT broker IP required when MQTT is enabled"
    read -p "  MQTT port [1883]: " MQTT_PORT
    MQTT_PORT=${MQTT_PORT:-1883}
    read -p "  MQTT username [mqtt_user]: " MQTT_USERNAME
    MQTT_USERNAME=${MQTT_USERNAME:-mqtt_user}
    read -sp "  MQTT password: " MQTT_PASSWORD
    echo ""
else
    MQTT_BROKER="localhost"
    MQTT_PORT="1883"
    MQTT_USERNAME=""
    MQTT_PASSWORD=""
    info "Skipping MQTT — notifications disabled. Enable later in Settings."
fi

SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)

echo ""
section "Starting Installation"
echo ""

# ── System packages ───────────────────────────────────────────────────────────
info "Updating package lists…"
apt-get update -qq

info "Installing system dependencies…"
apt-get install -y -qq python3 python3-pip python3-venv git curl unzip ca-certificates

# ── Node.js ───────────────────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
    info "Installing Node.js 20…"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - &>/dev/null
    apt-get install -y -qq nodejs
    info "Node.js $(node --version) installed"
else
    info "Node.js already installed: $(node --version)"
fi

# ── System user ───────────────────────────────────────────────────────────────
info "Creating $APP_USER system user…"
if ! id $APP_USER &>/dev/null; then
    useradd -r -s /bin/false -d $INSTALL_DIR $APP_USER
fi

# ── Clone repo ────────────────────────────────────────────────────────────────
section "Fetching HomeMaint"

if [ -d "$INSTALL_DIR/.git" ]; then
    info "Existing install found — pulling latest…"
    cd $INSTALL_DIR
    git pull --quiet origin main
else
    if [ -d "$INSTALL_DIR" ]; then
        mv $INSTALL_DIR "${INSTALL_DIR}.bak.$(date +%s)"
        warn "Moved existing directory to ${INSTALL_DIR}.bak.*"
    fi
    info "Cloning from GitHub…"
    git clone --quiet $REPO_URL $INSTALL_DIR
    info "Cloned successfully"
fi

cd $INSTALL_DIR
mkdir -p $INSTALL_DIR/{data,static,uploads}

# ── Python venv ───────────────────────────────────────────────────────────────
section "Python Environment"

info "Creating virtual environment…"
python3 -m venv $INSTALL_DIR/venv

info "Installing Python dependencies…"
$INSTALL_DIR/venv/bin/pip install -q --upgrade pip
$INSTALL_DIR/venv/bin/pip install -q -r $INSTALL_DIR/backend/requirements.txt

# ── Frontend build ────────────────────────────────────────────────────────────
section "Building Frontend"

info "Installing npm packages…"
cd $INSTALL_DIR/frontend
npm install --silent

info "Building frontend…"
npm run build --silent

info "Deploying frontend to static dir…"
rm -rf $INSTALL_DIR/static/*
cp -r $INSTALL_DIR/frontend/dist/* $INSTALL_DIR/static/

# ── Backend setup ─────────────────────────────────────────────────────────────
section "App Setup"

info "Copying backend files…"
cp $INSTALL_DIR/backend/main.py $INSTALL_DIR/main.py
cp -rn $INSTALL_DIR/backend/app $INSTALL_DIR/app 2>/dev/null || true
rsync -a --exclude='__pycache__' $INSTALL_DIR/backend/app/ $INSTALL_DIR/app/ 2>/dev/null || \
    cp -rf $INSTALL_DIR/backend/app/* $INSTALL_DIR/app/

# ── Database init ─────────────────────────────────────────────────────────────
info "Initializing database…"
cd $INSTALL_DIR
HOMEMAINT_DB_PATH=$INSTALL_DIR/data/homemaint.db \
HOMEMAINT_SECRET=$SECRET_KEY \
$INSTALL_DIR/venv/bin/python3 -c "
from app.database import engine, Base
import app.models
Base.metadata.create_all(bind=engine)
print('  Database ready')
" 2>/dev/null || warn "DB will initialize on first start"

# ── systemd service ───────────────────────────────────────────────────────────
section "System Service"

info "Installing systemd service…"
cat > /etc/systemd/system/homemaint.service << EOF
[Unit]
Description=HomeMaint - Home & Property Maintenance Tracker
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port ${APP_PORT} --workers 1
Restart=on-failure
RestartSec=5

Environment=HOMEMAINT_DB_PATH=$INSTALL_DIR/data/homemaint.db
Environment=HOMEMAINT_SECRET=${SECRET_KEY}
Environment=MQTT_BROKER=${MQTT_BROKER}
Environment=MQTT_PORT=${MQTT_PORT}
Environment=NOTIFICATIONS_ENABLED=${NOTIFICATIONS_ENABLED}
Environment=MQTT_USERNAME=${MQTT_USERNAME}
Environment=MQTT_PASSWORD=${MQTT_PASSWORD}
Environment=TOKEN_EXPIRE_MINUTES=1440

StandardOutput=journal
StandardError=journal
SyslogIdentifier=homemaint

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable homemaint --quiet

# ── Permissions ───────────────────────────────────────────────────────────────
chown -R $APP_USER:$APP_USER $INSTALL_DIR

# ── Start ─────────────────────────────────────────────────────────────────────
info "Starting HomeMaint service…"
systemctl start homemaint
sleep 3

if systemctl is-active --quiet homemaint; then
    info "Service started successfully!"
else
    warn "Service failed to start — check: journalctl -u homemaint -n 30"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
DEVICE_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  HomeMaint installed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Open:     http://${DEVICE_IP}:${APP_PORT}"
echo "  Login:    admin / changeme"
echo ""
echo "  Logs:     journalctl -u homemaint -f"
echo "  Restart:  systemctl restart homemaint"
echo ""
echo "  ⚠  Change the default password in Settings after first login!"
echo ""
if [ "$NOTIFICATIONS_ENABLED" = "false" ]; then
    echo "  ℹ  MQTT disabled. Enable in Settings → Notifications."
    echo ""
fi
echo "  Secret key (save this): ${SECRET_KEY}"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
