"""
HomeMaint - Home & Property Maintenance Tracker
Main application entrypoint — M3: MQTT + Escalation Engine
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from app.database import engine, Base
from app.routers import components, task_parts, ai
from app.routers import backup as backup_router
from app.routers import (
    asset_loans,
    auth, properties, assets, tasks, parts,
    completion_logs, spare_inventory, paint_records,
    contractors, notes, users, settings, imports
)
from app.seed import seed_database
from app.mqtt_manager import mqtt_manager
from app.escalation import start_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

_scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _scheduler

    # Database — run Alembic migrations, fall back to create_all for SQLite dev
    try:
        from alembic.config import Config
        from alembic import command
        from sqlalchemy import inspect as sa_inspect
        alembic_cfg = Config("/app/alembic.ini") if os.path.exists("/app/alembic.ini") else Config("alembic.ini")
        # Stamp baseline if alembic_version table doesn't exist yet
        inspector = sa_inspect(engine)
        if 'alembic_version' not in inspector.get_table_names():
            Base.metadata.create_all(bind=engine)
            command.stamp(alembic_cfg, "head")
        else:
            command.upgrade(alembic_cfg, "head")
    except Exception as e:
        logger.warning(f"Alembic migration failed, falling back to create_all: {e}")
        Base.metadata.create_all(bind=engine)
    seed_database()

    # MQTT
    connected = mqtt_manager.connect()
    if connected:
        logger.info("MQTT connected successfully")
    else:
        logger.warning("MQTT unavailable — running without HA integration")

    # Escalation scheduler
    _scheduler = start_scheduler()

    yield

    # Shutdown
    if _scheduler:
        _scheduler.shutdown(wait=False)
    mqtt_manager.disconnect()


app = FastAPI(
    title="HomeMaint API",
    description="Home & Property Maintenance Tracker",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(auth.router,            prefix="/api/auth",        tags=["Auth"])
app.include_router(users.router,           prefix="/api/users",       tags=["Users"])
app.include_router(properties.router,      prefix="/api/properties",  tags=["Properties"])
app.include_router(assets.router,          prefix="/api/assets",      tags=["Assets"])
app.include_router(tasks.router,           prefix="/api/tasks",       tags=["Tasks"])
app.include_router(parts.router,           prefix="/api/parts",       tags=["Parts"])
app.include_router(spare_inventory.router, prefix="/api/spares",      tags=["Spare Inventory"])
app.include_router(completion_logs.router, prefix="/api/logs",        tags=["Completion Logs"])
app.include_router(paint_records.router,   prefix="/api/paint",       tags=["Paint Records"])
app.include_router(contractors.router,     prefix="/api/contractors", tags=["Contractors"])
app.include_router(notes.router,           prefix="/api/notes",       tags=["Asset Notes"])
app.include_router(settings.router,        prefix="/api/settings",    tags=["Settings"])
app.include_router(ai.router,              prefix="/api/ai",          tags=["AI"])
app.include_router(imports.router,         prefix="/api/import",      tags=["Import"])
app.include_router(components.router,      prefix="/api/components",  tags=["Components"])
app.include_router(asset_loans.router,     prefix="/api/asset-loans", tags=["Asset Loans"])
app.include_router(task_parts.router,      prefix="/api/task-parts",  tags=["Task Parts"])
app.include_router(backup_router.router, prefix="/api/backup", tags=["backup"])


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "version": "1.1.0",
        "mqtt": mqtt_manager.connected,
    }


@app.post("/api/mqtt/trigger", tags=["MQTT"])
def trigger_escalation():
    """Manually trigger the escalation engine — useful for testing."""
    from app.escalation import run_escalation
    import threading
    threading.Thread(target=run_escalation, daemon=True).start()
    return {"ok": True, "message": "Escalation run triggered"}


# Serve React frontend
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
