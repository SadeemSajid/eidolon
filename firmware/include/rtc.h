// SPDX-License-Identifier: MIT
#ifndef EIDOLON_RTC_H
#define EIDOLON_RTC_H
#include <stdint.h>

// Single bound PL031. Polling only; no alarm/interrupt delivery API yet.
void rtc_init(void);
uint32_t rtc_seconds(void);
void rtc_set_seconds(uint32_t seconds);
#endif
