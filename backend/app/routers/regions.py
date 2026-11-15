from fastapi import APIRouter, Query, Request

router = APIRouter(prefix='/api/regions', tags=['Regional trends'])


@router.get('')
def geometry(request: Request):
    """GeoJSON das 21 regiões intermediárias do IBGE e de PR/SC/RS."""
    return request.app.state.regions.geometry()


@router.get('/catalog')
def catalog(request: Request):
    return request.app.state.regions.catalog()


@router.get('/summary')
def summary(request: Request, indicator: str = Query(...)):
    """Estatística de todas as regiões para um indicador, sem séries."""
    return request.app.state.regions.summary(indicator)


@router.get('/cell-fdr')
def cell_fdr(request: Request, indicator: str = Query(...)):
    """Contagem, por região, das células com tendência após FDR (resultado do pipeline, sem recálculo)."""
    return request.app.state.regions.cell_fdr(indicator)


@router.get('/{region_id}/trends')
def trends(request: Request, region_id: str, indicator: str = Query(...),
           start: int = Query(2001, ge=1900, le=2100), end: int = Query(2024, ge=1900, le=2100)):
    return request.app.state.regions.trend(region_id, indicator, start, end)
