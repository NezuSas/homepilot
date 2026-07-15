import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Plus, X } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { SectionHeader } from '../components/ui/SectionHeader';
import { Button } from '../components/ui/Button';
import { AutomationWorkbenchEmptyState } from '../components/AutomationWorkbenchEmptyState';
import { AutomationWorkbenchErrorToast } from '../components/AutomationWorkbenchErrorToast';
import { AutomationWorkbenchForm } from '../components/AutomationWorkbenchForm';
import { AutomationWorkbenchLoadingState } from '../components/AutomationWorkbenchLoadingState';
import { AutomationWorkbenchRuleCard, type AutomationWorkbenchRule } from '../components/AutomationWorkbenchRuleCard';


/**
 * Tipado estricto para AutomationRule V1.
 */
interface AutomationRule {
  id: string;
  homeId: string;
  name: string;
  enabled: boolean;
  trigger: {
    deviceId: string;
    stateKey: string;
    expectedValue: string | number | boolean;
  };
  action: {
    targetDeviceId: string;
    command: string;
  };
}

interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
}

/**
 * Proptypes extendidas para el manejo de estado en la UI.
 */
interface RuleUI extends AutomationRule {
  _processing?: boolean;
  _error?: string | null;
  _confirmingDelete?: boolean;
}

/**
 * AutomationWorkbenchView
 * Vista final endurecida y pulida para la gestión de reglas locales.
 */
