import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROJECT_URL, RELEASES_API, RELEASE_TAG_URL } from '../../src/shared/project';

describe('fork release source', () => {
  it('uses this project for application links, release notes and both update providers', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(PROJECT_URL).toBe('https://github.com/userSywang/lolPing');
    expect(RELEASES_API).toBe('https://api.github.com/repos/userSywang/lolPing');
    expect(RELEASE_TAG_URL).toBe(`${PROJECT_URL}/releases/tag/v`);
    expect(pkg.repository.url).toBe(`${PROJECT_URL}.git`);
    expect(pkg.build.publish).toEqual([{ provider: 'github', owner: 'userSywang', repo: 'lolPing' }]);
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
