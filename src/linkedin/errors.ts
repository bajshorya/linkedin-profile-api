/**
 * Domain errors. Each carries the HTTP status and stable `code` the API surfaces.
 * The mapping principle: 4xx for caller mistakes, 5xx for LinkedIn-side failures
 * so a consumer knows a retry might succeed.
 */
export type ErrorCode =
  | 'INVALID_URL'
  | 'UNAUTHORIZED'
  | 'PROFILE_NOT_FOUND'
  | 'PROFILE_RESTRICTED'
  | 'RATE_LIMITED'
  | 'LINKEDIN_AUTH_EXPIRED'
  | 'LINKEDIN_RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_TIMEOUT'
  | 'SESSION_NOT_CONFIGURED';

export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** LinkedIn session is dead/expired (401/403/999/redirect-to-login). Needs refresh. */
export class LinkedInAuthError extends AppError {
  constructor(message = 'LinkedIn session expired or invalid') {
    super(502, 'LINKEDIN_AUTH_EXPIRED', message);
  }
}

/** No li_at / JSESSIONID configured on the server. */
export class SessionNotConfiguredError extends AppError {
  constructor(message = 'LinkedIn session is not configured on the server') {
    super(503, 'SESSION_NOT_CONFIGURED', message);
  }
}

export class ProfileNotFoundError extends AppError {
  constructor(publicId: string) {
    super(404, 'PROFILE_NOT_FOUND', `No LinkedIn profile at /in/${publicId}`);
  }
}

/** Profile exists but is not viewable by the current session (out of network / private). */
export class ProfileRestrictedError extends AppError {
  constructor(message = 'Profile exists but is not viewable by this session') {
    super(403, 'PROFILE_RESTRICTED', message);
  }
}

export class LinkedInRateLimitedError extends AppError {
  constructor(message = 'LinkedIn rate limited the request') {
    super(502, 'LINKEDIN_RATE_LIMITED', message);
  }
}

export class UpstreamError extends AppError {
  constructor(message = 'Unexpected upstream error') {
    super(502, 'UPSTREAM_ERROR', message);
  }
}

export class UpstreamTimeoutError extends AppError {
  constructor(message = 'LinkedIn request timed out') {
    super(504, 'UPSTREAM_TIMEOUT', message);
  }
}

export class ProfileParseError extends AppError {
  constructor(message = 'Failed to parse LinkedIn response') {
    super(502, 'UPSTREAM_ERROR', message);
  }
}

/** Inbound daily cap or per-IP limit hit. */
export class RateLimitedError extends AppError {
  constructor(message = 'Rate limit exceeded', readonly retryAfterSeconds?: number) {
    super(429, 'RATE_LIMITED', message);
  }
}
