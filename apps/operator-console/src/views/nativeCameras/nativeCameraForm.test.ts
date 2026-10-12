import {
  applySourceTypeDefaults,
  buildNativeCameraPayload,
  createEmptyFormData,
  formDataFromCamera,
  isNativeCameraSourceType,
  validateNativeCameraForm,
} from './nativeCameraForm';
import type { NativeCamera, NativeCameraFormData } from './types';

const validForm = (extra: Partial<NativeCameraFormData> = {}): NativeCameraFormData => ({
  ...createEmptyFormData('home'),
  name: 'Cam',
  host: '10.0.0.9',
  username: 'admin',
  password: 'secret',
  ...extra,
});

describe('nativeCameraForm', () => {
  it('recognises only supported source types', () => {
    expect(isNativeCameraSourceType('rtsp-dvr')).toBe(true);
    expect(isNativeCameraSourceType('other')).toBe(false);
  });

  it('blanks credentials when editing an existing camera', () => {
    const camera: NativeCamera = {
      deviceId: 'd', homeId: 'h', sourceType: 'rtsp-dvr', name: 'N', host: 'x', onvifPort: 80,
      rtspPort: 554, rtspPath: '/p', enabled: true, createdAt: '',
    };
    expect(formDataFromCamera(camera)).toMatchObject({ username: '', password: '', homeId: 'h' });
  });

  it('keeps an existing RTSP path when switching source type', () => {
    const next = applySourceTypeDefaults(validForm({ rtspPath: '/custom' }), 'sonoff-rtsp');
    expect(next.rtspPath).toBe('/custom');
    expect(applySourceTypeDefaults(validForm(), 'sonoff-rtsp').rtspPath).toBe('/av_stream/ch0');
  });

  it('returns the first validation error key', () => {
    expect(validateNativeCameraForm(validForm({ name: ' ' }), false)).toBe('native_cameras.form.errors.name_required');
    expect(validateNativeCameraForm(validForm({ username: '' }), false)).toBe('native_cameras.form.errors.username_required');
    expect(validateNativeCameraForm(validForm({ username: '' }), true)).toBeNull();
    expect(validateNativeCameraForm(validForm({ sourceType: 'rtsp-dvr' }), false)).toBe('native_cameras.form.errors.rtsp_path_required');
    expect(validateNativeCameraForm(validForm({ rtspPort: 70000 }), false)).toBe('native_cameras.form.errors.port_invalid');
    expect(validateNativeCameraForm(validForm(), false)).toBeNull();
  });

  it('only sends credentials when provided and homeId only on create', () => {
    expect(buildNativeCameraPayload(validForm(), false)).toMatchObject({ username: 'admin', password: 'secret', homeId: 'home' });
    const edit = buildNativeCameraPayload(validForm({ username: '', password: '' }), true);
    expect(edit).not.toHaveProperty('username');
    expect(edit).not.toHaveProperty('password');
    expect(edit).not.toHaveProperty('homeId');
  });
});
