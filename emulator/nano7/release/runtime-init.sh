#!/bin/busybox sh
export PATH=/bin:/usr/bin

busybox mount -t devtmpfs devtmpfs /dev || exec busybox poweroff -f
exec </dev/console >/dev/console 2>&1
set -eu
busybox mount -t proc proc /proc
busybox mount -t sysfs sysfs /sys
busybox mkdir -p /run/nano7
cd /run/nano7

mode=check
for argument in $(busybox cat /proc/cmdline); do
    case "$argument" in nano7.mode=*) mode=${argument#*=} ;; esac
done
qemu=/usr/bin/qemu-system-arm
assets=/nano7
trap 'printf "NANO7_RESULT FAIL %s\n" "$mode"; busybox poweroff -f' EXIT

linux_boot() {
    python3 -u "$assets/boot-linux.py" "$qemu" "$assets/zImage" "$assets/n31.dtb" \
        "$assets/n31-initramfs.cpio.gz" --log linux.log
}

display_check() {
    python3 -u "$assets/verify-display-controls.py" "$qemu" "$assets/display-controls.bin" display
}

audio_check() {
    python3 -u "$assets/verify-audio-storage.py" "$qemu" "$assets/audio-storage.bin" audio
    printf 'NANO7_WAV_BEGIN\n'
    busybox base64 audio/audio-run1.wav
    printf 'NANO7_WAV_END\n'
}

case "$mode" in
    check)
        linux_boot
        display_check
        audio_check
        ;;
    linux) linux_boot ;;
    audio) audio_check ;;
    display)
        while IFS= read -r module; do
            busybox insmod "$module"
        done < /nano7/modules/list
        busybox ifconfig eth0 10.0.2.15 netmask 255.255.255.0 up
        busybox cp "$assets/display-controls.bin" guest.bin
        "$qemu" -M nano7,entry=0x08000000,os-image=guest.bin \
            -L /usr/share/qemu -nodefaults -nic none -display none -vnc 10.0.2.15:0 \
            -serial stdio -monitor none 2>inner-qemu.log || {
            busybox cat inner-qemu.log >&2
            exit 1
        }
        ;;
    *) exit 2 ;;
esac
trap - EXIT
printf 'NANO7_RESULT OK %s\n' "$mode"
busybox poweroff -f
