import { readFileSync } from 'node:fs';

const dockerfiles = [
  { service: 'api', path: 'docker/api/Dockerfile', metadataArgs: ['HOMEPILOT_BUILD_REVISION', 'HOMEPILOT_IMAGE_ROLE'], expensive: ['apt-get install', '/app/node_modules', 'RUN npm run build'] },
  { service: 'ui', path: 'docker/ui/Dockerfile', metadataArgs: ['HOMEPILOT_BUILD_REVISION'], expensive: ['RUN npm run build --workspace=apps/operator-console', '/app/apps/operator-console/dist'] },
  { service: 'stt', path: 'services/stt-whisper/Dockerfile', metadataArgs: ['HOMEPILOT_BUILD_REVISION'], expensive: ['apt-get install', 'pip install', 'snapshot_download(', 'WhisperModel('] },
  { service: 'tts', path: 'services/tts-piper/Dockerfile', metadataArgs: ['HOMEPILOT_BUILD_REVISION'], expensive: ['apt-get install', 'pip install', 'urlretrieve(', 'KPipeline('] },
] as const;

describe('HomePilot image metadata does not invalidate functional build layers', () => {
  test.each(dockerfiles)('$service: metadata ARGs follow all expensive work and only feed final LABEL', ({ path, metadataArgs, expensive, service }) => {
    const source = readFileSync(path, 'utf8');
    const instructions = source.split(/\r?\n/).map(line => line.trim()).filter(line => /^[A-Z]+(?:\s|$)/.test(line));
    const labelIndex = instructions.findIndex(line => line.startsWith('LABEL io.nezu.homepilot.managed='));
    expect(labelIndex).toBeGreaterThan(0);
    expect(instructions[labelIndex]).toContain('io.nezu.homepilot.managed="v1"');
    expect(source).toContain(`io.nezu.homepilot.service="${service}"`);
    expect(source).toContain('io.nezu.homepilot.role=');
    expect(source).toContain('io.nezu.homepilot.revision="${HOMEPILOT_BUILD_REVISION}"');

    const firstMetadataArg = labelIndex - metadataArgs.length;
    expect(instructions.slice(firstMetadataArg, labelIndex)).toEqual(metadataArgs.map(arg => expect.stringMatching(new RegExp(`^ARG ${arg}(?:=|$)`))));
    for (const arg of metadataArgs) {
      expect(instructions.filter(line => line.startsWith(`ARG ${arg}=`))).toHaveLength(1);
    }

    let lastFunctionalLayer = -1;
    instructions.forEach((line, index) => {
      if (/^(?:RUN|COPY|ADD)\s/.test(line)) lastFunctionalLayer = index;
    });
    expect(lastFunctionalLayer).toBeLessThan(firstMetadataArg);
    for (const marker of expensive) {
      const position = source.indexOf(marker);
      expect(position).toBeGreaterThanOrEqual(0);
      expect(position).toBeLessThan(source.indexOf(`ARG ${metadataArgs[0]}=`));
    }
  });

  test('camera probe varies only the final API metadata role while retaining the runtime build path', () => {
    const probe = readFileSync('scripts/lib/camera-acceleration.sh', 'utf8');
    expect(probe).toContain('--build-arg HOMEPILOT_IMAGE_ROLE=probe');
    expect(probe).toContain('-f docker/api/Dockerfile');
    expect(probe).toContain('HOMEPILOT_BUILD_REVISION=');
  });
});
