import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.config import Settings
from app.routers import health, snapshot, grids, regions, infrastructure, monthly
from app.services.monthly_repository import MonthlyRainfallRepository
from app.services.grid_repository import GridRepository, GridRequestError
from app.services.region_repository import RegionRepository
from app.services.infrastructure_repository import InfrastructureRepository
from app.services.snapshot_repository import DataError, SnapshotRepository


def create_app(settings: Settings | None = None):
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        app.state.snapshots = SnapshotRepository(settings.snapshot_path)
        app.state.grids = GridRepository(settings.grids_path)
        app.state.regions = RegionRepository(settings.regions_path)
        app.state.infrastructure = InfrastructureRepository(settings.infrastructure_path)
        app.state.monthly = MonthlyRainfallRepository(settings.monthly_path)
        yield

    app = FastAPI(title='ForeCast API', version='0.2.0', lifespan=lifespan)
    app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=1)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=['GET'], allow_headers=['If-None-Match'], expose_headers=['ETag', 'X-Data-Generated'])

    @app.exception_handler(DataError)
    async def data_error(request: Request, error: DataError):
        return JSONResponse({'error': {'code': error.code, 'message': error.message}}, status_code=503, headers={'Cache-Control': 'no-store'})

    @app.exception_handler(GridRequestError)
    async def grid_error(request: Request, error: GridRequestError):
        return JSONResponse({'error': {'code': error.code, 'message': error.message}}, status_code=error.status, headers={'Cache-Control': 'no-store'})

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, error: HTTPException):
        return JSONResponse({'error': {'code': 'NOT_FOUND' if error.status_code == 404 else 'HTTP_ERROR', 'message': str(error.detail)}}, status_code=error.status_code, headers=error.headers)

    @app.exception_handler(RequestValidationError)
    async def invalid_request(request: Request, error: RequestValidationError):
        return JSONResponse({'error': {'code': 'INVALID_FILTER', 'message': 'Parâmetros da requisição inválidos.'}}, status_code=422)

    @app.exception_handler(Exception)
    async def internal_error(request: Request, error: Exception):
        logging.getLogger('forecast').error('Falha na API', exc_info=error)
        return JSONResponse({'error': {'code': 'INTERNAL_ERROR', 'message': 'Não foi possível concluir a requisição.'}}, status_code=500)

    app.include_router(health.router)
    app.include_router(snapshot.router)
    app.include_router(grids.router)
    app.include_router(regions.router)
    app.include_router(infrastructure.router)
    app.include_router(monthly.router)
    return app


app = create_app()
