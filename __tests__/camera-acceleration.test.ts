import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe'
  : 'bash';

function selectCameraAcceleration(mode: string): string {
  const script = `
    set -euo pipefail
    source scripts/lib/camera-acceleration.sh
    OSTYPE=linux-gnu
    camera_acceleration_device_available() { [[ "$MODE" != no_device ]]; }
    timeout() {
      if [[ "$1" == 600s && "$2" == docker && "$3" == build ]]; then
        [[ "$MODE" != build_failed ]]
        return
      fi
      [[ "$1" == 25s && "$2" == docker && "$3" == run ]] || return 1
      [[ " $* " == *' h264_vaapi '* ]] || return 1
      [[ " $* " == *' /dev/dri/renderD128:/dev/dri/renderD128 '* ]] || return 1
      [[ " $* " == *' color=black:s=128x128:r=15:d=1 '* ]] || return 1
      [[ "$MODE" == available ]]
    }
    camera_acceleration_select
    printf '%s|%s|%s|%s' "$camera_acceleration_detected" "$camera_acceleration_encoder" "$camera_acceleration_overlay" "$camera_acceleration_reason"
  `;
  return execFileSync(bash, ['-c', script], {
    cwd: process.cwd(),
    env: { ...process.env, MODE: mode },
    encoding: 'utf8',
  });
}

describe('camera acceleration deployment selection', () => {
  it('uses VAAPI only after a real synthetic encode probe', () => {
    expect(selectCameraAcceleration('available')).toBe(
      'VAAPI (renderD128)|auto (h264_vaapi)|docker-compose.camera-vaapi.yml|',
    );
  });

  it('keeps software when /dev/dri/renderD128 is absent', () => {
    expect(selectCameraAcceleration('no_device')).toBe(
      'ninguna|libx264||/dev/dri/renderD128 no disponible',
    );
  });

  it('keeps software when h264_vaapi is absent from FFmpeg', () => {
    expect(selectCameraAcceleration('encoder_absent')).toBe(
      'VAAPI (renderD128)|libx264||FFmpeg no pudo codificar con h264_vaapi',
    );
  });

  it('keeps software when the VAAPI encode probe fails despite the device', () => {
    expect(selectCameraAcceleration('probe_failed')).toBe(
      'VAAPI (renderD128)|libx264||FFmpeg no pudo codificar con h264_vaapi',
    );
  });

  it('keeps software when the probe image cannot be prepared', () => {
    expect(selectCameraAcceleration('build_failed')).toBe(
      'VAAPI (renderD128)|libx264||no se pudo preparar la imagen de prueba',
    );
  });

  it('reports an active software fallback without exposing the camera URL', () => {
    const script = `
      set -euo pipefail
      source scripts/lib/camera-acceleration.sh
      docker() {
        if [[ "$1" == inspect && "$2" == --format ]]; then
          if [[ "$3" == *HostConfig.Devices* ]]; then
            printf '%s\\n' /dev/dri/renderD128
          else
            printf '%s\\n' HOMEPILOT_CAMERA_HLS_ENCODER=auto
          fi
        elif [[ "$1" == top ]]; then
          printf '%s\\n' 'ffmpeg -i rtsp://user:secret@camera.local/live -c:v libx264'
        fi
      }
      camera_acceleration_report_running
    `;
    const output = execFileSync(bash, ['-c', script], { cwd: process.cwd(), encoding: 'utf8' });
    expect(output).toContain('Fallback utilizado: libx264 en un stream activo.');
    expect(output).not.toContain('secret');
    expect(output).not.toContain('rtsp://');
  });
});
