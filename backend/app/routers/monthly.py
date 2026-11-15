from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix='/api/monthly-rainfall', tags=['Monthly rainfall'])


@router.get('')
def manifest(request: Request):
    return JSONResponse(request.app.state.monthly.manifest(), headers={'Cache-Control':'no-cache'})


@router.get('/years/{year}')
def year(request: Request, year: int, revision: str | None = Query(None, max_length=80)):
    result = request.app.state.monthly.year(year, revision)
    return JSONResponse(result, headers={'Cache-Control':'public, max-age=86400, immutable' if revision else 'no-cache',
                                        'ETag':f'"{result["revision"]}-{year}"'})


@router.get('/cells/{cell_id}/timeseries')
def cell(request: Request, cell_id: str):
    return request.app.state.monthly.detail(cell_id)
