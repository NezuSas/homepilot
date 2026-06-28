const dgram = require('dgram');
const crypto = require('crypto');
const os = require('os');

const nets = os.networkInterfaces();
const addresses = [];
for (const list of Object.values(nets)) {
  for (const iface of list) {
    if (iface.family === 'IPv4' && !iface.internal) {
      addresses.push(iface.address);
    }
  }
}

console.log('Probing on:', addresses);

addresses.forEach(bindAddress => {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, rinfo) => {
    console.log('Received on ' + bindAddress + ' from ' + rinfo.address + ':', msg.toString());
  });
  socket.bind(0, bindAddress, () => {
    socket.setBroadcast(true);
    socket.setMulticastTTL(128);
    const uuid = crypto.randomUUID();
    const xml = '<?xml version="1.0" encoding="UTF-8"?><e:Envelope xmlns:e="http://www.w3.org/2003/05/soap-envelope" xmlns:w="http://schemas.xmlsoap.org/ws/2004/08/addressing" xmlns:d="http://schemas.xmlsoap.org/ws/2005/04/discovery"><e:Header><w:MessageID>uuid:' + uuid + '</w:MessageID><w:To e:mustUnderstand="true">urn:schemas-xmlsoap-org:ws:2005:04:discovery</w:To><w:Action e:mustUnderstand="true">http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</w:Action></e:Header><e:Body><d:Probe /></e:Body></e:Envelope>';
    const buf = Buffer.from(xml);
    socket.send(buf, 0, buf.length, 3702, '239.255.255.250');
  });
});
setTimeout(() => { process.exit(0); }, 3000);
