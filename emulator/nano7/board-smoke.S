/* SPDX-License-Identifier: GPL-2.0-or-later */
.syntax unified
.cpu cortex-a5
.arm

.equ UART3,      0x3dd00000
.equ VIC0,       0x38e00000
.equ TIMER_B,    0x3c700020
.equ TIMER_BIT,  0x100
.equ ENABLE_IRQ, 0x1000
.equ ACK_IRQ,    0x10000
.equ TIMER_E,    0x3c7000a0
.equ TIMER_E_BIT, 0x80
.equ STAT,       0x3c710000
.equ LATCH,      0x3c700118
.equ TIMER64_LO, 0x3c700084
.equ TIMER_E_PENDING, 0x01000000

.section .text
.balign 32
.global _start
_start:
    b boot
    b fail
    b fail
    b fail
    b fail
    b fail
    b timer_irq
    b fail

boot:
    cpsid if
    cps #0x13
    ldr sp, =0x0800f000
    ldr r0, =_start
    mcr p15, 0, r0, c12, c0, 0
    isb
    ldr r0, =boot_message
    bl puts

    /* These are deliberately left dirty after each successful run. */
    ldr r0, =0x08010000
    ldr r1, [r0]
    cmp r1, #0
    bne fail
    ldr r0, =VIC0
    ldr r1, [r0, #0x10]
    tst r1, #TIMER_BIT
    bne fail
.ifdef N31_LINUX_TIMERS
    tst r1, #TIMER_E_BIT
    bne fail
.endif
    ldr r0, =TIMER_B
    ldr r1, [r0, #0x08]
    cmp r1, #0
    bne fail

    /* Check the first and last regions of DRAM and IRAM for distinct data. */
    adr r4, ram_pairs
    mov r5, #4
1:  ldm r4!, {r0, r1}
    str r1, [r0]
    subs r5, r5, #1
    bne 1b
    dsb sy
    adr r4, ram_pairs
    mov r5, #4
2:  ldm r4!, {r0, r1}
    ldr r2, [r0]
    cmp r2, r1
    bne fail
    subs r5, r5, #1
    bne 2b
    ldr r0, =ram_message
    bl puts

    cps #0x12
    ldr sp, =0x0800e000
    cps #0x13
    ldr r4, =interrupt_count
    mov r0, #0
    str r0, [r4]
    ldr r1, =VIC0
    mov r2, #TIMER_BIT
    str r2, [r1, #0x10]
    ldr r1, =TIMER_B
    str r0, [r1, #0x10]
    ldr r2, =30000                /* 10 ms at the modeled 3 MHz. */
    str r2, [r1, #0x08]
    mov r2, #ENABLE_IRQ
    str r2, [r1]
    mov r2, #3
    str r2, [r1, #0x04]
    cpsie i
3:  ldr r0, [r4]
    cmp r0, #2
    blo 3b
    cpsid i
    ldr r0, =timer_message
    bl puts
.ifdef N31_LINUX_TIMERS
    ldr r0, =TIMER_E
    ldr r1, [r0, #0x08]
    cmp r1, #0
    bne fail
    mov r1, #0
    str r1, [r4]
    ldr r1, =VIC0
    mov r2, #TIMER_E_BIT
    str r2, [r1, #0x10]
    mov r2, #23
    str r2, [r0, #0x10]
    ldr r2, =0x440
    str r2, [r0]
    ldr r2, =10000              /* 10 ms at 24 MHz / (23 + 1). */
    str r2, [r0, #0x08]
    ldr r5, =TIMER64_LO
    ldr r6, [r5]
    mov r2, #3
    str r2, [r0, #0x04]
    ldr r2, =ENABLE_IRQ | 0x440
    str r2, [r0]
    cpsie i
6:  ldr r2, [r4]
    cmp r2, #1
    blo 6b
    cpsid i
    ldr r2, [r5]
    sub r2, r2, r6
    ldr r3, =20000              /* 10 ms at the N31 timer64 rate of 2 MHz. */
    cmp r2, r3
    blo fail
    ldr r2, [r0, #0x04]
    tst r2, #1
    bne fail
    ldr r0, =timer_e_message
    bl puts
.endif
    ldr r0, =pass_message
    bl puts
    b park

timer_irq:
    push {r0-r3, lr}
    ldr r0, =VIC0
    ldr r1, [r0]
.ifdef N31_LINUX_TIMERS
    cmp r1, #TIMER_E_BIT
    beq timer_e_irq
.endif
    cmp r1, #TIMER_BIT
    bne fail
    ldr r1, =TIMER_B
    ldr r2, [r1]
    tst r2, #ACK_IRQ
    beq fail
    ldr r2, =ENABLE_IRQ | ACK_IRQ
    str r2, [r1]
    ldr r2, [r0]
    tst r2, #TIMER_BIT
    bne fail
    ldr r0, =interrupt_count
    ldr r2, [r0]
    add r2, r2, #1
    str r2, [r0]
    cmp r2, #2
    moveq r3, #0
    streq r3, [r1, #0x04]
    pop {r0-r3, lr}
    subs pc, lr, #4

.ifdef N31_LINUX_TIMERS
timer_e_irq:
    ldr r1, =STAT
    ldr r2, [r1]
    cmp r2, #TIMER_E_PENDING
    bne fail
    ldr r1, =LATCH
    str r2, [r1]
    ldr r2, [r0]
    tst r2, #TIMER_E_BIT
    bne fail
    ldr r0, =interrupt_count
    mov r2, #1
    str r2, [r0]
    pop {r0-r3, lr}
    subs pc, lr, #4
.endif

fail:
    cpsid if
    ldr r0, =fail_message
    bl puts
park:
    wfi
    b park

puts:
    ldr r1, =UART3
4:  ldrb r2, [r0], #1
    cmp r2, #0
    bxeq lr
5:  ldr r3, [r1, #0x10]
    tst r3, #2
    beq 5b
    strb r2, [r1, #0x20]
    b 4b

.balign 4
ram_pairs:
    .word 0x08010000, 0x13579bdf
    .word 0x0bfffffc, 0x2468ace0
    .word 0x22001000, 0x55aa55aa
    .word 0x2203fffc, 0xaa55aa55
interrupt_count: .word 0
boot_message:  .asciz "N31_BOOT\n"
ram_message:   .asciz "N31_RAM_OK\n"
timer_message: .asciz "N31_TIMER_IRQ_OK\n"
.ifdef N31_LINUX_TIMERS
timer_e_message: .asciz "N31_TIMER_E_IRQ7_OK\n"
.endif
pass_message:  .asciz "N31_PASS\n"
fail_message:  .asciz "N31_FAIL\n"
.ltorg
