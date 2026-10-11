import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { canTestHomeAssistantConnection, extractApiErrorMessage, getErrorMessage } from './onboardingSetup';

export type ConnectionTestResult = 'idle' | 'success' | 'error';

/** Wizard state and API calls for the first-run onboarding flow. */
export function useOnboardingSetup(onCompleted: () => void) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(1);
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingHA, setTestingHA] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedHaUrl = haUrl.trim();
  const trimmedHaToken = haToken.trim();
  const canTestConnection = canTestHomeAssistantConnection(trimmedHaUrl, trimmedHaToken, { testing: testingHA, saving: loading });

  const changeHaUrl = (value: string) => {
    setHaUrl(value);
    setTestResult('idle');
  };

  const changeHaToken = (value: string) => {
    setHaToken(value);
    setTestResult('idle');
  };

  const handleTestConnection = async () => {
    setTestingHA(true);
    setTestResult('idle');
    setErrorMsg(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/settings/test-ha-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: trimmedHaUrl, accessToken: trimmedHaToken })
      });
      const data: unknown = await res.json();
      if (typeof data === 'object' && data !== null && 'success' in data && data.success) {
        setTestResult('success');
      } else {
        setTestResult('error');
        setErrorMsg(extractApiErrorMessage(data, t('ha_settings.status_card.error')));
      }
    } catch (e: unknown) {
      setTestResult('error');
      setErrorMsg(getErrorMessage(e, t('ha_settings.status_card.error')));
    } finally {
      setTestingHA(false);
    }
  };

  const handleSaveConnection = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/settings/home-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: trimmedHaUrl, accessToken: trimmedHaToken })
      });
      if (!res.ok) throw new Error(t('onboarding.error_save'));
      setStep(3);
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e, t('onboarding.error_save')));
    } finally {
      setLoading(false);
    }
  };

  const finalizeSetup = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/system/setup-status/complete`, {
        method: 'POST'
      });

      if (!res.ok) {
        const errData: unknown = await res.json();
        throw new Error(extractApiErrorMessage(errData, t('onboarding.error_complete')));
      }

      onCompleted();
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e, t('onboarding.error_complete')));
    } finally {
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    haUrl,
    haToken,
    loading,
    testingHA,
    testResult,
    errorMsg,
    canTestConnection,
    changeHaUrl,
    changeHaToken,
    handleTestConnection,
    handleSaveConnection,
    finalizeSetup
  };
}
