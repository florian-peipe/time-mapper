#!/usr/bin/env bash
# Patch the IPA so Sideloader's re-signing doesn't trip iOS dyld's
# "segment __LINKEDIT filesize exceeds vmsize" check.
#
# Sideloader 1.0-pre4 appends signature bytes to __LINKEDIT without bumping
# the segment's vmsize. iOS 17+ refuses to load the Mach-O. This script
# pre-reserves 1 MB of vmsize headroom in every Mach-O inside the IPA so
# the signed output lands within vmsize.
#
# Usage:
#   ./scripts/patch-ipa-for-sideloader.sh <path-to-unsigned.ipa> [out.ipa]
set -euo pipefail

IN_IPA="${1:?usage: $0 <in.ipa> [out.ipa]}"
OUT_IPA="${2:-${IN_IPA%.ipa}-patched.ipa}"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "=== unpacking $IN_IPA ==="
unzip -q "$IN_IPA" -d "$WORKDIR"

APP_DIR="$(find "$WORKDIR/Payload" -maxdepth 1 -name '*.app' | head -1)"
[ -n "$APP_DIR" ] || { echo "no .app bundle found in Payload/"; exit 1; }

echo "=== patching Mach-O __LINKEDIT ==="
python3 - "$APP_DIR" <<'PY'
import os, struct, sys
app = sys.argv[1]
HEADROOM = 0x100000  # 1 MB

def is_macho(path):
    try:
        with open(path, "rb") as f:
            magic = f.read(4)
        return magic == b"\xcf\xfa\xed\xfe"
    except OSError:
        return False

patched = 0
for root, _, files in os.walk(app):
    for name in files:
        p = os.path.join(root, name)
        if not is_macho(p):
            continue
        with open(p, "r+b") as f:
            data = bytearray(f.read())
            ncmds, _ = struct.unpack_from("<II", data, 16)
            off = 32
            for _ in range(ncmds):
                cmd, cmdsize = struct.unpack_from("<II", data, off)
                if cmd == 0x19:  # LC_SEGMENT_64
                    segname = data[off + 8 : off + 24].rstrip(b"\0").decode()
                    vmaddr, vmsize, fileoff, filesize = struct.unpack_from(
                        "<QQQQ", data, off + 24
                    )
                    if segname == "__LINKEDIT":
                        new_vmsize = (filesize + HEADROOM + 0x3FFF) & ~0x3FFF
                        if new_vmsize > vmsize:
                            print(f"  {p}  __LINKEDIT vmsize {vmsize:#x} -> {new_vmsize:#x}")
                            struct.pack_into("<Q", data, off + 32, new_vmsize)
                            f.seek(0)
                            f.write(data)
                            f.truncate()
                            patched += 1
                        break
                off += cmdsize
print(f"Patched {patched} Mach-O binaries")
PY

echo "=== repacking to $OUT_IPA ==="
(cd "$WORKDIR" && zip -qr "$OUT_IPA.tmp" Payload)
mv "$OUT_IPA.tmp" "$OUT_IPA"
ls -la "$OUT_IPA"
echo "done."
