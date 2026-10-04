import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ModbusReadProbe } from './ModbusReadProbe';
import { apiFetch } from '../lib/apiClient';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../config', () => ({ API_BASE_URL: '' }));
jest.mock('../lib/apiClient', () => ({ apiFetch: jest.fn() }));
jest.mock('./ui/Modal', () => ({ Modal: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

describe('Feature: Read Probe diagnostic presentation (AC26)', () => {
  it('Scenario: Opening a configured probe shows no executed test or fabricated results', () => {
    const onCreate = jest.fn();
    const html = renderToStaticMarkup(<ModbusReadProbe homeId="h" initial={{ id: 'c', homeId: 'h', name: 'Fixture', host: '192.168.1.5', port: 502, unitId: 1, profileId: 'xinje-xl5e-16t-v1', enabled: false, timeoutMs: 2000, pollIntervalMs: 5000 }} onClose={() => {}} onCreate={onCreate} />);
    expect(html).toContain('modbus.not_started');
    expect(html).not.toContain('modbus.stopped');
    expect(html).not.toContain('modbus.sampled_at');
    expect(apiFetch).not.toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
  });
});
