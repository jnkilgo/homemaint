#!/bin/bash
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

section "Configuration"

read -p "App port [8000]: " APP_PORT
APP_PORT=${APP_PORT:-8000}

read -p "Enable MQTT notifications? [y/N]: " ENABLE_NOTIF

NOTIFICATIONS_ENABLED="false"

if [[ "$ENABLE_NOTIF" =~ ^[Yy]$ ]]; then
  NOTIFICATIONS_ENABLED="true"
  read -p "MQTT broker IP: " MQTT_BROKER
  read -p "MQTT port [1883]: " MQTT_PORT
  MQTT_PORT=${MQTT_PORT:-1883}
  read -p "MQTT username [mqtt_user]: " MQTT_USERNAME
  MQTT_USERNAME=${MQTT_USERNAME:-mqtt_user}
  read -sp "MQTT password: " MQTT_PASSWORD
  echo ""
else
  MQTT_BROKER="localhost"
  MQTT_PORT="1883"
  MQTT_USERNAME=""
  MQTT_PASSWORD=""
fi

SECRET_KEY=$(python3 - <<EOF
import secrets
print(secrets.token_hex(32))
EOF
)

section "Installing dependencies"

apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv git curl unzip ca-certificates sqlite3

if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

section "Creating system user"

if ! id $APP_USER &>/dev/null; then
  useradd -r -s /bin/false -d $INSTALL_DIR $APP_USER
fi

section "Fetching HomeMaint"

if [ -d "$INSTALL_DIR/.git" ]; then
  cd $INSTALL_DIR
  git pull
else
  rm -rf $INSTALL_DIR
  git clone $REPO_URL $INSTALL_DIR
fi

cd $INSTALL_DIR
mkdir -p data static uploads

section "Python setup"

python3 -m venv venv
venv/bin/pip install --upgrade pip
venv/bin/pip install -r backend/requirements.txt

section "Building frontend"

cd frontend
npm install
npm run build

rm -rf ../static/*
cp -r dist/* ../static/

cd $INSTALL_DIR

section "Copy backend"

cp backend/main.py main.py
cp -r backend/app .

section "Initializing database"

venv/bin/python <<EOF
import sys
sys.path.append("$INSTALL_DIR")

from app.database import engine, Base
import app.models

Base.metadata.create_all(bind=engine)

print("Database initialized")
EOF

section "Creating admin user"

venv/bin/python <<EOF
import sqlite3, bcrypt

db="$INSTALL_DIR/data/homemaint.db"

conn=sqlite3.connect(db)
cur=conn.cursor()

pw=bcrypt.hashpw(b"changeme", bcrypt.gensalt()).decode()

cur.execute("""
INSERT OR IGNORE INTO users (username,display_name,password_hash,role)
VALUES (?,?,?,?)
""",("admin","admin",pw,"admin"))

conn.commit()
conn.close()

print("Admin user ready")
EOF

section "Creating systemd service"

cat > /etc/systemd/system/homemaint.service <<EOF
[Unit]
Description=HomeMaint
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port ${APP_PORT} --workers 1
Restart=on-failure

Environment=HOMEMAINT_DB_PATH=$INSTALL_DIR/data/homemaint.db
Environment=HOMEMAINT_SECRET=${SECRET_KEY}
Environment=MQTT_BROKER=${MQTT_BROKER}
Environment=MQTT_PORT=${MQTT_PORT}
Environment=NOTIFICATIONS_ENABLED=${NOTIFICATIONS_ENABLED}
Environment=MQTT_USERNAME=${MQTT_USERNAME}
Environment=MQTT_PASSWORD=${MQTT_PASSWORD}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable homemaint

chown -R $APP_USER:$APP_USER $INSTALL_DIR

section "Starting service"

systemctl restart homemaint
sleep 2

DEVICE_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "HomeMaint installed successfully"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Open:"
echo "http://${DEVICE_IP}:${APP_PORT}"
echo ""
echo "Login:"
echo "admin / changeme"
echo ""
echo "Logs:"
echo "journalctl -u homemaint -f"
echo ""
echo "Restart:"
echo "systemctl restart homemaint"
echo ""