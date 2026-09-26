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

describe.each([
  ['Linux', 'nginx.conf'],
  ['Docker Desktop', 'nginx.desktop.conf'],
  ['Windows', 'nginx.windows.conf'],
])('Security headers in %s UI proxy', (_profile, file) => {
  const config = readFileSync(join(process.cwd(), 'docker', 'ui', file), 'utf8');
  const serverDirectives = config.split(/\n\s*location\s/)[0];
  const apiGateway = readFileSync(join(process.cwd(), 'apps', 'api', 'ApiGateway.ts'), 'utf8');
  const headers = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Permissions-Policy',
    'Cross-Origin-Resource-Policy',
  ];

  it('keeps exactly one Nginx-owned copy on proxied responses and API protection for direct access', () => {
    for (const header of headers) {
      expect(serverDirectives.match(new RegExp(`add_header ${header} `, 'g'))).toHaveLength(1);
      expect(serverDirectives.match(new RegExp(`proxy_hide_header ${header};`, 'g'))).toHaveLength(1);
      expect(apiGateway).toContain(`response.setHeader('${header}',`);
    }
    const apiLocation = config.match(/location \/api\/ \{([\s\S]*?)(?=\n\s*location |\n\})/)?.[1];
    expect(apiLocation).toBeDefined();
    expect(apiLocation).not.toMatch(/add_header (?:X-Content-Type-Options|X-Frame-Options|Referrer-Policy|Permissions-Policy|Cross-Origin-Resource-Policy)/);
  });
});
