'use strict';
import { Process, Tasks, Logger, File, Utils } from 'runtime';

// Try, in order of preference, to find other RDP clients
const mstscPath = Process.findExecutable('mstsc.exe', ['C:\\Windows\\System32', 'C:\\Windows\\SysWOW64']);

if (!mstscPath) {
    Logger.error('No RDP client found on system');
    throw new Error('Unable to find mstsc.exe.');
}
Logger.info(`Using RDP client at ${mstscPath}`);

const password = Utils.cryptProtectData(data.password);
Utils.writeHkcuDword('Software\\Microsoft\\Terminal Server Client\\LocalDevices', '127.0.0.1', 255); // Register to allow redirection
Logger.info(`Tunnel data: host=${data.tunnel.host}, port=${data.tunnel.port}, ticket=${data.tunnel.ticket}, verify_ssl=${data.tunnel.verify_ssl}, timeout=${data.tunnel.timeout}`);

let tunnel = await Tasks.startTunnel(
    data.tunnel.host,
    data.tunnel.port,
    data.tunnel.ticket,
    data.tunnel.startup_time,
    data.tunnel.verify_ssl,
);

let content = data.as_file.replace(/\{password\}/g, password);
content = content.replace(/\{address\}/g, `127.0.0.1:${tunnel.port}`);

let rdpFilePath = File.createTempFile(null, content, '.rdp');
Logger.info(`Created temporary RDP file at ${rdpFilePath}`);

let process = Process.launch(mstscPath, [rdpFilePath]);
Logger.info(`Created RDP process with PID ${process}`);

Tasks.addEarlyUnlinkableFile(rdpFilePath);
Logger.info(`Added early unlinkable file: ${rdpFilePath}`);
Tasks.addWaitableApp(process);
Logger.info(`Launched RDP client with file ${rdpFilePath}`);

