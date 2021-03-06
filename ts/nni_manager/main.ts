// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

'use strict';

import { Container, Scope } from 'typescript-ioc';

import * as fs from 'fs';
import * as path from 'path';
import * as component from './common/component';
import { Database, DataStore } from './common/datastore';
import { setExperimentStartupInfo } from './common/experimentStartupInfo';
import { getLogger, Logger, logLevelNameMap } from './common/log';
import { Manager, ExperimentStartUpMode } from './common/manager';
import { ExperimentManager } from './common/experimentManager';
import { TrainingService } from './common/trainingService';
import { getLogDir, mkDirP, parseArg } from './common/utils';
import { NNIDataStore } from './core/nniDataStore';
import { NNIManager } from './core/nnimanager';
import { SqlDB } from './core/sqlDatabase';
import { NNIExperimentsManager } from './core/nniExperimentsManager';
import { NNIRestServer } from './rest_server/nniRestServer';
import { FrameworkControllerTrainingService } from './training_service/kubernetes/frameworkcontroller/frameworkcontrollerTrainingService';
import { AdlTrainingService } from './training_service/kubernetes/adl/adlTrainingService';
import { KubeflowTrainingService } from './training_service/kubernetes/kubeflow/kubeflowTrainingService';
import { LocalTrainingService } from './training_service/local/localTrainingService';
import { RouterTrainingService } from './training_service/reusable/routerTrainingService';
import { DLTSTrainingService } from './training_service/dlts/dltsTrainingService';


function initStartupInfo(
    startExpMode: string, experimentId: string, basePort: number, platform: string,
    logDirectory: string, experimentLogLevel: string, readonly: boolean, dispatcherPipe: string): void {
    const createNew: boolean = (startExpMode === ExperimentStartUpMode.NEW);
    setExperimentStartupInfo(createNew, experimentId, basePort, platform, logDirectory, experimentLogLevel, readonly, dispatcherPipe);
}

async function initContainer(foreground: boolean, platformMode: string, logFileName?: string): Promise<void> {
    const routerPlatformMode = ['remote', 'pai', 'aml', 'hybrid'];
    if (routerPlatformMode.includes(platformMode)) {
        Container.bind(TrainingService)
            .to(RouterTrainingService)
            .scope(Scope.Singleton);
    } else if (platformMode === 'local') {
        Container.bind(TrainingService)
            .to(LocalTrainingService)
            .scope(Scope.Singleton);
    } else if (platformMode === 'kubeflow') {
        Container.bind(TrainingService)
            .to(KubeflowTrainingService)
            .scope(Scope.Singleton);
    } else if (platformMode === 'frameworkcontroller') {
        Container.bind(TrainingService)
            .to(FrameworkControllerTrainingService)
            .scope(Scope.Singleton);
    } else if (platformMode === 'dlts') {
        Container.bind(TrainingService)
            .to(DLTSTrainingService)
            .scope(Scope.Singleton);
    } else if (platformMode === 'adl') {
        Container.bind(TrainingService)
            .to(AdlTrainingService)
            .scope(Scope.Singleton);
    } else {
        throw new Error(`Error: unsupported mode: ${platformMode}`);
    }
    Container.bind(Manager)
        .to(NNIManager)
        .scope(Scope.Singleton);
    Container.bind(Database)
        .to(SqlDB)
        .scope(Scope.Singleton);
    Container.bind(DataStore)
        .to(NNIDataStore)
        .scope(Scope.Singleton);
    Container.bind(ExperimentManager)
        .to(NNIExperimentsManager)
        .scope(Scope.Singleton);
    const DEFAULT_LOGFILE: string = path.join(getLogDir(), 'nnimanager.log');
    if (foreground) {
        logFileName = undefined;
    } else if (logFileName === undefined) {
        logFileName = DEFAULT_LOGFILE;
    }
    Container.bind(Logger).provider({
        get: (): Logger => new Logger(logFileName)
    });
    const ds: DataStore = component.get(DataStore);

    await ds.init();
}

function usage(): void {
    console.info('usage: node main.js --port <port> --mode \
    <local/remote/pai/kubeflow/frameworkcontroller/aml/adl/hybrid> --start_mode <new/resume> --experiment_id <id> --foreground <true/false>');
}

const strPort: string = parseArg(['--port', '-p']);
if (!strPort || strPort.length === 0) {
    usage();
    process.exit(1);
}

const foregroundArg: string = parseArg(['--foreground', '-f']);
if (!('true' || 'false').includes(foregroundArg.toLowerCase())) {
    console.log(`FATAL: foreground property should only be true or false`);
    usage();
    process.exit(1);
}
const foreground: boolean = foregroundArg.toLowerCase() === 'true' ? true : false;

const port: number = parseInt(strPort, 10);

const mode: string = parseArg(['--mode', '-m']);
if (!['local', 'remote', 'pai', 'kubeflow', 'frameworkcontroller', 'dlts', 'aml', 'adl', 'hybrid'].includes(mode)) {
    console.log(`FATAL: unknown mode: ${mode}`);
    usage();
    process.exit(1);
}

const startMode: string = parseArg(['--start_mode', '-s']);
if (![ExperimentStartUpMode.NEW, ExperimentStartUpMode.RESUME].includes(startMode)) {
    console.log(`FATAL: unknown start_mode: ${startMode}`);
    usage();
    process.exit(1);
}

const experimentId: string = parseArg(['--experiment_id', '-id']);
if (experimentId.trim().length < 1) {
    console.log(`FATAL: cannot resume the experiment, invalid experiment_id: ${experimentId}`);
    usage();
    process.exit(1);
}

const logDir: string = parseArg(['--log_dir', '-ld']);
if (logDir.length > 0) {
    if (!fs.existsSync(logDir)) {
        console.log(`FATAL: log_dir ${logDir} does not exist`);
    }
}

const logLevel: string = parseArg(['--log_level', '-ll']);
if (logLevel.length > 0 && !logLevelNameMap.has(logLevel)) {
    console.log(`FATAL: invalid log_level: ${logLevel}`);
}

const readonlyArg: string = parseArg(['--readonly', '-r']);
if (!('true' || 'false').includes(readonlyArg.toLowerCase())) {
    console.log(`FATAL: readonly property should only be true or false`);
    usage();
    process.exit(1);
}
const readonly = readonlyArg.toLowerCase() == 'true' ? true : false;

const dispatcherPipe: string = parseArg(['--dispatcher_pipe']);

initStartupInfo(startMode, experimentId, port, mode, logDir, logLevel, readonly, dispatcherPipe);

mkDirP(getLogDir())
    .then(async () => {
        try {
            await initContainer(foreground, mode);
            const restServer: NNIRestServer = component.get(NNIRestServer);
            await restServer.start();
            const log: Logger = getLogger();
            log.info(`Rest server listening on: ${restServer.endPoint}`);
        } catch (err) {
            const log: Logger = getLogger();
            log.error(`${err.stack}`);
            throw err;
        }
    })
    .catch((err: Error) => {
        console.error(`Failed to create log dir: ${err.stack}`);
    });

function cleanUp(): void {
    (component.get(Manager) as Manager).stopExperiment();
}

process.on('SIGTERM', cleanUp);
process.on('SIGBREAK', cleanUp);
process.on('SIGINT', cleanUp);
