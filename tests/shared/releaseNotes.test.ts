import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('publishes only the selected version notes and refuses missing, empty or preview entries', () => {
  const notes = execFileSync(process.execPath, ['tools/release-notes.mjs', 'v0.5.5', '--stdin'],
    { input: '# 更新日志\n## [0.5.5] - today\n### 新功能\n本次更新\n## [0.5.4]\n上次内容\n', encoding: 'utf8' });
  expect(notes).toContain('本次更新'); expect(notes).not.toContain('上次内容');
  for (const [tag, body] of [['v0.5.6','## [0.5.5]\n其他版本'], ['v0.5.5','## [0.5.5]\n'], ['v0.5.5-beta','## [0.5.5-beta]\n预览版']]) {
    expect(() => execFileSync(process.execPath, ['tools/release-notes.mjs', tag, '--stdin'], { input: body, stdio: ['pipe','pipe','pipe'] })).toThrow();
  }
});
