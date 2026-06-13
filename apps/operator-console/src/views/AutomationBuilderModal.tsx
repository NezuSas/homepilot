import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../config';
import { apiFetch } from '../lib/apiClient';
import { AutomationBuilderActionSection } from '../components/AutomationBuilderActionSection';
import { AutomationBuilderError } from '../components/AutomationBuilderError';
import { AutomationBuilderIdentityField } from '../components/AutomationBuilderIdentityField';
import { AutomationBuilderModalFrame } from '../components/AutomationBuilderModalFrame';
import { AutomationBuilderSubmitButton } from '../components/AutomationBuilderSubmitButton';
import { AutomationBuilderTriggerSection } from '../components/AutomationBuilderTriggerSection';
import type { AutomationActionConfig, AutomationBuilderDevice, AutomationBuilderScene, AutomationRuleDraft, AutomationTriggerConfig } from '../components/AutomationBuilderTypes';

interface AutomationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (rule: AutomationRuleDraft) => void;
  devices: AutomationBuilderDevice[];
  scenes: AutomationBuilderScene[];
  existingAutomation?: AutomationRuleDraft | null;
}

const HOURS = Array.from({ length: 24 }, (_, index) => ({
  value: index.toString().padStart(2, '0'),
  label: index.toString().padStart(2, '0')
}));

const MINUTES = Array.from({ length: 60 }, (_, index) => ({
  value: index.toString().padStart(2, '0'),
  label: index.toString().padStart(2, '0')
}));

const DEFAULT_TRIGGER_CONFIG: AutomationTriggerConfig = {
  deviceId: '',
  stateKey: 'state',
  expectedValue: 'on'
};

const DEFAULT_ACTION_CONFIG: AutomationActionConfig = {
  targetDeviceId: '',
  command: 'turn_on'
};

const AutomationBuilderModal: React.FC<AutomationBuilderModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  devices,
  scenes,
  existingAutomation
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'device_state_changed' | 'time'>('device_state_changed');
  const [triggerConfig, setTriggerConfig] = useState<AutomationTriggerConfig>(DEFAULT_TRIGGER_CONFIG);
  const [actionType, setActionType] = useState<'device_command' | 'execute_scene'>('device_command');
  const [actionConfig, setActionConfig] = useState<AutomationActionConfig>(DEFAULT_ACTION_CONFIG);

  useEffect(() => {
    if (!isOpen) return;

    if (existingAutomation) {
      setName(existingAutomation.name);
      setTriggerType(existingAutomation.trigger.type);
      setTriggerConfig({ ...existingAutomation.trigger });
      setActionType(existingAutomation.action.type);
      setActionConfig({ ...existingAutomation.action });
    } else {
      setName('');
      setTriggerType('device_state_changed');
      setTriggerConfig(DEFAULT_TRIGGER_CONFIG);
      setActionType('device_command');
      setActionConfig(DEFAULT_ACTION_CONFIG);
    }

    setError(null);
  }, [isOpen, existingAutomation]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('automations.builder.errors.no_name'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      trigger: {
        type: triggerType,
        ...triggerConfig,
        ...(triggerType === 'time' ? {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timeLocal: triggerConfig.timeLocal || triggerConfig.time
        } : {})
      },
      action: {
        type: actionType,
        ...actionConfig
      }
    };

    try {
      const url = existingAutomation
        ? `${API_ENDPOINTS.automations.list}/${existingAutomation.id}`
        : API_ENDPOINTS.automations.list;

      const res = await apiFetch(url, {
        method: existingAutomation ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        onCreated(result);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `Server error: ${res.status}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.connection_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isSubmitDisabled = isSubmitting
    || !name
    || (triggerType === 'device_state_changed' && !triggerConfig.deviceId)
    || (actionType === 'device_command' && !actionConfig.targetDeviceId)
    || (actionType === 'execute_scene' && !actionConfig.sceneId);

  return (
    <AutomationBuilderModalFrame
      title={existingAutomation ? t('automations.builder.title_edit') : t('automations.builder.title_create')}
      subtitle={t('automations.builder.cockpit_subtitle')}
      onClose={onClose}
    >
      <AutomationBuilderIdentityField
        label={t('automations.builder.naming_label')}
        placeholder={t('automations.builder.placeholders.name')}
        value={name}
        onChange={setName}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <AutomationBuilderTriggerSection
          devices={devices}
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          hours={HOURS}
          minutes={MINUTES}
          onTriggerTypeChange={setTriggerType}
          onTriggerConfigChange={setTriggerConfig}
        />

        <AutomationBuilderActionSection
          devices={devices}
          scenes={scenes}
          actionType={actionType}
          actionConfig={actionConfig}
          onActionTypeChange={setActionType}
          onActionConfigChange={setActionConfig}
        />
      </div>

      {error && <AutomationBuilderError message={error} />}

      <AutomationBuilderSubmitButton
        label={t('automations.builder.commit')}
        isSubmitting={isSubmitting}
        disabled={isSubmitDisabled}
        onClick={handleSubmit}
      />
    </AutomationBuilderModalFrame>
  );
};

export default AutomationBuilderModal;
