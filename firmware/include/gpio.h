// SPDX-License-Identifier: MIT
#ifndef EIDOLON_GPIO_H
#define EIDOLON_GPIO_H
#include <stdint.h>

// Single bound 8-pin PL061. Caller owns pin directions; no interrupt API yet.
void gpio_init(void);
void gpio_set_outputs(uint8_t outputs);
void gpio_write(uint8_t mask, uint8_t values);
uint8_t gpio_read(uint8_t mask);
#endif
