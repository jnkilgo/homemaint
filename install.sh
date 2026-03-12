
#!/bin/bash
# =============================================================================
# HomeMaint — Standalone Install Script
# Tested on: Debian 12 (Bookworm), Raspberry Pi OS (Bookworm)
#
# Install with:
# curl -fsSL https://raw.githubusercontent.com/jnkilgo/homemaint/main/install.sh | sudo bash
#
# =============================================================================

set -e

REPO_URL="https://github.com/jnkilgo/homemaint.git"
INSTALL_DIR="/opt/homemaint"
APP_USER="homemaint"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
section() { echo -e "\n${BLUE}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

[[ $EUID -ne 0 ]] && error "Run as root: sudo bash install.sh"

echo ""
echo -e "${GREEN}HomeMaint — Home & Property Maintenance Tracker${NC}"
echo ""

# -----------------------------------------------------------------------------
# CONFIGURATION
# -----------------------------------------------------------------------------

section "Configuration"

read -p "App port [8000]: " APP_PORT
APP_PORT=${APP_PORT:-8000}

echo ""
echo "Create admin user"
read -p "Username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}

read -p "Password [changeme]: " ADMIN_PASS
ADMIN_PASS=${ADMIN_PASS:-changeme}

echo ""
echo "MQTT notifications (optional)"
read -p "Enable MQTT notifications? [y/N]: " ENABLE_NOTIF

NOTIFICATIONS_ENABLED="false"

if [[ "$ENABLE_NOTIF" =~ ^[Yy]$ ]]; then
    NOTIFICATIONS_ENABLED="true"
    read -p "MQTT broker IP: " MQTT_BROKER
    read -p "MQTT port [1883]: " MQTT_PORT
    MQTT_PORT=${MQTT_PORT:-1883}
else
    MQTT_BROKER="localhost"
    MQTT_PORT="1883"
fi

SECRET_KEY=$(python3 - <<EOF
import secrets
print(secrets.token_hex(32))
EOF
)

# -----------------------------------------------------------------------------
# PACKAGES
# -----------------------------------------------------------------------------

section "Installing dependencies"

apt-get update -qq
apt-get install -y -qq \
python3 python3-pip python3-venv git curl unzip ca-certificates sqlite3

if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

# -----------------------------------------------------------------------------
# USER
# -----------------------------------------------------------------------------

if ! id $APP_USER &>/dev/null; then
    useradd -r -s /bin/false -d $INSTALL_DIR $APP_USER
fi

# -----------------------------------------------------------------------------
# CLONE
# -----------------------------------------------------------------------------

section "Fetching HomeMaint"

if [ -d "$INSTALL_DIR/.git" ]; then
    cd $INSTALL_DIR
    git pull --quiet origin main
else
    rm -rf $INSTALL_DIR
    git clone --quiet $REPO_URL $INSTALL_DIR
fi

mkdir -p $INSTALL_DIR/{data,static,uploads}

cd $INSTALL_DIR

# -----------------------------------------------------------------------------
# PYTHON
# -----------------------------------------------------------------------------

section "Python setup"

python3 -m venv venv
venv/bin/pip install -q --upgrade pip
venv/bin/pip install -q -r backend/requirements.txt

# -----------------------------------------------------------------------------
# FRONTEND
# -----------------------------------------------------------------------------

section "Building frontend"

cd frontend
npm install --silent
npm run build --silent

rm -rf $INSTALL_DIR/static/*
cp -r dist/* $INSTALL_DIR/static/

cd $INSTALL_DIR

# -----------------------------------------------------------------------------
# BACKEND FILES
# -----------------------------------------------------------------------------

cp backend/main.py main.py
cp -r backend/app ./app

# -----------------------------------------------------------------------------
# DATABASE
# -----------------------------------------------------------------------------

section "Database setup"

HOMEMAINT_DB_PATH=$INSTALL_DIR/data/homemaint.db \
HOMEMAINT_SECRET=$SECRET_KEY \
venv/bin/python3 - <<EOF
from app.database import engine, Base
import app.models
Base.metadata.create_all(bind=engine)
EOF

# Create admin user

HASH=$(venv/bin/python3 - <<EOF
import bcrypt
print(bcrypt.hashpw(b"$ADMIN_PASS", bcrypt.gensalt()).decode())
EOF
)

sqlite3 $INSTALL_DIR/data/homemaint.db <<EOF
INSERT OR REPLACE INTO users
(username, display_name, password_hash, role)
VALUES ('$ADMIN_USER','$ADMIN_USER','$HASH','admin');
EOF

# -----------------------------------------------------------------------------
# SYSTEMD
# -----------------------------------------------------------------------------

section "Creating service"

cat > /etc/systemd/system/homemaint.service <<EOF
[Unit]
Description=HomeMaint
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port $APP_PORT
Restart=always

Environment=HOMEMAINT_DB_PATH=$INSTALL_DIR/data/homemaint.db
Environment=HOMEMAINT_SECRET=$SECRET_KEY
Environment=MQTT_BROKER=$MQTT_BROKER
Environment=MQTT_PORT=$MQTT_PORT
Environment=NOTIFICATIONS_ENABLED=$NOTIFICATIONS_ENABLED

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable homemaint

chown -R $APP_USER:$APP_USER $INSTALL_DIR

# -----------------------------------------------------------------------------
# START
# -----------------------------------------------------------------------------

section "Starting service"

systemctl restart homemaint

sleep 3

DEVICE_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}HomeMaint installed successfully${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Open:"
echo "http://${DEVICE_IP}:${APP_PORT}"
echo ""
echo "Login:"
echo "$ADMIN_USER / $ADMIN_PASS"
echo ""
echo "Logs:"
echo "journalctl -u homemaint -f"
echo ""
echo "Restart:"
echo "systemctl restart homemaint"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
