
import { TimeUtils } from './packages/shared/domain/utils/TimeUtils';
import { AutomationEngine } from './packages/automation/application/AutomationEngine';

async function verifyTimezoneSafety() {
  console.log('--- STARTING TIMEZONE-SAFE VERIFICATION ---');

  // 1. Test UTC Conversion
  const localTime = '13:40';
  const tz = 'America/Guayaquil'; // GMT-5
  const utcTime = TimeUtils.convertLocalToUTC(localTime, tz);
  
  console.log(`[1] Conversion: ${localTime} (${tz}) -> ${utcTime} UTC`);
  if (utcTime === '18:40') {
    console.log('    SUCCESS: Correct UTC offset applied.');
  } else {
    console.error(`    FAILURE: Expected 18:40, got ${utcTime}`);
  }

  // 2. Test Engine Match (UTC)
  const ruleRepoMock = {
    findAll: async () => [
      {
        id: 'rule-tz',
        name: 'Afternoon Alert',
        enabled: true,
        trigger: { 
            type: 'time', 
            timeLocal: '13:40', 
            timezone: 'America/Guayaquil', 
            timeUTC: '18:40' 
        },
        action: { type: 'device_command', targetDeviceId: 'd1', command: 'turn_on' }
      }
    ]
  } as any;

  const deviceRepoMock = {
    findDeviceById: async (id: string) => ({ id, externalId: 'ha:light.desk', name: 'Desk Light' })
  } as any;

  const dispatcherMock = {
    dispatchCommand: async () => { console.log('   [Action] Command Executed on UTC Match!'); },
    executeScene: async () => {}
  } as any;

  const engine = new AutomationEngine(ruleRepoMock, deviceRepoMock, {} as any, dispatcherMock, { saveActivity: async () => {} } as any);

  console.log('\n[2] Engine UTC Match');
  console.log('Action: Calling handleTimeEvent("18:40")');
  await engine.handleTimeEvent('18:40'); 

  console.log('\n[3] Engine UTC Mismatch (Local 13:40 pulse)');
  console.log('Action: Calling handleTimeEvent("13:40")');
  await engine.handleTimeEvent('13:40'); // Should NOT match

  console.log('\n--- VERIFICATION COMPLETED ---');
}

verifyTimezoneSafety().catch(console.error);