export const AutomationWorkbenchView: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<RuleUI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estados para creación y edición
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    triggerDeviceId: '',
    stateKey: 'occupancy',
    expectedValue: 'true',
    targetDeviceId: '',
    command: 'turn_on'
  });

  const API_URL = `${API_BASE_URL}/api/v1`;


  /**
   * Helper robusto para parsear el expectedValue desde el input string.
   * Soporta: "true" (boolean), "false" (boolean), números y strings.
   */
  const parseExpectedValue = (val: string): string | number | boolean => {
    const raw = val.trim();
    if (raw.toLowerCase() === 'true') return true;
    if (raw.toLowerCase() === 'false') return false;
    
    const num = Number(raw);
    if (!isNaN(num) && raw !== '') return num;
    
    return raw;
  };

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`${API_URL}/automations`);
      if (!res.ok) throw new Error(t('common.errors.connection_error'));
      const rawData = await res.json();
      if (Array.isArray(rawData)) {
        setRules(rawData.map(r => ({ ...r, _processing: false, _error: null, _confirmingDelete: false })));
        setError(null);
      } else {
        console.error('[AutomationWorkbench] Expected array of rules but received:', rawData);
        setError(t('common.error_invalid_response_shape'));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errors.connection_error'));
    } finally {
      setLoading(false);
    }
  }, [API_URL, t]);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/devices`);
      if (res.ok) {
        const rawData = await res.json();
        if (Array.isArray(rawData)) {
          setDevices(rawData.filter(d => d.status === 'ASSIGNED'));
        } else {
          console.warn('[AutomationWorkbench] Expected array of devices but received:', rawData);
        }
      }
    } catch (err) {
      console.error('Failed to fetch devices for form', err);
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchDevices();
  }, [fetchRules, fetchDevices]);

  const toggle = async (id: string, currentlyEnabled: boolean) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: true, _error: null } : r));
    try {
      const act = currentlyEnabled ? 'disable' : 'enable';
      const res = await apiFetch(`${API_URL}/automations/${id}/${act}`, { method: 'PATCH' });
      const data = (await res.json()) as AutomationRule | { error: string };

      if (!res.ok) throw new Error('error' in data ? data.error : t('common.errors.operation_failed'));
      
      const updated = data as AutomationRule;
      setRules(prev => prev.map(r => r.id === id ? { ...updated, _processing: false, _error: null } : r));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.errors.unknown');
      setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: false, _error: msg } : r));
    }
  };

  const handleDelete = async (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: true, _error: null } : r));
    try {
      const res = await apiFetch(`${API_URL}/automations/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json()) as { error: string };
        throw new Error(data.error || t('common.errors.operation_failed'));
      }
      setRules(prev => prev.filter(r => r.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('common.errors.operation_failed');
      setRules(prev => prev.map(r => r.id === id ? { ...r, _processing: false, _error: msg, _confirmingDelete: false } : r));
    }
  };

  const startEditing = (rule: AutomationWorkbenchRule) => {
    setEditingId(rule.id);
    setShowForm(false);
    setFormData({
      name: rule.name,
      triggerDeviceId: rule.trigger.deviceId,
      stateKey: rule.trigger.stateKey,
      expectedValue: String(rule.trigger.expectedValue),
      targetDeviceId: rule.action.targetDeviceId,
      command: rule.action.command
    });
    setCreateError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setFormData({ name: '', triggerDeviceId: '', stateKey: 'occupancy', expectedValue: 'true', targetDeviceId: '', command: 'turn_on' });
  };

  const setRuleConfirmingDelete = (id: string, confirming: boolean) => {
    setRules(prev => prev.map(rule => rule.id === id ? { ...rule, _confirmingDelete: confirming } : rule));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setCreateError(null);
    try {
      const payload = {
        name: formData.name,
        trigger: {
          deviceId: formData.triggerDeviceId,
          stateKey: formData.stateKey,
          expectedValue: parseExpectedValue(formData.expectedValue)
        },
        action: {
          targetDeviceId: formData.targetDeviceId,
          command: formData.command
        }
      };

      const method = editingId ? 'PATCH' : 'POST';
      const endpoint = editingId ? `${API_URL}/automations/${editingId}` : `${API_URL}/automations`;

      const res = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as AutomationRule | { error: string };

      if (!res.ok) throw new Error('error' in data ? data.error : t('common.errors.operation_failed'));

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setShowForm(false);
        setEditingId(null);
        setFormData({ name: '', triggerDeviceId: '', stateKey: 'occupancy', expectedValue: 'true', targetDeviceId: '', command: 'turn_on' });
        fetchRules();
      }, 1500);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : t('common.errors.unknown'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && rules.length === 0) return <AutomationWorkbenchLoadingState label={t('automations.loading')} />;

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Header with Create Button */}
      <SectionHeader 
        className="bg-card/40 p-6 rounded-panel border border-border/40 backdrop-blur-sm shadow-sm"
        title={t('automations.title')}
        subtitle={t('automations.active_recipes', { count: rules.length })}
        icon={Zap}
        iconClassName="text-warning fill-warning"
        action={
          <Button
            variant={(showForm || editingId) ? 'outline' : 'primary'}
            onClick={() => {
              if (editingId) cancelEditing();
              setShowForm(!showForm);
            }}
            className="uppercase tracking-widest text-label"
          >
            {showForm || editingId ? <><X className="w-4 h-4" /> {t('common.cancel')}</> : <><Plus className="w-4 h-4" /> {t('automations.create_rule')}</>}
          </Button>
        }
      />

      {/* Form (Creation or Edition) */}
      {(showForm || editingId) && (
        <AutomationWorkbenchForm
          formData={formData}
          devices={devices}
          editingId={editingId}
          submitting={submitting}
          success={success}
          createError={createError}
          onSubmit={handleSubmit}
          onChange={setFormData}
        />
      )}

      {rules.length === 0 && !loading && !showForm && !editingId ? (
        <AutomationWorkbenchEmptyState
          title={t('automations.empty_state.title')}
          description={t('automations.empty_state.description')}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {Array.isArray(rules) && rules.map(rule => (
            <AutomationWorkbenchRuleCard
              key={rule.id}
              rule={rule}
              editingId={editingId}
              onToggle={toggle}
              onEdit={startEditing}
              onDelete={handleDelete}
              onConfirmingDeleteChange={setRuleConfirmingDelete}
            />
          ))}
        </div>
      )}

      {error && !loading && rules.length > 0 && (
        <AutomationWorkbenchErrorToast title={t('common.error')} message={error} onRetry={fetchRules} />
      )}
    </div>
  );
};
