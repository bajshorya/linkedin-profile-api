import PQueue from 'p-queue';
import type { Config } from '../config.js';
import { logger } from '../utils/logger.js';
import { ProfileCache } from '../utils/cache.js';
import { parseLinkedInProfileUrl } from '../utils/url.js';
import { assembleProfile } from './assemble.js';
import type { ProfileSource } from './client.js';
import {
  AppError,
  ProfileNotFoundError,
  RateLimitedError,
} from './errors.js';
import type { Profile, ProfileResponse } from '../schema/profile.schema.js';

export interface FetchOptions {
  refresh?: boolean;
}

export interface ProfileResult {
  response: ProfileResponse;
  cacheStatus: 'HIT' | 'MISS';
}

/**
 * Orchestrates the whole read path: url -> cache -> queued+paced upstream fetch ->
 * assemble -> validate. The queue (concurrency 1 + a jittered gap) plus the daily
 * cap are the account-safety mechanism: one session on one IP must never fan out.
 */
export class ProfileService {
  private readonly queue: PQueue;
  private readonly positiveCache: ProfileCache<Profile>;
  private readonly negativeCache: ProfileCache<{ notFound: true }>;
  private dayStamp = utcDayStamp();
  private dailyCount = 0;

  constructor(
    private readonly source: ProfileSource,
    private readonly config: Config,
  ) {
    this.queue = new PQueue({ concurrency: 1 });
    this.positiveCache = new ProfileCache<Profile>(config.CACHE_TTL_SECONDS * 1000);
    this.negativeCache = new ProfileCache<{ notFound: true }>(
      config.NEGATIVE_CACHE_TTL_SECONDS * 1000,
    );
  }

  async getProfile(url: string, opts: FetchOptions = {}): Promise<ProfileResult> {
    const publicId = parseLinkedInProfileUrl(url).toLowerCase();
    const startedAt = Date.now();

    if (!opts.refresh) {
      if (this.negativeCache.get(publicId)) {
        throw new ProfileNotFoundError(publicId);
      }
      const cached = this.positiveCache.get(publicId);
      if (cached) {
        return {
          cacheStatus: 'HIT',
          response: {
            data: cached,
            meta: {
              scrapedAt: new Date().toISOString(),
              cached: true,
              durationMs: Date.now() - startedAt,
              source: 'voyager',
              sectionsUnavailable: [],
            },
          },
        };
      }
    }

    const { profile, sectionsUnavailable } = await this.queue.add(() =>
      this.fetchAndAssemble(publicId),
    ) as Awaited<ReturnType<ProfileService['fetchAndAssemble']>>;

    this.positiveCache.set(publicId, profile);

    return {
      cacheStatus: 'MISS',
      response: {
        data: profile,
        meta: {
          scrapedAt: new Date().toISOString(),
          cached: false,
          durationMs: Date.now() - startedAt,
          source: 'voyager',
          sectionsUnavailable,
        },
      },
    };
  }

  private async fetchAndAssemble(publicId: string) {
    this.enforceDailyCap();
    await this.pace();

    try {
      const bundle = await this.source.fetchProfileBundle(publicId);
      this.dailyCount += 1;
      return assembleProfile(bundle, publicId);
    } catch (err) {
      if (err instanceof ProfileNotFoundError) {
        this.negativeCache.set(publicId, { notFound: true });
      }
      if (err instanceof AppError) throw err;
      logger.error({ err, publicId }, 'unexpected error assembling profile');
      throw err;
    }
  }

  private enforceDailyCap(): void {
    const today = utcDayStamp();
    if (today !== this.dayStamp) {
      this.dayStamp = today;
      this.dailyCount = 0;
    }
    if (this.dailyCount >= this.config.DAILY_CAP) {
      throw new RateLimitedError(
        `Daily upstream cap of ${this.config.DAILY_CAP} reached; resets at UTC midnight`,
        secondsUntilUtcMidnight(),
      );
    }
  }

  /** Jittered gap between upstream calls so traffic doesn't look mechanical. */
  private async pace(): Promise<void> {
    const base = this.config.REQUEST_GAP_MS;
    if (base <= 0) return;
    const jitter = Math.floor(Math.random() * base * 0.5);
    await new Promise((resolve) => setTimeout(resolve, base + jitter));
  }

  async sessionValid(): Promise<boolean> {
    return this.source.checkSession();
  }
}

function utcDayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.ceil((midnight - now.getTime()) / 1000);
}
