/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */
import { EventEmitter } from "node:events";

export interface ExponentialOptions {
  initialDelay?: number;
  maxDelay?: number;
  factor?: number;
  randomisationFactor?: number;
}

/**
 * Minimal exponential backoff emitter. Emits `ready` when the delay elapses.
 */
export class Backoff extends EventEmitter {
  private attempt = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly factor: number;
  private readonly randomisationFactor: number;

  constructor(opts: ExponentialOptions = {}) {
    super();
    this.initialDelay = opts.initialDelay ?? 100;
    this.maxDelay = opts.maxDelay ?? 10_000;
    this.factor = opts.factor ?? 2;
    this.randomisationFactor = opts.randomisationFactor ?? 0;
  }

  reset(): void {
    this.attempt = 0;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  backoff(): void {
    if (this.timer) return;
    const base = Math.min(
      this.initialDelay * this.factor ** this.attempt,
      this.maxDelay,
    );
    const jitter = base * this.randomisationFactor * Math.random();
    const delay = base + jitter;
    const n = this.attempt++;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.emit("ready", n, delay);
    }, delay);
  }
}

export function exponential(opts?: ExponentialOptions): Backoff {
  return new Backoff(opts);
}
