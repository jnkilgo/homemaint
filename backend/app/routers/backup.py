import os
import io
import zipfile
import shutil
import tempfile
from datetime import datetime

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine

from app.auth import require_admin

router = APIRouter()

DB_PATH = os.getenv("HOMEMAINT_DB_PATH", "/opt/homemaint/data/homemaint.db")
UPLOADS_DIR = "/opt/homemaint/uploads"


@router.get("/download")
def download_backup(_=Depends(require_admin)):
    """Download a zip backup of the database and any uploaded files."""
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    zip_filename = f"homemaint_backup_{timestamp}.zip"

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Always include the database
        if os.path.exists(DB_PATH):
            zf.write(DB_PATH, "homemaint.db")

        # Include uploads directory if it exists
        if os.path.isdir(UPLOADS_DIR):
            for root, dirs, files in os.walk(UPLOADS_DIR):
                for file in files:
                    filepath = os.path.join(root, file)
                    arcname = os.path.relpath(filepath, os.path.dirname(UPLOADS_DIR))
                    zf.write(filepath, arcname)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
    )


@router.post("/restore")
async def restore_backup(file: UploadFile = File(...), _=Depends(require_admin)):
    """Restore from a backup zip. Replaces the current database and uploads."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(400, "File must be a .zip backup")

    contents = await file.read()

    # Validate it's a real zip with a database inside
    try:
        with zipfile.ZipFile(io.BytesIO(contents)) as zf:
            names = zf.namelist()
            if "homemaint.db" not in names:
                raise HTTPException(400, "Invalid backup: homemaint.db not found in zip")
    except zipfile.BadZipFile:
        raise HTTPException(400, "Invalid or corrupted zip file")

    # Write to a temp dir first, then swap
    with tempfile.TemporaryDirectory() as tmpdir:
        with zipfile.ZipFile(io.BytesIO(contents)) as zf:
            zf.extractall(tmpdir)

        # Dispose all DB connections before replacing
        from app.database import engine
        engine.dispose()

        # Replace database
        tmp_db = os.path.join(tmpdir, "homemaint.db")
        backup_db = DB_PATH + ".pre_restore"
        if os.path.exists(DB_PATH):
            shutil.copy2(DB_PATH, backup_db)  # keep a safety copy
        shutil.copy2(tmp_db, DB_PATH)

        # Replace uploads if present in backup
        tmp_uploads = os.path.join(tmpdir, "uploads")
        if os.path.isdir(tmp_uploads):
            if os.path.isdir(UPLOADS_DIR):
                shutil.rmtree(UPLOADS_DIR)
            shutil.copytree(tmp_uploads, UPLOADS_DIR)

    return {"ok": True, "message": "Restore complete. Please reload the app."}
