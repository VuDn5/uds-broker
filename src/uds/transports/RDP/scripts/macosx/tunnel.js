'use strict';
import { Process, Tasks, Logger, File, Utils } from 'runtime';

// We receive data in "data" variable, which is an object from json readonly

async function fixSizeParameter(param) {
    // fix resolution parameters (as this needs to be a windows, calc the size)
    let width = '1024';
    let height = '768';
    try {
        let out = await Process.launchAndWait('system_profiler', ['SPDisplaysDataType'], 5000);
        // look for pattern ": <number> x <number>"
        let regex = /: (\d+) x (\d+)/;
        let match = out.stdout.match(regex);
        if (match) {
            width = (parseInt(match[1]) - 4).toString();
            height = Math.floor((parseInt(match[2]) * 90) / 100).toString();
        }
    } catch (e) {
        Logger.error('Error getting system profiler data for display resolution, using safe defaults');
    }
    params = data.freerdp_params.map((param) =>
        Utils.expandVars(param).replace('#WIDTH#', width).replace('#HEIGHT#', height)
    );
    params = [...params.map((param) => Utils.expandVars(param)), `/v:${data.address}`];
    return params;
}

// Error data
let msrd = '';
let msrd_li = '';
// Note, not using interpolation, replacing later
const errorString = `xfreerdp{msrd} or thincast client not found
In order to connect to UDS RDP Sessions, you need to have a
* Xfreerdp from homebrew
  https://brew.sh|Install brew
  Install xquartz
    brew install --cask xquartz
  Install freerdp
    brew install freerdp
* ThinCast Remote Desktop Client
https://thincast.com/en/products/client|Download from here
{msrd_li}
`;

const msrdc_list = [
    '/Applications/Microsoft Remote Desktop.app',
    '/Applications/Microsoft Remote Desktop.localized/Microsoft Remote Desktop.app',
    '/Applications/Windows App.app',
    '/Applications/Windows App.localized/Windows App.app',
];

const thincast_list = [
    '/Applications/ThinCast Remote Desktop Client.app',
    '/Applications/ThinCast Remote Desktop Client.localized/ThinCast Remote Desktop Client.app',
];

const xfreerdp_list = ['udsrdp', 'xfreerdp', 'xfreerdp3', 'xfreerdp2'];

// Look for msrdc, and if allow_msrdc is set, prepare error message
let msrdExecutable = null;
if (data.allow_msrdc) {
    // Will always have data.as_file also
    msrd = ' or Microsoft Remote Desktop';
    msrd_li = `* Microsoft Remote Desktop</b> from App Store`;
    for (let appPath of msrdc_list) {
        if (File.isDirectory(appPath)) {
            msrdExecutable = appPath;
            break;
        }
    }
}
let thincastExecutable = null;
for (let appPath of thincast_list) {
    if (File.isDirectory(appPath)) {
        thincastExecutable = appPath;
        break;
    }
}
let xfreeRdpExecutable = null;
for (let executable of xfreerdp_list) {
    if (Process.findExecutable(executable)) {
        xfreeRdpExecutable = executable;
        break;
    }
}

if (!thincastExecutable && !xfreeRdpExecutable && !msrdExecutable) {
    Logger.error('No RDP client found on system');
    throw new Error(errorString.replace('{msrd}', msrd).replace('{msrd_li}', msrd_li));
}

let tunnel = await Tasks.startTunnel(
    data.tunnel.host,
    data.tunnel.port,
    data.tunnel.ticket,
    data.tunnel.startup_time,
    data.tunnel.verify_ssl,
);

let params = [];
// First preference is thincast, then freerdp and then msrdc (if allowed)
if (thincastExecutable || xfreeRdpExecutable) {
    let executablePath = thincastExecutable || xfreeRdpExecutable;
    Logger.info(`Using RDP client at ${executablePath}`);
    // We have thincast, if rdp file is provided, use it, but password goes in the command line
    if (data.as_file) {
        let content = data.as_file.replace(/\{address\}/g, `127.0.0.1:${tunnel.port}`);
        let rdpFilePath = File.createTempFile('.rdp', content);
        let password = data.password ? `/p:${data.password}` : '/p:';
        params = ['-a', executablePath, rdpFilePath, password];
        Tasks.addEarlyUnlinkableFile(rdpFilePath);
    } else {
        params = [
            '-a',
            executablePath,
            `/v:127.0.0.1:${tunnel.port}`,
            ...[await fixSizeParameter(data.freerdp_params.map((param) => Utils.expandVars(param)))],
        ];
    }
} else if (msrdExecutable) {
    // We have msrdc
    // We need to create a temp rdp file with the parameters inside
    let rdpContent = File.createTempFile('.rdp', data.as_file);
    params = [msrdExecutable, rdpContent];
    Tasks.addEarlyUnlinkableFile(rdpContent);
}

let process = Process.launch('open', params);
Tasks.addWaitableApp(process);
