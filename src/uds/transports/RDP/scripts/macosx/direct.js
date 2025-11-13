'use strict';

// Info for lintering tools about the variables provided by uds client
var Process, Logger, File, Utils, Tasks;

// We receive data in "data" variable, which is an object from json readonly
var data;

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
const errorString = `<p><b>xfreerdp{msrd} or thincast client not found</b></p>
        <p>In order to connect to UDS RDP Sessions, you need to have a<p>
        <ul>
            <li>
                <p><b>Xfreerdp</b> from homebrew</p>
                <p>
                    <ul>
                        <li>Install brew (from <a href="https://brew.sh">brew website</a>)</li>
                        <li>Install xquartz<br/>
                            <b>brew install --cask xquartz</b></li>
                        <li>Install freerdp<br/>
                            <b>brew install freerdp</b></li>
                        <li>Reboot so xquartz will be automatically started when needed</li>
                    </ul>
                </p>
            </li>
            {msrd_li}
            <li>
                <p>ThinCast Remote Desktop Client (from <a href="https://thincast.com/en/products/client">thincast website</a>)</p>
            </li>
        </ul>`;

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
    msrd_li = `<li>
            <p><b>Microsoft Remote Desktop</b> from App Store</p>
            <p>
                <ul>
                    <li>Install from <a href="https://apps.apple.com/us/app/microsoft-remote-desktop/id1295203466?mt=12">App Store</a></li>
                </ul>
            </p>
        </li>`;
    for (let appPath of msrdc_list) {
        if (File.isDirectory(appPath)) {
            msrdExecutable = appPath;
            break;
        }
    }
}
let xfreeRdpExecutable = null;
for (let executable of xfreerdp_list) {
    if (Process.findExecutable(executable)) {
        xfreeRdpExecutable = executable;
        break;
    }
}
let thincastExecutable = null;
for (let appPath of thincast_list) {
    if (File.isDirectory(appPath)) {
        thincastExecutable = appPath;
        break;
    }
}

let params = [];
// First preference is thincast, then freerdp and then msrdc (if allowed)
if (thincastExecutable || xfreeRdpExecutable) {
    let executablePath = thincastExecutable || xfreeRdpExecutable;
    Logger.info(`Using RDP client at ${executablePath}`);
    // We have thincast, if rdp file is provided, use it, but password goes in the command line
    if (data.as_file) {
        let rdpFilePath = Utils.createTempFile('.rdp', data.as_file);
        let password = data.password ? `/p:${data.password}` : '/p:';
        params = ['-a', executablePath, rdpFilePath, password];
        Tasks.addEarlyUnlinkableFile(rdpFilePath);
    } else {
        params = [
            '-a',
            executablePath,
            `/v:${data.address}`,
            ...[await fixSizeParameter(data.freerdp_params.map((param) => Utils.expandVars(param)))],
        ];
    }
} else if (msrdExecutable) {
    // We have msrdc
    // We need to create a temp rdp file with the parameters inside
    let rdpContent = Utils.createTempFile('.rdp', data.as_file);
    params = [msrdExecutable, rdpContent];
    Tasks.addEarlyUnlinkableFile(rdpContent);
} else {
    Logger.error('No RDP client found on system');
    throw new Error(errorString.replace('{msrd}', msrd).replace('{msrd_li}', msrd_li));
}

let process = Process.launch('open', params);
Tasks.addWaitableApp(process);
