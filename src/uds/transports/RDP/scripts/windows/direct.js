'use strict';
import { Process, Tasks, Logger, File, Utils } from 'runtime';

// Try, in order of preference, to find other RDP clients
const mstscPath = Process.findExecutable('mstsc.exe', ['C:\\Windows\\System32', 'C:\\Windows\\SysWOW64']);

if (!mstscPath) {
    Logger.error('No RDP client found on system');
    throw new Error('Unable to find mstsc.exe.');
}

const password = Utils.cryptProtectData(data.password);
Utils.writeHkcuDword('Software\\Microsoft\\Terminal Server Client\\LocalDevices', data.ip, 255); // Register to allow redirection
let content = data.as_file.replace(/\{password\}/g, password);
let rdpFilePath = File.createTempFile(null, content, '.rdp');
let process = Process.launch(mstscPath, [rdpFilePath]);
Tasks.addEarlyUnlinkableFile(rdpFilePath);
Tasks.addWaitableApp(process);
Logger.info(`Launched RDP client with file ${rdpFilePath}`);
