export enum RequestType {
  DELETE = "DELETE",
  GET = "GET",
  PATCH = "PATCH",
  POST = "POST",
}

export class HTTPError extends Error {
  public method: string;
  public statusCode: number;
  public headers: Record<string, string>;
  public path: string;

  get statusMessage(): string {
    return this.message.split(" ").slice(1).join(" ") || "Unknown";
  }

  constructor(response: Response, method: string, url: URL) {
    super(`${response.status} ${response.statusText || "Unknown"}`);
    this.statusCode = response.status;
    this.headers = Object.fromEntries(response.headers.entries());
    this.name = this.constructor.name;
    this.path = url.toString();
    this.method = method;
  }
}

export class HttpClient {
  constructor(
    public base: string,
    public password: string,
  ) {
    //
  }

  public async request<T = any>(
    method: RequestType,
    url: URL,
    data?: Uint8Array,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: this.password,
      "Content-Type": "application/json",
    };

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: data ? (data.buffer as ArrayBuffer) : null,
    });

    if (![200, 204].includes(response.status)) {
      throw new HTTPError(response, method, url);
    }

    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    if (!text) {
      return null as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  }

  public url(input: string): URL {
    return new URL(input, this.base);
  }
}
