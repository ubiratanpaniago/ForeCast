import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    snapshot_path: Path
    cors_origins: tuple[str, ...]
    grids_path: Path = BACKEND_ROOT / 'data/derived/grids'

    @classmethod
    def from_env(cls):
        path = Path(os.getenv('FORECAST_SNAPSHOT_PATH', 'data/derived/frontend/snapshot.json'))
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        origins = tuple(x.strip() for x in os.getenv(
            'FORECAST_CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'
        ).split(',') if x.strip())
        grids = Path(os.getenv('FORECAST_GRIDS_PATH', 'data/derived/grids'))
        if not grids.is_absolute():
            grids = BACKEND_ROOT / grids
        return cls(path.resolve(), origins, grids.resolve())
