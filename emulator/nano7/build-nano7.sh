#!/usr/bin/env bash
set -euo pipefail

source_dir=$(realpath "${1:?usage: build-nano7.sh NANOEMU_DIR [QEMU_TARBALL]}")
emulator="$source_dir/emulator"
if [[ $# -ge 2 ]]; then
    mkdir -p "$emulator/vendor"
    cp -- "$2" "$emulator/vendor/qemu-9.1.2.tar.xz"
fi

export NANOEMU_SYSTEM_PKG_CONFIG
NANOEMU_SYSTEM_PKG_CONFIG=$(command -v pkg-config)

# Use Debian's installed build dependencies with the upstream Linux script.
# The marker skips the Ubuntu sysroot download, and the wrapper keeps
# upstream's configure invocation intact.
if [[ -e "$emulator/sysroot/root/usr/bin/pkg-config" &&
      ! -e "$emulator/tools/pkg-config.phase1-original" ]]; then
    echo 'Use a clean source checkout without an existing sysroot.' >&2
    exit 1
fi
mkdir -p "$emulator/sysroot/root/usr/bin"
ln -sfn "$NANOEMU_SYSTEM_PKG_CONFIG" "$emulator/sysroot/root/usr/bin/pkg-config"
if [[ ! -e "$emulator/tools/pkg-config.phase1-original" ]]; then
    cp -p "$emulator/tools/pkg-config" "$emulator/tools/pkg-config.phase1-original"
fi
restore_wrapper() {
    cp -p "$emulator/tools/pkg-config.phase1-original" "$emulator/tools/pkg-config"
}
trap restore_wrapper EXIT
cat > "$emulator/tools/pkg-config" <<'EOF'
#!/bin/sh
exec "$NANOEMU_SYSTEM_PKG_CONFIG" "$@"
EOF
bash "$emulator/build.sh"
