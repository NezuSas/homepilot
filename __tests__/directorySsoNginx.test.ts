import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe.each([
  ['Linux', 'nginx.conf', 'host.docker.internal'],
  ['Docker Desktop', 'nginx.desktop.conf', 'homepilot-api'],
])('Directory browser entry in %s UI proxy', (_profile, file, upstream) => {
  const config = readFileSync(join(process.cwd(), 'docker', 'ui', file), 'utf8');

  it('forwards POST /sso/directory to the exact browser handoff endpoint', () => {
    expect(config).toMatch(new RegExp(
      `location = /sso/directory \\{[\\s\\S]*?proxy_pass http://${upstream.replaceAll('.', '\\.')}\\:3000/api/v1/auth/sso/directory/browser;`,
    ));
  });

  it('does not accept query-string assertions or log the entry request', () => {
    expect(config).toMatch(/location = \/sso\/directory \{[\s\S]*?access_log off;/);
    expect(config).toMatch(/location = \/sso\/directory \{[\s\S]*?if \(\$args != ""\) \{ return 400; \}/);
  });
});
