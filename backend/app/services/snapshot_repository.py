import hashlib
import threading
from dataclasses import dataclass
from pathlib import Path

from pydantic import ValidationError
from app.schemas.snapshot import Snapshot


class DataError(Exception):
    def __init__(self, code: str, message: str):
        self.code, self.message = code, message
        super().__init__(message)


@dataclass(frozen=True)
class CachedSnapshot:
    content: bytes
    etag: str
    generated: str


class SnapshotRepository:
    def __init__(self, path: Path):
        self.path = path
        self._signature = None
        self._cached = None
        self._lock = threading.Lock()

    @staticmethod
    def signature(stat):
        return (stat.st_mtime_ns, stat.st_ctime_ns, stat.st_size, stat.st_ino)

    def get(self) -> CachedSnapshot:
        with self._lock:
            try:
                before = self.path.stat()
                signature = self.signature(before)
                if self._cached is not None and self._signature == signature:
                    return self._cached
                if before.st_size > 64*1024*1024:
                    raise DataError('DATA_INVALID', 'O snapshot excede o limite de tamanho permitido.')
                content = self.path.read_bytes()
                if self.signature(self.path.stat()) != signature:
                    raise DataError('DATA_UNAVAILABLE', 'O snapshot está sendo atualizado. Tente novamente.')
                parsed = Snapshot.model_validate_json(content)
                self._cached = CachedSnapshot(content, '"'+hashlib.sha256(content).hexdigest()+'"', parsed.meta.generated.isoformat())
                self._signature = signature
                return self._cached
            except (OSError, DataError, ValidationError) as error:
                # Não servir uma cópia antiga como se fosse a revisão atual.
                self._cached = self._signature = None
                if isinstance(error, DataError):
                    raise
                if isinstance(error, ValidationError):
                    raise DataError('DATA_INVALID', 'O snapshot preparado é inválido ou incompleto.') from error
                raise DataError('DATA_UNAVAILABLE', 'Os dados preparados ainda não estão disponíveis.') from error
