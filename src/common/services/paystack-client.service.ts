import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/**
 * Unified Paystack HTTP client.
 *
 * Consolidates Paystack API access previously duplicated across
 * PaymentsService, WalletService, and KycService into a single
 * injectable service with:
 *  - Centralized auth header management
 *  - Structured response parsing with typed generics
 *  - Error handling with Paystack error message propagation
 *  - Optional graceful mode for non-critical calls (e.g. wallet provisioning)
 */
@Injectable()
export class PaystackClientService {
  private readonly logger = new Logger(PaystackClientService.name);
  private readonly baseUrl = 'https://api.paystack.co';

  private getSecretKey(): string {
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) {
      throw new Error(
        'PAYSTACK_SECRET_KEY is required in environment variables',
      );
    }
    return key;
  }

  /**
   * Check whether Paystack is configured. Useful for graceful
   * degradation when the key is not set (e.g. local dev).
   */
  isConfigured(): boolean {
    return Boolean(process.env.PAYSTACK_SECRET_KEY);
  }

  private buildHeaders(
    extraHeaders?: Record<string, string>,
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.getSecretKey()}`,
      'Content-Type': 'application/json',
      ...extraHeaders,
    };
  }

  /**
   * Core HTTP method for all Paystack API interactions.
   *
   * @param path — API path (e.g. `/transaction/initialize`)
   * @param init — fetch RequestInit (method, body, etc.)
   * @param options.extraHeaders — additional headers to merge
   * @param options.graceful — if true, returns null instead of throwing on error
   */
  async request<T>(
    path: string,
    init: RequestInit,
    options?: {
      extraHeaders?: Record<string, string>;
      graceful?: boolean;
    },
  ): Promise<T | null> {
    const url = `${this.baseUrl}${path}`;

    try {
      const response = await fetch(url, {
        ...init,
        headers: this.buildHeaders(options?.extraHeaders),
      });

      const payload = (await response.json().catch(() => null)) as {
        status?: boolean;
        message?: string;
        data?: T;
      } | null;

      if (!response.ok || !payload?.status) {
        const message = payload?.message || 'Paystack request failed';
        if (options?.graceful) {
          this.logger.warn(
            `Paystack graceful failure [${init.method ?? 'GET'} ${path}]: ${message}`,
          );
          return null;
        }
        throw new BadRequestException(message);
      }

      return payload.data as T;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : 'Paystack network error';
      this.logger.error(
        `Paystack request error [${init.method ?? 'GET'} ${path}]: ${message}`,
      );

      if (options?.graceful) {
        return null;
      }
      throw new BadRequestException(message);
    }
  }

  /**
   * Strict call — throws on failure. Use for critical financial flows.
   */
  async call<T>(
    path: string,
    init: RequestInit,
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const result = await this.request<T>(path, init, { extraHeaders });
    return result as T;
  }

  /**
   * GET convenience method.
   */
  async get<T>(path: string, options?: { graceful?: boolean }): Promise<T | null> {
    return this.request<T>(path, { method: 'GET' }, options);
  }

  /**
   * POST convenience method.
   */
  async post<T>(
    path: string,
    body?: Record<string, unknown>,
    options?: { graceful?: boolean },
  ): Promise<T | null> {
    return this.request<T>(
      path,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  /**
   * Raw fetch for cases that need the full Response object
   * (e.g. wallet dedicated account provisioning where we check response.ok).
   */
  async rawFetch(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    return fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: this.buildHeaders(),
    });
  }
}
