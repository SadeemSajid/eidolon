// SPDX-License-Identifier: MIT
#include "rtc.h"
#include "platform_config.h"

static volatile uint32_t *reg(unsigned int offset) {
    return (volatile uint32_t *)(EIDOLON_RTC_BASE + offset);
}

void rtc_init(void) {
    *reg(0x10) = 0; // Mask alarms; CPU interrupt handling is not configured.
    *reg(0x1c) = 1; // Clear any pending alarm.
    *reg(0x0c) = 1; // Enable the counter (QEMU models it as always enabled).
}

uint32_t rtc_seconds(void) {
    return *reg(0x00);
}

void rtc_set_seconds(uint32_t seconds) {
    *reg(0x08) = seconds;
}
