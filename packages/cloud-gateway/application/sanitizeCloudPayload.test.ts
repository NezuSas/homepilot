import { sanitizeDashboardPayload, sanitizeDevicePayload } from './sanitizeCloudPayload';

describe('sanitizeCloudPayload', () => {
  it('keeps only the approved dashboard fields', () => {
    expect(sanitizeDashboardPayload([{ id:'d1', title:'Casa', secret:'x', tabs:[{id:'t1',title:'Sala',widgets:[{token:'x'}]}] }])).toEqual({ dashboards:[{id:'d1',title:'Casa',tabs:[{id:'t1',title:'Sala'}]}] });
  });
  it('keeps only the approved device fields', () => {
    expect(sanitizeDevicePayload([{ id:'x',name:'Luz',type:'light',state:{on:true},roomId:'r1',isOnline:true,token:'x',cameraUrl:'x' }])).toEqual({ devices:[{id:'x',name:'Luz',type:'light',state:{on:true},roomId:'r1',isOnline:true}] });
  });
});
  it('derives availability from the persisted local lastKnownState', () => {
    expect(sanitizeDevicePayload([{ id:'online',name:'Luz',type:'light',lastKnownState:{state:'on'},roomId:null }, { id:'offline',name:'Sensor',type:'sensor',lastKnownState:{state:'unavailable'},roomId:null }])).toEqual({ devices:[{id:'online',name:'Luz',type:'light',state:{state:'on'},roomId:null,isOnline:true},{id:'offline',name:'Sensor',type:'sensor',state:{state:'unavailable'},roomId:null,isOnline:false}] });
  });
