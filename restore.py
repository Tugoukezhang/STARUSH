"""Restore a Cat Kitchen backup with Python 3, GnuPG 2 and Zstandard (delta snapshots)."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

root = Path(__file__).resolve().parent
cli = argparse.ArgumentParser(description=__doc__)
cli.add_argument("--key", type=Path, required=True, help="Separate recovery key file")
cli.add_argument("--out", type=Path, required=True, help="Directory for restored ZIPs")
cli.add_argument("--version", help="Defaults to the latest snapshot")
args = cli.parse_args()
key = args.key.resolve(strict=True)
manifest = json.loads((root / "snapshots.json").read_text())
version = args.version or manifest["latest"]
if version not in manifest["versions"]:
    cli.error("Version not in this backup")
args.out.mkdir(exist_ok=True, parents=True)
out = args.out.resolve()

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for buf in iter(lambda: f.read(1024 * 1024), b""):
            h.update(buf)
    return h.hexdigest()

with tempfile.TemporaryDirectory(dir=out) as scratch:
    temp = Path(scratch)
    home = temp / "gnupg"
    home.mkdir(mode=0o700)
    def restore(name, deliver=False):
        row = manifest["files"][name]
        dest = out / name
        if dest.exists():
            if digest(dest) == row["sha256"]:
                return dest
            raise SystemExit(f"Existing output has different contents: {dest}")
        local = temp / name
        if not local.is_file():
            enc = temp / (name + ".gpg")
            with enc.open("wb") as target:
                for part in row["parts"]:
                    source = root / part["path"]
                    if digest(source) != part["sha256"]:
                        raise SystemExit(f"Damaged backup part: {source.name}")
                    with source.open("rb") as f:
                        shutil.copyfileobj(f, target)
            delta = row.get("basis")
            plain = temp / (name + ".patch") if delta else local
            subprocess.run(["gpg", "--homedir", str(home), "--batch", "--no-symkey-cache",
                            "--pinentry-mode", "loopback", "--passphrase-file", str(key),
                            "--output", str(plain), "--decrypt", str(enc)], check=True)
            enc.unlink()
            if delta:
                base = restore(delta)
                subprocess.run(["zstd", "-dq", "--patch-from=" + str(base),
                                "-o", str(local), str(plain)], check=True)
                plain.unlink()
            if digest(local) != row["sha256"]:
                raise SystemExit(f"Restored digest mismatch: {name}")
            with zipfile.ZipFile(local) as z:
                bad = z.testzip()
                if bad is not None:
                    raise SystemExit(f"Damaged ZIP member: {name}/{bad}")
        if deliver:
            local.replace(dest)
            print(dest)
            return dest
        return local
    for item in manifest["versions"][version]:
        restore(item, deliver=True)
