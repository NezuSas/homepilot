import {
  sourceTypeDefaults,
  type NativeCamera,
  type NativeCameraFormData,
  type NativeCameraPayload,
  type NativeCameraSourceType,
} from './types';

const SOURCE_TYPES: readonly string[] = ['onvif-ptz', 'rtsp-dvr', 'sonoff-rtsp'];

export function isNativeCameraSourceType(value: string): value is NativeCameraSourceType {
  return SOURCE_TYPES.includes(value);
}

export function createEmptyFormData(homeId: string): NativeCameraFormData {
  return {
    sourceType: 'onvif-ptz',
    name: '',
    host: '',
    rtspPort: 554,
    onvifPort: 8000,
    username: '',
    password: '',
    rtspPath: '',
    homeId,
  };
}

export function formDataFromCamera(camera: NativeCamera): NativeCameraFormData {
  return {
    name: camera.name,
    sourceType: camera.sourceType || 'onvif-ptz',
    host: camera.host,
    rtspPort: camera.rtspPort,
    onvifPort: camera.onvifPort,
    username: '', // Deliberately blank for security
    password: '', // Deliberately blank for security
    rtspPath: camera.rtspPath,
    homeId: camera.homeId,
  };
}

export function applySourceTypeDefaults(
  prev: NativeCameraFormData,
  sourceType: NativeCameraSourceType,
): NativeCameraFormData {
  const defaults = sourceTypeDefaults[sourceType];
  return {
    ...prev,
    sourceType,
    rtspPort: defaults.rtspPort,
    onvifPort: defaults.onvifPort,
    rtspPath: prev.rtspPath || defaults.rtspPath,
  };
}

/** Returns the i18n key of the first validation failure, or null when the form is valid. */
export function validateNativeCameraForm(formData: NativeCameraFormData, isEditing: boolean): string | null {
  if (!formData.name.trim()) return 'native_cameras.form.errors.name_required';
  if (!formData.host.trim()) return 'native_cameras.form.errors.host_required';
  if (!isEditing && !formData.username) return 'native_cameras.form.errors.username_required';
  if (!isEditing && !formData.password) return 'native_cameras.form.errors.password_required';
  if (formData.sourceType !== 'onvif-ptz' && !formData.rtspPath.trim()) {
    return 'native_cameras.form.errors.rtsp_path_required';
  }
  const rtspPortNum = Number(formData.rtspPort);
  if (isNaN(rtspPortNum) || rtspPortNum < 1 || rtspPortNum > 65535) {
    return 'native_cameras.form.errors.port_invalid';
  }
  return null;
}

export function buildNativeCameraPayload(formData: NativeCameraFormData, isEditing: boolean): NativeCameraPayload {
  const payload: NativeCameraPayload = {
    sourceType: formData.sourceType,
    name: formData.name,
    host: formData.host,
    rtspPort: Number(formData.rtspPort),
    onvifPort: Number(formData.onvifPort),
    rtspPath: formData.rtspPath,
  };
  if (formData.username) payload.username = formData.username;
  if (formData.password) payload.password = formData.password;
  if (!isEditing) payload.homeId = formData.homeId;
  return payload;
}
