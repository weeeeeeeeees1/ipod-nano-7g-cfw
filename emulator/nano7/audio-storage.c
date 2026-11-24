/* SPDX-License-Identifier: GPL-2.0-or-later */
#include "nano7_guest.h"

#define AUDIO 0x3ca00000u
#define FMC 0x38a00000u
#define TRACK ((const volatile uint8_t *)0x08100000u)
#define SECTOR ((volatile uint32_t *)0x08200000u)
#define SETTING_PAGE 0x100u
#define SETTING_MAGIC 0x3556374eu
#define MAX_VOLUME 4

static uint32_t little_endian(const volatile uint8_t *bytes, unsigned count)
{
    uint32_t value = 0;
    for (unsigned i = 0; i < count; i++)
        value |= (uint32_t)bytes[i] << (8 * i);
    return value;
}

static void status(const char *name, unsigned value)
{
    while (*name)
        put(*name++);
    put(' ');
    put('0' + value / 10000 % 10);
    put('0' + value / 1000 % 10);
    put('0' + value / 100 % 10);
    put('0' + value / 10 % 10);
    put('0' + value % 10);
    put('\n');
}

static unsigned read_volume(void)
{
    REG(FMC) = 3;                     /* Select CE 0. */
    REG(FMC + 0x08) = 0x07;
    REG(FMC + 0x0c) = 0x10;          /* One 4 KiB sector, starting at sector 0. */
    REG(FMC + 0x10) = SETTING_PAGE;
    REG(FMC + 0x2c) = 7;
    REG(FMC + 0x04) = 1;
    REG(FMC + 0x08) = 0x7a;
    REG(FMC + 0x04) = 0x32;          /* Read metadata, then transfer the sector. */
    REG(FMC + 0x34) = (uintptr_t)SECTOR;
    __asm__ volatile("dsb sy" ::: "memory");
    unsigned volume = SECTOR[1];
    if (SECTOR[0] == SETTING_MAGIC && volume <= MAX_VOLUME && SECTOR[2] == ~volume) {
        status("A LOADED", volume);
        return volume;
    }
    status("A DEFAULT", MAX_VOLUME);
    return MAX_VOLUME;
}

static void save_volume(unsigned volume)
{
    for (unsigned i = 0; i < 1024; i++)
        SECTOR[i] = 0xffffffff;
    SECTOR[0] = SETTING_MAGIC;
    SECTOR[1] = volume;
    SECTOR[2] = ~volume;
    __asm__ volatile("dsb sy" ::: "memory");

    REG(FMC + 0x08) = 0x8a;
    REG(FMC + 0x0c) = SETTING_PAGE;
    REG(FMC + 0x2c) = 3;
    REG(FMC + 0x04) = 1;
    REG(FMC + 0x60) = 1;              /* Data metadata for the disposable sector. */
    REG(FMC + 0x64) = 0;
    REG(FMC + 0x68) = 0;
    REG(FMC + 0x6c) = 4;
    REG(FMC + 0x04) = 0x34;
    for (unsigned offset = 0; offset < 4096; offset += 1024) {
        REG(FMC + 0x34) = (uintptr_t)SECTOR + offset;
        REG(FMC + 0x04) = 0x260;
    }
    REG(FMC + 0x08) = 0x17;          /* Confirm the program operation. */
}

void guest_main(void)
{
    if (little_endian(TRACK, 4) != 0x46464952 ||
        little_endian(TRACK + 8, 4) != 0x45564157 ||
        little_endian(TRACK + 12, 4) != 0x20746d66 ||
        little_endian(TRACK + 16, 4) != 16 ||
        little_endian(TRACK + 20, 4) != 0x00010001 ||
        little_endian(TRACK + 24, 4) != 8000 ||
        little_endian(TRACK + 32, 4) != 0x00100002 ||
        little_endian(TRACK + 36, 4) != 0x61746164)
        fail();
    unsigned bytes = little_endian(TRACK + 40, 4);
    if (!bytes || bytes > 16000 || (bytes & 1))
        fail();

    unsigned volume = read_volume();
    unsigned previous = button_levels();
    if (previous != 31)
        fail();
    REG(AUDIO + 0x40) = 1500;         /* 12 MHz / 1500 = 8 kHz. */
    REG(AUDIO + 0x04) = 0x0b000099;
    REG(AUDIO + 0x08) = 6;
    REG(AUDIO) = 1;
    volatile uint16_t *fifo = (volatile uint16_t *)(AUDIO + 0x10);
    unsigned position = 0;
    unsigned frames = bytes / 2;
    int playing = 0;
    uint32_t next_frame = REG(TICKS);
    uint32_t next_buttons = next_frame;
    line("A READY");
    for (;;) {
        uint32_t now = REG(TICKS);
        if ((int32_t)(now - next_buttons) >= 0) {
            next_buttons = now + 10000;
            unsigned levels = button_levels();
            unsigned pressed = previous & ~levels;
            unsigned released = ~previous & levels;
            previous = levels;
            if (released & 16)
                line("A KEY UP");
            if (released & 3)
                line("A VOLUME KEY UP");
            unsigned new_volume = volume;
            if ((pressed & 1) && volume < MAX_VOLUME)
                new_volume++;
            if ((pressed & 2) && volume)
                new_volume--;
            if (new_volume != volume) {
                volume = new_volume;
                save_volume(volume);
                status("A VOLUME", volume);
            }
            if (pressed & 16) {
                if (position == frames)
                    position = 0;
                playing = !playing;
                next_frame = REG(TICKS);
                status(playing ? "A PLAY" : "A PAUSE", position);
            }
        }
        if (playing && (int32_t)(now - next_frame) >= 0) {
            int sample = (int16_t)little_endian(TRACK + 44 + 2 * position, 2);
            int scaled = sample * (int)volume / MAX_VOLUME;
            *fifo = (uint16_t)scaled;
            *fifo = (uint16_t)scaled;
            next_frame += 125;
            position++;
            if (position == 64 && position < frames)
                line("A STARTED");
            if (position == frames) {
                playing = 0;
                status("A DONE", position);
            }
        }
    }
}
