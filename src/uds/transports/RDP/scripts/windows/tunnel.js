'use strict';
import { Process, Tasks, Logger, File, Utils} from 'runtime';  

// We receive data in "data" variable, which is an object from json readonly
var data;

// Try, in order of preference, to find other RDP clients
const mstscPath = Process.findExecutable('mstsc.exe', ['C:\\Windows\\System32', 'C:\\Windows\\SysWOW64']);

if (!mstscPath) {
    Logger.error('No RDP client found on system');
    throw new Error('Unable to find mstsc.exe.');
}

const password = Utils.cryptProtectData(data.password);
Utils.writeHkcuDword('Software\\Microsoft\\Terminal Server Client\\LocalDevices', '127.0.0.1', 255); // Register to allow redirection

let tunnel = await Tasks.startTunnel(
    data.tunnel.host,
    data.tunel.port,
    data.tunnel.ticket,
    data.tunnel.verify_ssl,
    data.tunel.wait
);

let content = data.as_file.replace(/\{password\}/g, password);
content = content.replace(/\{address\}/g, `${tunnel.host}:${tunnel.port}`);
rdpFilePath = Utils.createTempFile(null, content, '.rdp');

let process = Process.launch(mstscPath, [rdpFilePath]);
Tasks.addEarlyUnlinkableFile(rdpFilePath);
Tasks.addWaitableApp(process);
