from fastapi import APIRouter, Query, Request

router = APIRouter(prefix='/api/grids', tags=['Native grids'])


@router.get('')
def catalog(request: Request):
    return request.app.state.grids.catalog()


@router.get('/{grid_id}/cells')
def cells(request: Request, grid_id: str, indicator: str = Query(...),
          start: int = Query(2001, ge=1900, le=2100), end: int = Query(2024, ge=1900, le=2100),
          bbox: str = Query('-58,-34,-47,-22', max_length=120), limit: int = Query(20000, ge=1, le=20000)):
    return request.app.state.grids.cells(grid_id, indicator, start, end, bbox, limit)


@router.get('/{grid_id}/cells/{cell_id}/timeseries')
def timeseries(request: Request, grid_id: str, cell_id: str, indicator: str = Query(...),
               start: int = Query(2001, ge=1900, le=2100), end: int = Query(2024, ge=1900, le=2100)):
    return request.app.state.grids.detail(grid_id, cell_id, indicator, start, end)
