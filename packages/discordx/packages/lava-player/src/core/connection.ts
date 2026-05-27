/*
 * -------------------------------------------------------------------------------------------------------
 * Copyright (c) Vijay Meena <vijayymmeena@gmail.com> (https://github.com/vijayymmeena). All rights reserved.
 * Licensed under the Apache License. See License.txt in the project root for license information.
 * -------------------------------------------------------------------------------------------------------
 */

import type { BaseNode } from "../base/base-node.js";
import { type Backoff, exponential } from "./backoff.js";

/**
 * Interface representing HTTP headers.
 */
interface Headers {
  Authorization: string;
  "Client-Name": string;
  "Session-Id"?: string;
  "User-Id": string;
}

/**
 * Interface representing connection options.
 */
export interface ConnectionOptions {
  sessionId?: string;
  /** Additional headers to pass on the WebSocket handshake (Bun-native) */
  headers?: Record<string, string>;
  /** Subprotocols */
  protocols?: string | string[];
}

/**
 * Class representing a WebSocket connection.
 * @template T - The type of node.
 */
export class Connection<T extends BaseNode = BaseNode> {
  public readonly node: T;
  public url: string;
  public options: ConnectionOptions;
  public sessionId?: string;

  public ws!: WebSocket;
  private _backoff!: Backoff;

  // Track which event-listener wrappers are registered per event name
  private _registeredListeners = new Map<
    string,
    EventListenerOrEventListenerObject
  >();

  private _onClose = (event: CloseEvent) => {
    this.node.emit("close", event.code, event.reason);
    this._reconnect();
  };

  private _onError = (event: Event) => {
    this.node.emit("error", event);
    this._reconnect();
  };

  private _onMessage = (event: MessageEvent) => {
    const raw: string | ArrayBuffer = event.data as string | ArrayBuffer;

    let pk: any;
    try {
      const text =
        typeof raw === "string"
          ? raw
          : new TextDecoder().decode(raw);
      pk = JSON.parse(text);
    } catch (e) {
      this.node.emit("error", e);
      return;
    }

    if (pk.guildId && this.node.guildPlayerStore.has(pk.guildId)) {
      this.node.guildPlayerStore.get(pk.guildId).emit(pk.op, pk);
    }
    this.node.emit(pk.op, pk);
  };

  private _onOpen = () => {
    this.backoff.reset();
    this.node.emit("open");
  };

  /**
   * Constructor for the Connection class.
   * @param node - The node instance.
   * @param url - The WebSocket URL.
   * @param options - The connection options.
   */
  constructor(node: T, url: string, options: ConnectionOptions = {}) {
    this.node = node;
    this.url = url;
    this.options = options;
    this.sessionId = options.sessionId;

    this.backoff = exponential();
    this.connect();
  }

  /**
   * Getter for the backoff property.
   */
  public get backoff(): Backoff {
    return this._backoff;
  }

  /**
   * Setter for the backoff property.
   */
  public set backoff(b: Backoff) {
    b.on("ready", () => {
      this.connect();
    });

    if (typeof this._backoff !== "undefined") {
      this._backoff.removeAllListeners();
    }

    this._backoff = b;
  }

  /**
   * Connects to the WebSocket server.
   */
  public connect(): void {
    if (
      typeof this.ws !== "undefined" &&
      this.ws.readyState === WebSocket.OPEN
    ) {
      this.ws.close();
    }

    const headers: Headers = {
      Authorization: this.node.password,
      "Client-Name": "@rpbey/lava-player",
      "User-Id": this.node.userId,
    };

    if (this.sessionId) {
      headers["Session-Id"] = this.sessionId;
    }

    // Bun's global WebSocket supports a headers option in the init object
    const init: Record<string, unknown> = {
      headers: Object.assign({}, headers, this.options.headers ?? {}),
    };
    if (this.options.protocols) {
      init.protocols = this.options.protocols;
    }

    this.ws = new WebSocket(this.url, init as any);
    this._registeredListeners.clear();
    this._registerWSEventListeners();
  }

  /**
   * Closes the WebSocket connection.
   * @param code - The close code.
   * @param data - The close data.
   */
  public close(code?: number, data?: string): Promise<void> {
    if (typeof this.ws === "undefined") {
      return Promise.resolve();
    }

    // Remove the auto-reconnect close listener before closing manually
    this.ws.removeEventListener("close", this._onClose as EventListener);

    return new Promise((resolve) => {
      const onceClose = (event: CloseEvent) => {
        this.ws.removeEventListener("close", onceClose as EventListener);
        this.node.emit("close", event.code, event.reason);
        resolve();
      };
      this.ws.addEventListener("close", onceClose as EventListener);
      this.ws.close(code, data);
    });
  }

  /**
   * Reconnects the WebSocket connection.
   */
  private _reconnect() {
    if (this.ws.readyState === WebSocket.CLOSED) {
      this.backoff.backoff();
    }
  }

  /**
   * Registers WebSocket event listeners (idempotent — skip if already registered).
   */
  private _registerWSEventListeners() {
    const toRegister: [string, EventListenerOrEventListenerObject][] = [
      ["close", this._onClose as EventListener],
      ["error", this._onError as EventListener],
      ["message", this._onMessage as EventListener],
      ["open", this._onOpen as EventListener],
    ];

    for (const [event, listener] of toRegister) {
      if (!this._registeredListeners.has(event)) {
        this.ws.addEventListener(event, listener);
        this._registeredListeners.set(event, listener);
      }
    }
  }
}
