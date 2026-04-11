
import { AutomationEngine } from './packages/automation/application/AutomationEngine';

async function verify() {
  console.log('--- STARTING DETERMINISTIC TIME TRIGGER VERIFICATION ---');

  const ruleRepoMock = {
    findAll: async () => [
      {
        id: 'rule-1',
        homeId: 'h1',
        userId: 'u1',
        name: 'Morning Light',
        enabled: true,
        trigger: { type: 'time', time: '08:00', days: [] },
        action: { type: 'device_command', targetDeviceId: 'd1', command: 'turn_on' }
      }
    ]
  } as any;

  const deviceRepoMock = {
    findDeviceById: async (id: string) => ({ id, externalId: 'ha:light.desk', name: 'Desk Light' })
  } as any;

  const dispatcherMock = {
    dispatchCommand: async () => { console.log('   [Action] Command Executed!'); },
    executeScene: async () => {}
  } as any;

  const engine = new AutomationEngine(
    ruleRepoMock, 
    deviceRepoMock, 
    {} as any, 
    dispatcherMock, 
    { saveActivity: async () => {} } as any
  );

  console.log('\n[1] Exact Minute Match');
  console.log('Action: Calling handleTimeEvent("08:00")');
  await engine.handleTimeEvent('08:00'); 

  console.log('\n[2] Duplicate Prevention (Same Minute)');
  console.log('Action: Calling handleTimeEvent("08:00") again');
  await engine.handleTimeEvent('08:00'); 

  console.log('\n[3] No Match (Shifted Minute)');
  console.log('Action: Calling handleTimeEvent("08:01")');
  await engine.handleTimeEvent('08:01'); 

  console.log('\n[4] Alignment Simulation');
  const now = new Date();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();
  const delay = (60 - seconds) * 1000 - ms;
  console.log(`Current Time: ${now.toISOString()}`);
  console.log(`Calculated Delay to next :00 boundary: ${delay}ms`);

  console.log('\n--- VERIFICATION COMPLETED ---');
}

verify().catch(console.error);
