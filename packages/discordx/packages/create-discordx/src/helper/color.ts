/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */

/** ANSI reset sequence */
const R = "\x1b[0m";

function ansi(color: string, s: string): string {
  const code = Bun.color(color, "ansi");
  // Bun.color returns "" when stdout doesn't support ANSI — fall back to plain
  return code ? `${code}${s}${R}` : s;
}

export const red = (s: string) => ansi("red", s);
export const green = (s: string) => ansi("green", s);
export const greenBright = (s: string) => ansi("#00ff00", s);
export const blue = (s: string) => ansi("blue", s);
export const blueBright = (s: string) => ansi("#0080ff", s);
export const cyan = (s: string) => ansi("cyan", s);
export const gray = (s: string) => ansi("gray", s);
export const dim = (s: string) => {
  const code = Bun.color("gray", "ansi");
  return code ? `\x1b[2m${s}${R}` : s;
};
export const bold = (s: string) => `\x1b[1m${s}${R}`;
export const reset = (s: string) => `${R}${s}`;
