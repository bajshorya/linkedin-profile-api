import { describe, it, expect } from 'vitest';
import { parseLinkedInProfileUrl, InvalidProfileUrlError } from '../src/utils/url.js';

describe('parseLinkedInProfileUrl', () => {
  const valid: Array<[string, string]> = [
    ['https://www.linkedin.com/in/john-doe', 'john-doe'],
    ['https://www.linkedin.com/in/john-doe/', 'john-doe'],
    ['http://www.linkedin.com/in/john-doe', 'john-doe'],
    ['linkedin.com/in/john-doe', 'john-doe'],
    ['www.linkedin.com/in/john-doe', 'john-doe'],
    ['https://in.linkedin.com/in/john-doe', 'john-doe'],
    ['https://fr.linkedin.com/in/john-doe', 'john-doe'],
    ['https://www.linkedin.com/in/john-doe?originalSubdomain=in', 'john-doe'],
    ['https://www.linkedin.com/in/john-doe/#section', 'john-doe'],
    ['https://www.linkedin.com/in/john-doe-123ab456', 'john-doe-123ab456'],
    ['https://www.linkedin.com/in/jos%C3%A9', 'josé'],
    ['  https://www.linkedin.com/in/john-doe  ', 'john-doe'],
    ['john-doe', 'john-doe'],
    ['williamhgates', 'williamhgates'],
  ];

  it.each(valid)('parses %s -> %s', (input, expected) => {
    expect(parseLinkedInProfileUrl(input)).toBe(expected);
  });

  const invalid = [
    '',
    '   ',
    'https://www.linkedin.com/company/acme',
    'https://www.linkedin.com/school/mit',
    'https://www.linkedin.com/posts/john-doe_activity-123',
    'https://www.linkedin.com/feed/',
    'https://example.com/in/john-doe',
    'https://www.linkedin.com/in/',
    'not a url with spaces',
  ];

  it.each(invalid)('rejects %s', (input) => {
    expect(() => parseLinkedInProfileUrl(input)).toThrow(InvalidProfileUrlError);
  });
});
