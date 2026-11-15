"""Validate and atomically publish a prepared snapshot; no scientific processing."""
import argparse
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.config import BACKEND_ROOT
from app.schemas.snapshot import Snapshot


def publish(source: Path, target: Path):
    content = source.read_bytes()
    Snapshot.model_validate_json(content)
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=target.parent, suffix='.tmp', delete=False) as file:
            temporary = Path(file.name)
            file.write(content)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, target)
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
    print(f'Snapshot validado e publicado: {target}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, default=BACKEND_ROOT/'data/derived/frontend/snapshot.json')
    args = parser.parse_args()
    publish(args.source, args.output)
