import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import type { SnapshotHome } from '../../stores/useDeviceSnapshotStore';
import { findBrandPreset, type CameraBrandId } from './cameraBrandPresets';
import { parseRtspUrl } from './parseRtspUrl';
import { buildNativeCameraPayload, createEmptyFormData, validateNativeCameraForm } from './nativeCameraForm';
import { createNativeCamera, testNativeCamera, type CameraTestOutcome } from './nativeCameraApi';
import type { DiscoveredCamera, NativeCamera, NativeCameraFormData, NativeCameraNotice } from './types';

export type WizardStep = 'choose' | 'details' | 'test';
export type WizardTest = { status: 'running' } | { status: 'done'; outcome: CameraTestOutcome };

/** State machine of the guided camera setup: choose, fill in, then see the camera before saving. */
export function useNativeCameraWizard(
  homes: SnapshotHome[],
  cameras: NativeCamera[],
  loadCameras: () => Promise<void>,
  setNotice: (notice: NativeCameraNotice | null) => void,
) {
  const { t } = useTranslation();
  const homeId = homes[0]?.id ?? '';
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('choose');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredCamera[]>([]);
  const [brand, setBrand] = useState<CameraBrandId | null>(null);
  const [form, setForm] = useState<NativeCameraFormData>(createEmptyFormData(homeId));
  const [pasteText, setPasteText] = useState('');
  const [pasteInvalid, setPasteInvalid] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [test, setTest] = useState<WizardTest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const testRun = useRef<AbortController | null>(null);

  const existingHosts = new Set(cameras.map(camera => camera.host.toLowerCase()));
  const isAdded = (camera: DiscoveredCamera) => existingHosts.has(camera.host.toLowerCase());

  const cancelTest = useCallback(() => {
    testRun.current?.abort();
    testRun.current = null;
  }, []);
  useEffect(() => cancelTest, [cancelTest]);

  const open = async () => {
    setStep('choose');
    setBrand(null);
    setForm(createEmptyFormData(homeId));
    setPasteText('');
    setPasteInvalid(false);
    setDetailsError(null);
    setTest(null);
    setSaveError(null);
    setIsOpen(true);
    setIsDiscovering(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras/discover`);
      setDiscovered(res.ok ? ((await res.json()).devices ?? []) : []);
    } catch (err) {
      console.error(err);
      setDiscovered([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  const close = () => {
    if (isSaving) return;
    cancelTest();
    setIsOpen(false);
  };

  const goToDetails = (next: NativeCameraFormData) => {
    setForm(next);
    setDetailsError(null);
    setStep('details');
  };

  const chooseDiscovered = (camera: DiscoveredCamera) => {
    setBrand(null);
    goToDetails({ ...createEmptyFormData(homeId), name: camera.name, host: camera.host, onvifPort: camera.onvifPort });
  };

  const chooseBrand = (id: CameraBrandId) => {
    const preset = findBrandPreset(id);
    setBrand(id);
    goToDetails({
      ...createEmptyFormData(homeId),
      sourceType: preset.sourceType,
      rtspPort: preset.rtspPort,
      onvifPort: preset.onvifPort,
      rtspPath: preset.rtspPath,
    });
  };

  const submitPaste = () => {
    const parsed = parseRtspUrl(pasteText);
    setPasteInvalid(!parsed);
    if (!parsed) return;
    const preset = findBrandPreset('other');
    setBrand('other');
    goToDetails({ ...createEmptyFormData(homeId), sourceType: preset.sourceType, onvifPort: preset.onvifPort, ...parsed });
  };

  const changeField = (patch: Partial<NativeCameraFormData>) => setForm(prev => ({ ...prev, ...patch }));

  const runTest = async () => {
    cancelTest();
    const controller = new AbortController();
    testRun.current = controller;
    setSaveError(null);
    setStep('test');
    setTest({ status: 'running' });
    const outcome = await testNativeCamera(form, controller.signal);
    if (controller.signal.aborted) return;
    setTest({ status: 'done', outcome });
  };

  const submitDetails = () => {
    const errorKey = validateNativeCameraForm(form, false);
    setDetailsError(errorKey ? t(errorKey) : null);
    if (!errorKey) void runTest();
  };

  const backToDetails = () => {
    cancelTest();
    setTest(null);
    setStep('details');
  };

  const save = async () => {
    setIsSaving(true);
    setSaveError(null);
    const result = await createNativeCamera(buildNativeCameraPayload(form, false));
    setIsSaving(false);
    if (result.ok) {
      setIsOpen(false);
      setNotice({ variant: 'success', message: t('native_cameras.messages.created') });
      await loadCameras();
      return;
    }
    setSaveError(result.message ?? t('native_cameras.form.errors.save_failed'));
  };

  return {
    isOpen, step, isDiscovering, discovered, brand, form, pasteText, pasteInvalid, detailsError, test, isSaving, saveError,
    showHomePicker: homes.length > 1,
    isAdded, open, close, chooseDiscovered, chooseBrand, submitPaste, changeField, submitDetails, runTest, backToDetails, save,
    backToChoose: () => setStep('choose'),
    setPasteText: (text: string) => { setPasteText(text); setPasteInvalid(false); },
  };
}

export type NativeCameraWizard = ReturnType<typeof useNativeCameraWizard>;
