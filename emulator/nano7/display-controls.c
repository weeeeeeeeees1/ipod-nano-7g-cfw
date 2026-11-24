/* SPDX-License-Identifier: GPL-2.0-or-later */
#include "nano7_guest.h"

#define LCD  0x38900000u
#define SPI  0x3d200000u
#define WIDTH 240
#define HEIGHT 432

static int target(int x, int y, int cx, int cy)
{
    return x >= cx - 2 && x <= cx + 2 && y >= cy - 2 && y <= cy + 2;
}

static void draw(void)
{
    static const uint32_t colors[] = {0xffff0000, 0xff00ff00, 0xff0000ff, 0xffffff00};
    volatile uint32_t *pixels = (volatile uint32_t *)0x08100000;
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            *pixels++ = target(x, y, 30, 54) || target(x, y, 199, 377) ?
                0xffffffff : colors[2 * (y >= HEIGHT / 2) + (x >= WIDTH / 2)];
        }
    }
    __asm__ volatile("dsb sy" ::: "memory");
    REG(LCD + 0x20) = 0x002107ff;
    REG(LCD + 0x24) = 0x08100000;
    REG(LCD + 0x28) = WIDTH;
    REG(LCD + 0x30) = WIDTH << 16 | HEIGHT;
    REG(LCD) = 1;
    REG(LCD + 4) = 0x10;
}

static void touch_transfer(unsigned operation, uint8_t *reply, unsigned length)
{
    /* Select the controller and clock one full-duplex SPI transaction. */
    REG(SPI) = 0xc;
    REG(SPI + 0x04) = 0;
    REG(SPI + 0x08) = 0xffffffff;
    REG(SPI + 0x0c) = 0;
    REG(SPI + 0x34) = length;
    REG(SPI + 0x4c) = length;
    REG(SPI + 0x04) = 0x100;
    REG(SPI + 0x10) = 0xea;
    REG(SPI + 0x10) = 1;
    REG(SPI + 0x10) = operation;
    for (unsigned i = 3; i < length; i++)
        REG(SPI + 0x10) = 0;
    wait_for(SPI + 0x08, 1);
    for (unsigned i = 0; i < length; i++)
        reply[i] = REG(SPI + 0x20);
    REG(SPI + 0x0c) = 2;
}

static void digits(unsigned number)
{
    put('0' + number / 100);
    put('0' + number / 10 % 10);
    put('0' + number % 10);
}

static void touch(void)
{
    uint8_t reply[41];
    touch_transfer(0, reply, 16);
    unsigned length = reply[1] | reply[2] << 8;
    if (!length)
        return;
    if (length + 5 != sizeof(reply))
        fail();
    touch_transfer(1, reply, sizeof(reply));
    if (reply[0] != 0xea || reply[5] != 0x44 || reply[21] != 1 || reply[7] != 0x12)
        fail();
    const uint8_t *record = reply + 5 + reply[7];
    int raw_x = (int16_t)(record[4] | record[5] << 8);
    int raw_y = (int16_t)(record[6] | record[7] << 8);
    put('T'); put(' '); put('0' + record[1]); put(' ');
    digits((raw_x + 75) * 239 / 2845);
    put(' ');
    digits(431 - (raw_y + 75) * 431 / 5250);
    put('\n');
}

void guest_main(void)
{
    draw();
    unsigned previous = button_levels();
    if (previous != 31)
        fail();
    line("IO READY");
    for (;;) {
        touch();
        unsigned levels = button_levels();
        for (unsigned button = 0; button < 5; button++) {
            unsigned mask = 1u << button;
            if ((levels ^ previous) & mask) {
                put('B'); put(' '); put('0' + button); put(' ');
                put((levels & mask) ? '0' : '1'); put('\n');
            }
        }
        previous = levels;
        uint32_t start = REG(TICKS);
        while ((uint32_t)(REG(TICKS) - start) < 3000) {}
    }
}
