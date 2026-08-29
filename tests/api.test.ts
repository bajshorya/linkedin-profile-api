import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { resetConfig, loadConfig } from '../src/config.js';
import { createApp } from '../src/app.js';
import type { ProfileSource } from '../src/linkedin/client.js';
import type { RawProfileBundle } from '../src/linkedin/assemble.js';
import { ProfileNotFoundError, LinkedInAuthError } from '../src/linkedin/errors.js';

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'raw', 'williamhgates.fullprofile.json'), 'utf8'),
);

const API_KEY = 'test-key-123';

function makeApp(source: ProfileSource) {
  resetConfig();
  const config = loadConfig({
    API_KEY,
    LI_AT: 'x',
    JSESSIONID: 'ajax:x',
    REQUEST_GAP_MS: '0',
    NODE_ENV: 'test',
  } as NodeJS.ProcessEnv);
  return createApp(config, { source });
}

const goodSource: ProfileSource = {
  async fetchProfileBundle(): Promise<RawProfileBundle> {
    return {
      main: fixture,
      skills: { included: [] },
      certifications: { included: [] },
      languages: { included: [] },
    };
  },
  async checkSession() {
    return true;
  },
};

describe('API', () => {
  let app: ReturnType<typeof makeApp>;
  beforeAll(() => {
    app = makeApp(goodSource);
  });

  it('GET /health is open and reports session status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.sessionConfigured).toBe(true);
  });

  it('401 without api key', async () => {
    const res = await request(app).get('/api/v1/profile?url=https://www.linkedin.com/in/williamhgates');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('400 on a non-profile URL', async () => {
    const res = await request(app)
      .get('/api/v1/profile?url=https://www.linkedin.com/company/microsoft')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('200 with a valid key and url, X-Cache MISS then HIT', async () => {
    const first = await request(app)
      .get('/api/v1/profile?url=https://www.linkedin.com/in/williamhgates')
      .set('x-api-key', API_KEY);
    expect(first.status).toBe(200);
    expect(first.headers['x-cache']).toBe('MISS');
    expect(first.body.data.fullName).toBe('Bill Gates');
    expect(first.body.meta.source).toBe('voyager');

    const second = await request(app)
      .get('/api/v1/profile?url=https://www.linkedin.com/in/williamhgates')
      .set('x-api-key', API_KEY);
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body.meta.cached).toBe(true);
  });

  it('POST /api/v1/profile works with a JSON body', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .set('x-api-key', API_KEY)
      .send({ url: 'https://www.linkedin.com/in/williamhgates', refresh: true });
    expect(res.status).toBe(200);
    expect(res.body.data.publicIdentifier).toBe('williamhgates');
  });

  it('maps ProfileNotFound -> 404', async () => {
    const app404 = makeApp({
      async fetchProfileBundle() {
        throw new ProfileNotFoundError('ghost');
      },
      async checkSession() {
        return true;
      },
    });
    const res = await request(app404)
      .get('/api/v1/profile?url=https://www.linkedin.com/in/ghost')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('maps LinkedInAuthError -> 502 LINKEDIN_AUTH_EXPIRED', async () => {
    const appAuth = makeApp({
      async fetchProfileBundle() {
        throw new LinkedInAuthError();
      },
      async checkSession() {
        return false;
      },
    });
    const res = await request(appAuth)
      .get('/api/v1/profile?url=https://www.linkedin.com/in/anyone')
      .set('x-api-key', API_KEY);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('LINKEDIN_AUTH_EXPIRED');
  });
});
