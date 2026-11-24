# Phase 1 · NanoEmu headless build

See the [Phase 2 board smoke test](BOARD-SMOKE.md) for the guest and the
UART3 and N31 timer patches.

See [Phase 3 Linux boot](LINUX-BOOT.md) for the N31 kernel and BusyBox test.
See [Phase 4 display and controls](DISPLAY-CONTROLS.md) for the LCD, touch,
and button test.
See [Phase 5 audio and volume persistence](AUDIO-STORAGE.md) for the WAV
player and NAND restart check.
See the [Windows-hosted release](release/README.md) for the launcher,
portable runtime, and end-to-end checks.

## Build on Debian 12

These steps use NanoEmu commit `b9bc90a9d74b07d0e598598e86ee605344607048`
and QEMU 9.1.2. Run inside a Linux environment. The Windows test host used
a portable Debian guest under QEMU.

```sh
sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  git build-essential ninja-build pkg-config libglib2.0-dev libpixman-1-dev \
  zlib1g-dev libfdt-dev python3-venv python3-pip curl ca-certificates xz-utils patch

git clone https://github.com/tenspav/NanoEmu.git
git -C NanoEmu checkout --detach b9bc90a9d74b07d0e598598e86ee605344607048
git -C NanoEmu apply ../nano7-compiler-warnings.patch
curl -fL https://download.qemu.org/qemu-9.1.2.tar.xz -o qemu-9.1.2.tar.xz
printf '%s\n' '19fd9d7535a54d6e044e186402aa3b3b1bdfa87c392ec8884855592c8510c96f  qemu-9.1.2.tar.xz' | sha256sum -c
bash build-nano7.sh NanoEmu qemu-9.1.2.tar.xz
python3 verify-nano7.py NanoEmu/emulator/build/qemu-system-arm
```

The build wrapper uses Debian's installed GLib, Pixman and pkg-config with
NanoEmu's upstream build script. It restores the upstream pkg-config wrapper
after the build. Use a clean checkout for the first run. Clone inside Linux
to keep its shell scripts in LF format. If exporting a Windows checkout
with Git, use `git -c core.autocrlf=false archive` to create the Linux copy.

For the launch check, QMP queries the machine registry, VM state and CPU count,
and shuts down the paused emulator. The test uses a temporary working directory,
no guest network, and no USB passthrough. The machine loads its built-in
fallback when no firmware image is present. Guest boot and peripheral behavior
are later milestones.

## Windows-hosted Debian VM

Use a portable Windows QEMU installation and a Debian 12 amd64 genericcloud
QCOW2 image in a project directory. The Debian image used in this check had
SHA-512 below and was verified against Debian's checksum file.

```text
946b917a37882f16e5b3b0b2cbe5744637d0cd36190b5b53cbb21d14a54557d5b45e9e523021b8f52c1707dbe470489f3515458e0680ded76ee2574b4a8daf1b
```

Create an SSH key dedicated to the VM and give its public key to the seed
builder. Keep its private key local. With the downloaded image named
`debian-base.qcow2`, run from that project directory:

```powershell
node seed.mjs build_ed25519.pub seed.iso
qemu-img.exe create -f qcow2 -F qcow2 -b debian-base.qcow2 build-virtio.qcow2 14G
qemu-system-x86_64.exe -machine q35 -accel tcg,thread=multi -cpu max -smp 4 -m 4096 `
  -drive file=build-virtio.qcow2,if=virtio,format=qcow2 `
  -drive file=seed.iso,if=virtio,format=raw,readonly=on `
  -smbios 'type=1,serial=ds=nocloud' `
  -nic user,model=virtio-net-pci,hostfwd=tcp:127.0.0.1:40227-:22 `
  -serial file:vm-virtio.log -display none -monitor none
```

Use the VirtIO seed attachment shown here. The first attempt with the seed
attached as a CD-ROM did not provision the cloud guest. Once cloud-init
reports completion in the serial log, SSH to `debian@127.0.0.1` on port
40227 with the dedicated key and run the Debian build steps. Build
dependencies are installed into the guest disk.

The test host had 12 logical CPUs and did not expose WHPX to QEMU. The
build started with 4 virtual CPUs. After a graceful guest shutdown, it
resumed from the same Ninja build directory with 10 virtual CPUs. Choose a
CPU count appropriate for the host when reproducing the build.

The bundled source patch gives the LCD header guard a unique name,
prints a 32-bit guest address as hexadecimal in the debug log, and removes
an inner loop variable's shadowing. It leaves the emulated display height,
addresses, and DMA logic intact.
