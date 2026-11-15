import os
from dataclasses import dataclass
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Settings:
    snapshot_path: Path
    cors_origins: tuple[str, ...]

    @classmethod
    def from_env(cls):
        path = Path(os.getenv('FORECAST_SNAPSHOT_PATH', 'data/derived/frontend/snapshot.json'))
        if not path.is_absolute():
            path = BACKEND_ROOT / path
        origins = tuple(x.strip() for x in os.getenv(
            'FORECAST_CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173'
        ).split(',') if x.strip())
        return cls(path.resolve(), origins)
