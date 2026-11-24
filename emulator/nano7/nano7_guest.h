/* SPDX-License-Identifier: GPL-2.0-or-later */
#ifndef NANO7_GUEST_H
#define NANO7_GUEST_H

#include <stdint.h>

#define REG(address) (*(volatile uint32_t *)(address))
#define UART 0x3dd00000u
#define I2C 0x3c900000u
#define TICKS 0x3c700084u

void guest_main(void);
__asm__(".pushsection .text.startup,\"ax\"\n"
        ".balign 32\n"
        ".global _start\n"
        "_start:\n"
        "b 1f\n"
        "b 2f\n"
        "b 2f\n"
        "b 2f\n"
        "b 2f\n"
        "b 2f\n"
        "b 2f\n"
        "b 2f\n"
        "1:\n"
        "cpsid if\n"
        "ldr sp, =0x080ff000\n"
        "ldr r0, =_start\n"
        "mcr p15, 0, r0, c12, c0, 0\n"
        "isb\n"
        "b guest_main\n"
        "2:\n"
        "cpsid if\n"
        "cps #0x13\n"
        "ldr sp, =0x080ff000\n"
        "b fail\n"
        ".popsection\n");

static void put(char c)
{
    while (!(REG(UART + 0x10) & 2)) {}
    *(volatile uint8_t *)(UART + 0x20) = c;
}

static void line(const char *message)
{
    while (*message)
        put(*message++);
    put('\n');
}

__attribute__((used, noreturn)) static void fail(void)
{
    line("IO FAIL");
    for (;;)
        __asm__ volatile("wfi");
}

static void wait_for(uint32_t address, uint32_t mask)
{
    uint32_t start = REG(TICKS);
    while (!(REG(address) & mask)) {
        if ((uint32_t)(REG(TICKS) - start) > 1000000) {
            line("IO WAIT TIMEOUT");
            fail();
        }
    }
}

static uint8_t pmu_read(uint8_t reg)
{
    /* Send the register pointer, then issue a separate one-byte read. */
    REG(I2C + 0x00) = 0;
    REG(I2C + 0x0c) = 0xe6;
    REG(I2C + 0x04) = 0xf0;
    wait_for(I2C, 0x10);
    if (REG(I2C + 0x04) & 1) {
        line("IO PMU NACK");
        fail();
    }
    REG(I2C + 0x0c) = reg;
    REG(I2C + 0x00) = 0;
    wait_for(I2C, 0x10);
    REG(I2C + 0x04) = 0xd0;
    REG(I2C + 0x00) = 0;
    REG(I2C + 0x0c) = 0xe7;
    REG(I2C + 0x04) = 0xb0;
    wait_for(I2C, 0x10);
    REG(I2C + 0x00) = 0;
    wait_for(I2C, 0x10);
    uint8_t value = REG(I2C + 0x0c);
    REG(I2C + 0x04) = 0x90;
    REG(I2C + 0x20) = 0xffffffff;
    return value;
}

static unsigned button_levels(void)
{
    unsigned gpio = REG(0x3cf000a4) & 3;
    unsigned home_power = (pmu_read(7) >> 4) & 3;
    unsigned play = (pmu_read(8) >> 1) & 1;
    return gpio | home_power << 2 | play << 4;
}

#endif
