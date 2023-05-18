const { networkInterfaces } = require('os');

function getCurrentIP() {
  const interfaces = networkInterfaces();
  let ipAddress = '';

  // Iterate over network interfaces
  Object.keys(interfaces).forEach((interfaceName) => {
    const interfaceInfo = interfaces[interfaceName];

    // Find IPv4 addresses excluding loopback and internal addresses
    const ipv4Address = interfaceInfo.find((info) =>
      info.family === 'IPv4' && !info.internal && info.cidr !== '127.0.0.1'
    );

    // Retrieve the IPv4 address if found
    if (ipv4Address) {
      ipAddress = ipv4Address.address;
    }
  });

  return ipAddress;
}

// Usage
const currentIP = getCurrentIP();
console.log('Current IP:', currentIP);
module.exports ={currentIP};