from fastapi import APIRouter, Request, Response
from app.schemas.snapshot import Snapshot

router = APIRouter(prefix='/api', tags=['Snapshot'])


@router.get('/snapshot', response_model=Snapshot, responses={304: {'description': 'Não modificado'}, 503: {'description': 'Dados indisponíveis ou inválidos'}})
def snapshot(request: Request):
    cached = request.app.state.snapshots.get()
    headers = {'ETag': cached.etag, 'Cache-Control': 'public, no-cache', 'X-Data-Generated': cached.generated}
    candidates = request.headers.get('if-none-match', '')
    if candidates.strip() == '*' or cached.etag in [tag.strip().removeprefix('W/') for tag in candidates.split(',')]:
        return Response(status_code=304, headers=headers)
    # Bytes já validados em memória; nenhuma leitura de raw ou serialização extra.
    return Response(cached.content, media_type='application/json', headers=headers)
