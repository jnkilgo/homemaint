#!/bin/bash
# ============================================================
# HomeMaint — Proxmox LXC Setup Script (Debian 12)
# Run as root inside your LXC container
# ============================================================

set -e

APP_DIR="/opt/homemaint"
DATA_DIR="/opt/homemaint/data"
APP_USER="homemaint"

echo "=== HomeMaint Install ==="

# ── System packages ────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq python3 python3-pip python3-venv git curl

# ── Create app user ────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /bin/false --home $APP_DIR $APP_USER
    echo "Created user: $APP_USER"
fi

# ── Create directories ─────────────────────────────────────
mkdir -p $APP_DIR $DATA_DIR
chown -R $APP_USER:$APP_USER $APP_DIR

# ── Copy app files ─────────────────────────────────────────
# (Run this script from the homemaint project directory)
cp -r . $APP_DIR/
chown -R $APP_USER:$APP_USER $APP_DIR

# ── Python virtualenv + dependencies ──────────────────────
cd $APP_DIR
python3 -m venv venv
venv/bin/pip install --quiet --upgrade pip
venv/bin/pip install --quiet -r requirements.txt

echo "Python dependencies installed."

# ── Generate secret key ────────────────────────────────────
SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")

# ── Write service file ─────────────────────────────────────
# Update MQTT_BROKER to your HA IP before enabling
sed -i "s/change-me-to-a-long-random-string/$SECRET/" $APP_DIR/homemaint.service

cp $APP_DIR/homemaint.service /etc/systemd/system/homemaint.service

systemctl daemon-reload
systemctl enable homemaint
systemctl start homemaint

echo ""
echo "=== Done! ==="
echo "HomeMaint is running at: http://$(hostname -I | awk '{print $1}'):8000"
echo "API docs:                http://$(hostname -I | awk '{print $1}'):8000/docs"
echo "Default login:           justin / changeme"
echo ""
echo "Next steps:"
echo "  1. Edit /etc/systemd/system/homemaint.service — set MQTT_BROKER to your HA IP"
echo "  2. systemctl restart homemaint"
echo "  3. Change default password via the app or API"
echo ""
echo "Logs: journalctl -u homemaint -f"
