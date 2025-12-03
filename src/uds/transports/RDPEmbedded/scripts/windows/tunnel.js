'use strict';
import { Tasks, Logger, RDP } from 'runtime';

Logger.info(`Tunnel data: host=${data.tunnel.host}, port=${data.tunnel.port}, ticket=${data.tunnel.ticket}, verify_ssl=${data.tunnel.verify_ssl}, timeout=${data.tunnel.timeout}`);

let tunnel = await Tasks.startTunnel(
    data.tunnel.host,
    data.tunnel.port,
    data.tunnel.ticket,
    data.tunnel.startup_time,
    data.tunnel.verify_ssl,
);

data.port = tunnel.port;
data.server = '127.0.0.1';

RDP.start(data);