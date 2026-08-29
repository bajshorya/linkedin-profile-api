import { ProxyAgent, type Dispatcher } from 'undici';
import type { Config } from '../config.js';
import { logger } from '../utils/logger.js';
import { endpoints } from './endpoints.js';
import type { NormalizedResponse } from './normalize.js';
import type { RawProfileBundle } from './assemble.js';
import {
  LinkedInAuthError,
  LinkedInRateLimitedError,
  ProfileNotFoundError,
  ProfileRestrictedError,
  SessionNotConfiguredError,
  UpstreamError,
  UpstreamTimeoutError,
} from './errors.js';

/** Source abstraction so the data origin is swappable and mockable in tests. */
export interface ProfileSource {
  fetchProfileBundle(publicId: string): Promise<RawProfileBundle>;
  checkSession(): Promise<boolean>;
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export class VoyagerSource implements ProfileSource {
  private readonly dispatcher?: Dispatcher;

  constructor(private readonly config: Config) {
    if (config.PROXY_URL) {
      this.dispatcher = new ProxyAgent(config.PROXY_URL);
    }
  }

  private headers(publicId?: string): Record<string, string> {
    const { LI_AT, JSESSIONID, USER_AGENT } = this.config;
    return {
      accept: 'application/vnd.linkedin.normalized+json+2.1',
      'accept-language': 'en-US,en;q=0.9',
      cookie: `li_at=${LI_AT}; JSESSIONID="${JSESSIONID}"`,
      'csrf-token': JSESSIONID,
      'user-agent': USER_AGENT,
      'x-li-lang': 'en_US',
      'x-restli-protocol-version': '2.0.0',
      ...(publicId ? { referer: `https://www.linkedin.com/in/${publicId}/` } : {}),
    };
  }

  /**
   * Low-level Voyager GET. Detects the several ways LinkedIn signals a dead
   * session (999, 401/403, or an HTML login page served with a 200), retries
   * transient 5xx, and returns parsed normalized JSON.
   */
  private async get(
    url: string,
    publicId: string | undefined,
    attempt = 0,
  ): Promise<NormalizedResponse> {
    if (!this.config.hasSession) {
      throw new SessionNotConfiguredError();
    }

    let res: Response;
    try {
      const init: RequestInit & { dispatcher?: Dispatcher } = {
        method: 'GET',
        headers: this.headers(publicId),
        redirect: 'manual', // a redirect to /login means the session is dead
        signal: AbortSignal.timeout(this.config.UPSTREAM_TIMEOUT_MS),
      };
      if (this.dispatcher) init.dispatcher = this.dispatcher;
      res = await fetch(url, init);
    } catch (err) {
      if (err instanceof Error && err.name === 'TimeoutError') {
        throw new UpstreamTimeoutError();
      }
      throw new UpstreamError(`Network error contacting LinkedIn: ${(err as Error).message}`);
    }

    // A redirect (login/checkpoint) or LinkedIn's 999 block = auth/IP problem.
    if (res.status === 999) throw new LinkedInAuthError('LinkedIn returned 999 (bot/IP block)');
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location') ?? '';
      if (/login|checkpoint|uas/i.test(location)) {
        throw new LinkedInAuthError(`Redirected to ${location} — session needs refresh`);
      }
      throw new UpstreamError(`Unexpected redirect to ${location}`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new LinkedInAuthError(`LinkedIn returned ${res.status}`);
    }
    if (res.status === 404) throw new ProfileNotFoundError(publicId ?? '');
    if (res.status === 429) throw new LinkedInRateLimitedError();
    if (RETRYABLE_STATUS.has(res.status) && attempt < 2) {
      const backoff = 400 * 2 ** attempt;
      logger.warn({ url, status: res.status, attempt }, 'retrying upstream 5xx');
      await sleep(backoff);
      return this.get(url, publicId, attempt + 1);
    }
    if (!res.ok) {
      throw new UpstreamError(`LinkedIn returned ${res.status}`);
    }

    // Sometimes LinkedIn serves an HTML login page with a 200. Guard on content-type.
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new LinkedInAuthError('LinkedIn returned non-JSON (likely a login page)');
    }

    try {
      return (await res.json()) as NormalizedResponse;
    } catch {
      throw new UpstreamError('Failed to parse LinkedIn JSON response');
    }
  }

  async fetchProfileBundle(publicId: string): Promise<RawProfileBundle> {
    const main = await this.get(endpoints.fullProfile(publicId), publicId);

    // If the decoration returned an empty collection, the profile is not viewable.
    const elements = main.data?.['*elements'];
    if (Array.isArray(elements) && elements.length === 0) {
      throw new ProfileRestrictedError();
    }

    const profileUrn =
      Array.isArray(elements) && typeof elements[0] === 'string' ? elements[0] : undefined;

    // Section calls run in parallel within this one queue job (same session,
    // ~one page view). A failing section degrades to "unavailable", never a 502.
    let skills: NormalizedResponse | null | undefined;
    let certifications: NormalizedResponse | null | undefined;
    let languages: NormalizedResponse | null | undefined;

    if (profileUrn) {
      [skills, certifications, languages] = await Promise.all([
        this.getSection(endpoints.profileSkills(profileUrn), publicId),
        this.getSection(endpoints.profileCertifications(profileUrn), publicId),
        this.getSection(endpoints.profileLanguages(profileUrn), publicId),
      ]);
    }

    return { main, skills, certifications, languages };
  }

  /** Section fetch that swallows failures into null (partial data > hard failure). */
  private async getSection(
    url: string,
    publicId: string,
  ): Promise<NormalizedResponse | null> {
    try {
      return await this.get(url, publicId);
    } catch (err) {
      logger.warn({ url, err: (err as Error).message }, 'section fetch failed; degrading');
      return null;
    }
  }

  async checkSession(): Promise<boolean> {
    try {
      await this.get(endpoints.me(), undefined);
      return true;
    } catch {
      return false;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
