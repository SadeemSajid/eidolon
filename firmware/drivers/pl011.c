// SPDX-License-Identifier: MIT
#include "console.h"
#include "platform_config.h"
#define REG(offset) (*(volatile unsigned int *)(EIDOLON_UART_BASE + (offset)))

void console_init(void) {
    REG(0x30) = 0;                    // Disable before configuration.
    REG(0x44) = 0x7ff;                // Clear pending interrupt status.
    REG(0x38) = 0;                    // Polling only.
    REG(0x24) = EIDOLON_UART_IBRD;
    REG(0x28) = EIDOLON_UART_FBRD;
    REG(0x2c) = 0x70;                 // 8 data bits, FIFO, no parity.
    REG(0x30) = 0x101;                // UARTEN | TXE.
}

void console_putc(char value) {
    while (REG(0x18) & (1u << 5)) { }  // Wait while TX FIFO is full.
    REG(0x00) = (unsigned char)value;
}

void console_write(const char *text) {
    while (*text) console_putc(*text++);
}
