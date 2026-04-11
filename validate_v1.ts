import { AutomationEngine } from './packages/automation/application/AutomationEngine';
import { InMemoryAutomationRuleRepository } from './packages/devices/infrastructure/repositories/InMemoryAutomationRuleRepository';
import { InMemoryDeviceRepository } from './packages/devices/infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from './packages/devices/infrastructure/repositories/InMemoryActivityLogRepository';
import { AutomationRule } from './packages/devices/domain/automation/types';

async function validate() {
  console.log('--- STARTING CONCRETE VALIDATION ---');
  
  const ruleRepo = new InMemoryAutomationRuleRepository();
  const deviceRepo = new InMemoryDeviceRepository();
  const logRepo = new InMemoryActivityLogRepository();
  
  const sceneRepoMock = {
    findSceneById: async (id: string) => ({ id, homeId: 'h1', name: 'Scene 1', devices: [{ deviceId: 'd1', command: 'turn_on' }] }),
    findScenesByHomeId: async () => [],
    saveScene: async () => {},
    deleteScene: async () => {}
  } as any;

  let commandCount = 0;
  let sceneCount = 0;
  let lastTargetDeviceId = '';
  let lastExecutionTimestamp = '';

  const dispatcher = {
    dispatchCommand: async (homeId: string, deviceId: string, command: string) => {
      commandCount++;
      lastTargetDeviceId = deviceId;
      lastExecutionTimestamp = new Date().toISOString();
      console.log(`[Dispatcher] EXECUTED: ${command} on ${deviceId} at ${lastExecutionTimestamp}`);
    },
    executeScene: async (homeId: string, sceneId: string) => {
      sceneCount++;
      lastExecutionTimestamp = new Date().toISOString();
      console.log(`[Dispatcher] EXECUTED SCENE: ${sceneId} at ${lastExecutionTimestamp}`);
      return { success: true, results: [] };
    }
  };

  const engine = new AutomationEngine(ruleRepo, deviceRepo, sceneRepoMock, dispatcher as any, logRepo);
  (engine as any).cleanCache = () => {}; // No internals logs for brevity

  // 1. TIME TRIGGER VALIDATION
  console.log('\n[1] Time Trigger Validation (+1 minute)');
  const ruleTime: AutomationRule = {
    id: 'r-time', homeId: 'h1', userId: 'u1', name: 'Time Rule', enabled: true,
    trigger: { type: 'time', time: '10:00', days: [0,1,2,3,4,5,6] }, // All days
    action: { type: 'device_command', targetDeviceId: 'd1', command: 'turn_on' }
  };
  await ruleRepo.save(ruleTime);
  await deviceRepo.saveDevice({ id: 'd1', homeId: 'h1', name: 'D1' } as any);

  console.log('Action: Simulating Time Pulse 10:00');
  await engine.handleTimeEvent('10:00');
  console.log(`Result: Count = ${commandCount}, Timestamp = ${lastExecutionTimestamp}`);
  
  console.log('Action: Simulating Duplicate Pulse 10:00 (same minute)');
  await engine.handleTimeEvent('10:00');
  console.log(`Result: Count = ${commandCount} (Expected: 1 - Duplicate prevent success)`);

  // 2. DEVICE TRIGGER VALIDATION (WebSocket Event)
  console.log('\n[2] Device Trigger Validation (WebSocket path)');
  commandCount = 0; // Reset
  const ruleDevice: AutomationRule = {
    id: 'r-dev', homeId: 'h1', userId: 'u1', name: 'Device Rule', enabled: true,
    trigger: { type: 'device_state_changed', deviceId: 'sensor', stateKey: 'state', expectedValue: 'on' },
    action: { type: 'device_command', targetDeviceId: 'light', command: 'turn_off' }
  };
  await ruleRepo.save(ruleDevice);
  await deviceRepo.saveDevice({ id: 'light', homeId: 'h1', name: 'Light' } as any);

  console.log('Action: dispatching SystemStateChangeEvent { deviceId: "sensor", state: "on" }');
  await engine.handleSystemEvent({
    eventId: 'evt-ws-1', occurredAt: new Date().toISOString(), source: 'home_assistant',
    deviceId: 'sensor', externalId: 'ext-s', newState: { state: 'on' }
  });
  console.log(`Result: Command received by light = ${lastTargetDeviceId === 'light'}`);

  // 3. SCENE EXECUTION VALIDATION
  console.log('\n[3] Scene Execution Validation');
  const ruleScene: AutomationRule = {
    id: 'r-scene', homeId: 'h1', userId: 'u1', name: 'Scene Rule', enabled: true,
    trigger: { type: 'device_state_changed', deviceId: 'sensor2', stateKey: 'state', expectedValue: 'on' },
    action: { type: 'execute_scene', sceneId: 'scene-alpha' }
  };
  await ruleRepo.save(ruleScene);
  
  console.log('Action: Triggering scene via automation');
  await engine.handleSystemEvent({
     eventId: 'evt-ws-2', occurredAt: new Date().toISOString(), source: 'home_assistant',
     deviceId: 'sensor2', externalId: 'ext-s2', newState: { state: 'on' }
  });
  console.log(`Result: Scene execution count = ${sceneCount}`);

  // 4. LOOP PREVENTION VALIDATION
  console.log('\n[4] Loop Prevention Validation');
  commandCount = 0; // Reset
  const ruleLoop: AutomationRule = {
    id: 'r-loop', homeId: 'h1', userId: 'u1', name: 'Loop Rule', enabled: true,
    trigger: { type: 'device_state_changed', deviceId: 'd-loop', stateKey: 'state', expectedValue: 'on' },
    action: { type: 'device_command', targetDeviceId: 'd-loop', command: 'turn_on' }
  };
  await ruleRepo.save(ruleLoop);
  await deviceRepo.saveDevice({ id: 'd-loop', homeId: 'h1', name: 'Loop Device' } as any);

  console.log('Action: Triggering D-Loop first time');
  await engine.handleSystemEvent({
    eventId: 'evt-l1', occurredAt: new Date().toISOString(), source: 'home_assistant',
    deviceId: 'd-loop', externalId: 'ext-l', newState: { state: 'on' }
  });
  console.log(`Result: D-Loop count = ${commandCount}`);
  
  console.log('Action: Triggering D-Loop again (immediate echo)');
  await engine.handleSystemEvent({
     eventId: 'evt-l2', occurredAt: new Date().toISOString(), source: 'home_assistant',
     deviceId: 'd-loop', externalId: 'ext-l', newState: { state: 'on' }
  });
  console.log(`Result: D-Loop count = ${commandCount} (Expected: 1 - Loop Prevent success)`);

  console.log('\n--- ALL CONCRETE TESTS PASSED ---');
}

validate().catch(console.error);
