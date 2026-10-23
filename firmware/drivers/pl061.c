// SPDX-License-Identifier: MIT
#include "gpio.h"
#include "platform_config.h"

static volatile uint32_t *reg(unsigned int offset) {
    return (volatile uint32_t *)(EIDOLON_GPIO_BASE + offset);
}

void gpio_init(void) {
    *reg(0x410) = 0; // Mask interrupts.
    *reg(0x41c) = 0xff; // Clear pending edge interrupts.
    *reg(0x420) = 0; // Select GPIO rather than alternate functions.
    gpio_set_outputs(0);
}

void gpio_set_outputs(uint8_t outputs) {
    *reg(0x400) = outputs;
}

void gpio_write(uint8_t mask, uint8_t values) {
    // PL061 address bits [9:2] select which data bits are written.
    *reg((unsigned int)mask << 2) = values;
}

uint8_t gpio_read(uint8_t mask) {
    return (uint8_t)*reg((unsigned int)mask << 2);
}
