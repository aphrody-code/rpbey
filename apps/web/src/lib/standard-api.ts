/**
 * StandardAPI - A powerful, type-safe wrapper around the native Fetch API.
 * Designed for the RPB ecosystem to standardize HTTP requests, error handling,
 * and Next.js integration.
 */

export class APIError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: unknown,
    public url: string,
  ) {
    super(`API Error ${status} (${statusText}) at ${url}`);
    this.name = 'APIError';
  }
}

export interface StandardAPIOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  baseUrl?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  validationSchema?: {
    safeParse: (data: unknown) => {
      success: boolean;
      data?: unknown;
      error?: unknown;
    };
  };
  revalidate?: number | false; // Next.js shortcut
}

export interface APIInterceptor {
  onRequest?: (
    url: string,
    options: RequestInit,
  ) => RequestInit | Promise<RequestInit>;
  onResponse?: (response: Response) => Response | Promise<Response>;
  onError?: (error: APIError) => void | Promise<void>;
}

export class StandardAPI {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private interceptors: APIInterceptor[] = [];

  constructor(baseUrl: string = '', defaultHeaders: HeadersInit = {}) {
    // Remove trailing slash if present
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.defaultHeaders = defaultHeaders;
  }

  /**
   * Add an interceptor to the client
   */
  addInterceptor(interceptor: APIInterceptor) {
    this.interceptors.push(interceptor);
    return this;
  }

  /**
   * Core request method
   */
  async request<T = unknown>(
    endpoint: string,
    options: StandardAPIOptions = {},
  ): Promise<T> {
    const { baseUrl, params, validationSchema, revalidate, ...fetchOptions } =
      options;

    // Determine final URL
    const urlBase = baseUrl ?? this.baseUrl;
    const urlPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // Check if we have a valid base URL with protocol
    const hasProtocol =
      urlBase.startsWith('http://') || urlBase.startsWith('https://');
    const fullUrlString = `${urlBase}${urlPath}`;

    let url: URL;

    if (hasProtocol) {
      url = new URL(fullUrlString);
    } else {
      // Handle relative URLs (e.g. for internal API calls)
      // We use a dummy base to leverage URLSearchParams, then strip it
      url = new URL(fullUrlString, 'http://dummy-base.com');
    }

    // Append query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    // Get final string
    let finalUrl = hasProtocol ? url.toString() : url.pathname + url.search;

    // If original base was empty but we have a relative path, ensure we don't double slash if not needed
    if (!hasProtocol && urlBase === '') {
      finalUrl = urlPath + url.search;
    }

    // Merge headers
    const headers = new Headers(this.defaultHeaders);
    if (fetchOptions.headers) {
      new Headers(fetchOptions.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    // Next.js specific caching shortcut
    if (revalidate !== undefined) {
      (fetchOptions as { next?: { revalidate: number | false } }).next = {
        revalidate,
      };
    }

    // Auto-set Content-Type for JSON bodies
    if (
      fetchOptions.body &&
      typeof fetchOptions.body !== 'string' &&
      !(fetchOptions.body instanceof FormData) &&
      !(fetchOptions.body instanceof Blob) &&
      !(fetchOptions.body instanceof URLSearchParams)
    ) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    let finalOptions: RequestInit = { ...fetchOptions, headers } as RequestInit;

    // Apply request interceptors
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        finalOptions = await interceptor.onRequest(finalUrl, finalOptions);
      }
    }

    try {
      let response = await fetch(finalUrl, finalOptions);

      // Apply response interceptors
      for (const interceptor of this.interceptors) {
        if (interceptor.onResponse) {
          response = await interceptor.onResponse(response);
        }
      }

      // Handle non-2xx responses
      if (!response.ok) {
        let errorData: unknown;
        try {
          errorData = await response.json();
        } catch {
          errorData = await response.text();
        }
        throw new APIError(
          response.status,
          response.statusText,
          errorData,
          finalUrl,
        );
      }

      // Handle empty responses
      if (response.status === 204) {
        return {} as T;
      }

      // Parse JSON response
      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new APIError(
          response.status,
          'Invalid JSON Response',
          null,
          finalUrl,
        );
      }

      // Optional validation
      if (validationSchema) {
        const result = validationSchema.safeParse
          ? validationSchema.safeParse(data)
          : { success: true, data };
        if (!result.success) {
          console.error('API Validation Error:', result.error);
          // We still return data but log the error
        }
        return result.data as T;
      }

      return data as T;
    } catch (error) {
      if (error instanceof APIError) {
        for (const interceptor of this.interceptors) {
          if (interceptor.onError) {
            await interceptor.onError(error);
          }
        }
      }
      throw error;
    }
  }

  get<T = unknown>(endpoint: string, options?: StandardAPIOptions) {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  post<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: StandardAPIOptions,
  ) {
    return this.request<T>(endpoint, { ...options, method: 'POST', body });
  }

  put<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: StandardAPIOptions,
  ) {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body });
  }

  patch<T = unknown>(
    endpoint: string,
    body?: unknown,
    options?: StandardAPIOptions,
  ) {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body });
  }

  delete<T = unknown>(endpoint: string, options?: StandardAPIOptions) {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Singleton instance for internal API calls (relative paths)
export const api = new StandardAPI('', {
  'Content-Type': 'application/json',
});

// Helper to create instances for external services
export const createClient = (baseUrl: string, headers: HeadersInit = {}) => {
  return new StandardAPI(baseUrl, headers);
};
