#!/bin/bash
set -e

HOST="homemaint-dev"
REMOTE="/opt/homemaint"
REPO="/Users/justin/Downloads/archive homematin/homemaint-repo"

echo "==> Deploying M9 backend to $HOST..."

scp "$REPO/backend/app/models.py"            $HOST:$REMOTE/app/models.py
scp "$REPO/backend/app/seed.py"              $HOST:$REMOTE/app/seed.py
scp "$REPO/backend/app/email.py"             $HOST:$REMOTE/app/email.py
scp "$REPO/backend/app/database.py"          $HOST:$REMOTE/app/database.py
scp "$REPO/backend/app/routers/auth.py"      $HOST:$REMOTE/app/routers/auth.py
scp "$REPO/backend/app/routers/properties.py" $HOST:$REMOTE/app/routers/properties.py
scp "$REPO/backend/app/routers/assets.py"    $HOST:$REMOTE/app/routers/assets.py
scp "$REPO/backend/app/routers/tasks.py"     $HOST:$REMOTE/app/routers/tasks.py
scp "$REPO/migrate_m9.py"                    $HOST:$REMOTE/migrate_m9.py

echo "==> Running M9 database migration..."
ssh $HOST "cd $REMOTE && python3 migrate_m9.py"

echo "==> Installing dependencies..."
ssh $HOST "/opt/homemaint/venv/bin/pip install httpx 'pydantic[email]' psycopg2-binary --quiet"

echo "==> Restarting service..."
ssh $HOST "systemctl restart homemaint"
sleep 2
ssh $HOST "systemctl status homemaint --no-pager -l | head -5"

echo "==> Done. Dev app: http://192.168.1.194:8000"
