from fastapi import APIRouter, Request

router = APIRouter(prefix='/api/infrastructure', tags=['Infrastructure exposure'])


@router.get('')
def catalog(request: Request):
    """Fontes, parâmetros, totais e limitações do diagnóstico exploratório."""
    return request.app.state.infrastructure.catalog()


@router.get('/segments/{segment_id}')
def segment(request: Request, segment_id: str):
    """Um trecho com suas travessias candidatas."""
    return request.app.state.infrastructure.segment(segment_id)


@router.get('/{layer}')
def layer(request: Request, layer: str):
    """roads | crossings | terrain, em GeoJSON."""
    return request.app.state.infrastructure.layer(layer)
