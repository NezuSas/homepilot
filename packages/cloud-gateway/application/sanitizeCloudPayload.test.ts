import { sanitizeDashboardPayload, sanitizeDevicePayload } from './sanitizeCloudPayload';

describe('sanitizeCloudPayload', () => {
  it('keeps only the approved dashboard fields', () => {
    expect(sanitizeDashboardPayload([{ id:'d1', title:'Casa', secret:'x', tabs:[{id:'t1',title:'Sala',widgets:[{token:'x'}]}] }])).toEqual({ dashboards:[{id:'d1',title:'Casa',tabs:[{id:'t1',title:'Sala'}]}] });
  });
  it('keeps only the approved device fields', () => {
    expect(sanitizeDevicePayload([{ id:'x',name:'Luz',type:'light',state:{on:true},roomId:'r1',isOnline:true,token:'x',cameraUrl:'x' }])).toEqual({ devices:[{id:'x',name:'Luz',type:'light',state:{on:true},roomId:'r1',isOnline:true}] });
  });
});