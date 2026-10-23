// SPDX-License-Identifier: MIT
#include "platform.h"

unsigned int platform_exception_level(void) {
    unsigned long level;
    __asm__ volatile ("mrs %0, CurrentEL" : "=r" (level));
    return (unsigned int)((level >> 2) & 3);
}
