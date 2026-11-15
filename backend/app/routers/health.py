from fastapi import APIRouter, Request
from pydantic import BaseModel
from app.services.snapshot_repository import DataError

router = APIRouter(prefix='/api', tags=['Health'])


class Health(BaseModel):
    status: str
    contractVersion: str
    dataAvailable: bool
    dataRevision: str | None
    dataError: str | None


@router.get('/health', response_model=Health)
def health(request: Request):
    try:
        cached = request.app.state.snapshots.get()
        return Health(status='ok', contractVersion='0.3', dataAvailable=True, dataRevision=cached.etag.strip('"'), dataError=None)
    except DataError as error:
        return Health(status='ok', contractVersion='0.3', dataAvailable=False, dataRevision=None, dataError=error.code)
