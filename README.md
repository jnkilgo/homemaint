# HomeMaint

A self-hosted home and property maintenance tracker. Built with FastAPI + SQLite + React/Vite, designed to run on a Proxmox LXC or any Debian-based VM.

## Features

- Track properties, assets, and recurring maintenance tasks
- Task scheduling with interval types: days, hours, miles, seasonal
- Completion history with cost tracking
- Parts and spare inventory management
- Contractor management with asset associations
- MQTT + Home Assistant integration for push notifications
- AI-assisted task/parts suggestions
- Backup and restore via web UI

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI + SQLAlchemy + SQLite |
| Frontend | React + Vite |
| Scheduler | APScheduler |
| Notifications | MQTT / Home Assistant |
| Runtime | Python 3.11, Uvicorn |

## Quick Start (fresh VM)

```bash
# On a fresh Debian 12 VM/LXC, as root:
bash install.sh

# Then copy the app code:
rsync -av --exclude='venv' --exclude='data' --exclude='__pycache__' \
  ./ root@<VM-IP>:/opt/homemaint/

# Start the service:
ssh root@<VM-IP> "systemctl start homemaint"
```

See `install.sh` for full setup details.

## Directory Structure

```
homemaint/
├── backend/
│   ├── main.py              # FastAPI app entrypoint
│   ├── requirements.txt     # Python dependencies
│   ├── homemaint.service    # systemd service file
│   ├── app/
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   ├── database.py      # DB engine + session
│   │   ├── auth.py          # JWT auth
│   │   ├── task_engine.py   # Task status + enrichment
│   │   ├── escalation.py    # APScheduler jobs
│   │   ├── mqtt_manager.py  # MQTT/HA integration
│   │   └── routers/         # API route handlers
│   └── migrations/          # DB migration scripts
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── styles.css
│   │   ├── components/
│   │   └── views/
│   ├── package.json
│   └── vite.config.js
├── install.sh               # Fresh VM install script
└── ha_automation.yaml       # Home Assistant automation example
```

## Environment Variables

Set in the systemd service file or a `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `HOMEMAINT_DB_PATH` | Path to SQLite database | `/opt/homemaint/data/homemaint.db` |
| `HOMEMAINT_SECRET` | JWT secret key (generate with `python3 -c "import secrets; print(secrets.token_hex(32))"`) | — |
| `MQTT_BROKER` | MQTT broker IP | `192.168.1.52` |
| `MQTT_PORT` | MQTT broker port | `1883` |
| `MQTT_USERNAME` | MQTT username | — |
| `MQTT_PASSWORD` | MQTT password | — |
| `NOTIFICATIONS_ENABLED` | Enable MQTT push notifications | `false` |
| `TOKEN_EXPIRE_MINUTES` | JWT token expiry | `1440` |

## Backup & Restore

In the web UI: **Settings → Backup & Restore**

- Download a zip of the database + uploads
- Restore by uploading a backup zip (replaces all current data)

## Deployment (frontend)

```bash
cd frontend
npm install
npm run build
# Copy dist/ to /opt/homemaint/static/ on the server
```

## License

Private — not yet licensed for public distribution.
