const dgram = require('dgram');
const crypto = require('crypto');
const socket = dgram.createSocket('udp4');
socket.on('message', (msg, rinfo) => {
  console.log('Received from ' + rinfo.address + ':', msg.toString());
});
socket.bind(0, '0.0.0.0', () => {
  console.log('Bound to ' + socket.address().port);
  socket.setBroadcast(true);
  const uuid = crypto.randomUUID();
  const xml = '<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"><e:Header><w:MessageID>uuid:' + uuid + '</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe /></e:Body></e:Envelope>';
  const buf = Buffer.from(xml);
  socket.send(buf, 0, buf.length, 3702, '239.255.255.250');
  setTimeout(() => { socket.close(); process.exit(0); }, 3000);
});
