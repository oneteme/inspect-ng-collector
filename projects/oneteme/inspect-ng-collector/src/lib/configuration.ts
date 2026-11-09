import {
  dateNow,
  ExceptionTrace,
  InstanceEnvironment,
  StackTraceRow,
  TRACE_TYPE_COLLECTOR_CONFIGURATION, TRACE_TYPE_EXCEPTION, TraceType,
  UUID
} from "./trace.model";
import {dispatchReport} from "./event-bus";
import {VERSION} from "@angular/core";
type Provider<T> = T | (() => T);

const HOST_PATERN = /https?:\/\/[\w\-.]+(:\d{2,5})?\/?/;
const DEFAULT_QUEUE_CAPACITY = 1000;
const DEFAULT_INTERVAL = 60_000;


export interface CollectorConfig {
  application: {
    name: Provider<string>;
    namespace: Provider<string>;
    version?: Provider<string>;
    env: Provider<string>;
    user?: Provider<string>;
    branche?: Provider<string>;
    hash?: Provider<string>;
  };
  collector: {
    enabled?: boolean; // default: false
    debugMode?: boolean;
    additionalProperties?: () => { [key: string]: any };
    scheduling?: {
      queueCapacity?: number; // default: 1000
      interval?: number; // default: 60s, in milliseconds
    };
    monitoring?: {
      httpRoute?: {
        excludes?: {
          path?: Provider<RegExp[]>;
        };
      };
      httpRequest?: {
        excludes?: {
          host?: string[];
        };
      };
      resources?: {
        enabled?: boolean; // default: false
      };
      analytics?: {
        enabled?: boolean; // default: false
      };
      logger?: {
        enabled?: boolean; // default: false
      };
      reporter?: {
        enabled?: boolean; // default: false
      }
      storage?: {
        enabled: boolean; // default: false
      };
    };
    tracing: {
      remote: {
        '@type'?: string;
        host: string; // default: 'localhost'
        token?: Provider<string>;
        retentionMaxAge?: {
          audit?: number;
          diagnostics?: number;
        };
      };
    };
  };
}

export interface TechnicalConf {
  user?: Provider<string>;
  queueCapacity: number;
  interval: number;
  instanceApi: string;
  sessionApi: string;
  exclude?: RegExp[];
  hostExcludes?: string[];
  debugMode: boolean;
  analytics: boolean;
  resources: boolean;
  storage: boolean;
  logger: boolean;
  reporter: boolean;
  namespaceHeader: string;
  enabled: boolean;
}

export function getOrCall<T>(o?: Provider<T>): T | undefined {
  return typeof o === "function" ? (o as () => T)() : o;
}

export function matchRegex(v: string | undefined,  name: string, pattern: RegExp, defaultValue?: string) {
  if(v && pattern.exec(v)){
     return v;
  }
  if(!defaultValue){
    if(v != undefined){
      throw new Error(`bad value ${name}=${v}, pattern=${pattern}`);
    }else {
      throw new Error(`${name} property is required`);
    }
  }
  return defaultValue;
}

export function requirePostitiveValue(v: number | undefined, name: string, defaultValue:number){
  if(v && v > 0) {
    return v;
  }
  if(v == undefined){
    return defaultValue;
  }
  throw new Error(`bad value ${name}=${v} <= 0`);
}

export function require(v: string | undefined, name: string){
  if(v != undefined){
    return v;
  }
  throw new Error(`${name} property is required`);
}

export function adaptedConfig(conf: CollectorConfig) {
  return {
    ...conf.collector,
    scheduling: {
      ...conf.collector.scheduling,
      interval: conf.collector.scheduling?.interval && conf.collector.scheduling.interval / 1000
    },
    monitoring: {
      ...conf.collector.monitoring,
      additionalProperties: String(conf.collector.additionalProperties),
      name: String(conf.application.name),
      version: String(conf.application.version),
      env: String(conf.application.env),
      user: String(conf.application.user),
      httpRoute: {
        ...conf.collector.monitoring?.httpRoute,
        excludes: {
          path: (conf.collector.monitoring?.httpRoute?.excludes?.path as RegExp[]).map(r => r.source)
        }
      }
    },
    tracing: {
      ...conf.collector.tracing,
      remote: {
        ...conf.collector.tracing?.remote,
        '@type': TRACE_TYPE_COLLECTOR_CONFIGURATION,
        retentionMaxAge :  {
          audit: (conf.collector.tracing?.remote?.retentionMaxAge?.audit ?? 7)  * 60 * 60 * 24,
          diagnostic: (conf.collector.tracing?.remote?.retentionMaxAge?.diagnostics ?? 10)  * 60 * 60 * 24,
        },
      }
    }
  }
}

export function validateAndGetConfig(conf: CollectorConfig, instanceId: string) : TechnicalConf {
  const collector = conf.collector;
  const application = conf?.application;
  const remote = collector?.tracing?.remote;
  const host = matchRegex(getOrCall<string>(remote?.host), "host", HOST_PATERN, "http://localhost");
  return {
    user: getOrCall<string>(application?.user),
    queueCapacity: requirePostitiveValue(getOrCall<number>(collector?.scheduling?.queueCapacity), "queueCapacity", DEFAULT_QUEUE_CAPACITY),
    interval: requirePostitiveValue(getOrCall<number>(collector?.scheduling?.interval), "interval", DEFAULT_INTERVAL),
    instanceApi: new URL('v5/trace/instance', host).href,
    sessionApi : new URL(`v5/trace/instance/${instanceId}/session`, host).href,
    exclude: getOrCall<RegExp[]>(collector?.monitoring?.httpRoute?.excludes?.path) || [],
    hostExcludes: collector?.monitoring?.httpRequest?.excludes?.host || [],
    debugMode: !!collector?.debugMode,
    analytics: !!collector?.monitoring?.analytics?.enabled,
    resources: !!collector?.monitoring?.resources?.enabled,
    storage: !!collector?.monitoring?.storage?.enabled,
    logger: !!collector?.monitoring?.logger?.enabled,
    reporter: !!collector?.monitoring?.reporter?.enabled,
    namespaceHeader: "basic " + btoa(`${require(getOrCall<string>(application?.namespace), 'configuration.collector.application.namespace')}:${getOrCall<string>(remote?.token) ?? ""}`),
    enabled: !!collector?.enabled
  }
}

export function createInstance(conf: CollectorConfig, instanceId: string): InstanceEnvironment {

  const collector = conf.collector;
  const application = conf.application;
  const branche = getOrCall<string>(application?.branche);
  const hash = getOrCall<string>(application?.hash);
  return   {
    id: instanceId,
    instant: dateNow(),
    name: require(getOrCall<string>(application?.name), 'configuration.collector.application.name'),
    version: getOrCall<string>(application?.version),
    address: getClientID(), //server side
    env: require(getOrCall<string>(application?.env), 'configuration.collector.application.env'),
    os: detectOs(),
    re: detectBrowser(),
    user: undefined, // cannot get user
    type: "CLIENT",
    collector: "inspect-ng-collector-1.3.4",
    resource: { maxHeap: (('memory' in performance) && (performance as any).memory.jsHeapSizeLimit / (1024 * 1024)) || undefined,
               availableProcessors: navigator.hardwareConcurrency},
    additionalProperties: {
      ...collector?.additionalProperties?.(),
      ...(branche !== undefined ? { branche } : {}),
      ...(hash !== undefined ? { hash } : {}),
       'user.locale': navigator.language + '~' + Intl.DateTimeFormat().resolvedOptions().timeZone,
      'angular.version': VERSION.full
    },
    configuration: adaptedConfig(conf),
    namespace: require(getOrCall<string>(application?.namespace), 'configuration.collector.application.namespace'),
  }
}

function getClientID() {
  let cid = localStorage.getItem("jarvis.inspect.cid");
  if (!cid) {
    localStorage.setItem("jarvis.inspect.cid", cid = crypto.randomUUID());
  }
  return cid;
}

function detectOs() {
  try {
    let versionMatch, version;
    const agent = globalThis.navigator.userAgent.toLowerCase() //TODO see also  https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData
    switch (true) {
      case (/windows/.test(agent)):
        versionMatch = /windows nt (\d+\.\d+)/.exec(agent);
        version = versionMatch ? versionMatch[1] : '?';
        return `Windows ${version}`;
      case (/linux/.test(agent)):
        return 'Linux';

      case (/macintosh/.test(agent)):
        versionMatch = /mac os x (\d+[._]\d+[._]\d+)/.exec(agent);
        version = versionMatch ? versionMatch[1] : '?';
        return `MacOs ${version}`
    }
  }
  catch (e) {
    dispatchReport("detectOs", e) ;
  }
  return undefined;
}

function detectBrowser() {
  try {
    const agent = globalThis.navigator.userAgent.toLowerCase()
    switch (true) {
      case agent.includes('edg'):
        return 'Edge';
      case agent.includes('opr'):
        return 'Opera';
      case agent.includes('chrome'):
        return 'Chrome';
      case agent.includes('firefox'):
        return 'Firefox';
      case agent.includes('safari'):
        return 'Safari';
      case agent.includes('msie'):
        return 'IE';
    }
  }
  catch (e) {
    dispatchReport("detectBrowser", e)
  }
  return undefined;
}

export function refreshConfig(id: string, tech: TechnicalConf) {
  const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  tech.sessionApi = tech.sessionApi.replace(uuidRegex, id);
  return id;
}

export function createException( error: Error | string | object, traceId: UUID | undefined, traceType: TraceType, parseStack:boolean=false,): ExceptionTrace | undefined {
  try{
    const isError = error instanceof Error;
    let message: string | undefined;
    if (typeof error === "string") {
      message = error;
    } else if (isError) {
      message = error.message;
    } else {
      message = JSON.stringify(error);
    }

    if (isError) {
      return {
        '@type': TRACE_TYPE_EXCEPTION,
        type: isError ? error.name : undefined,
        message,
        stackTraceRows: parseStack ? parseStackTrace(error.stack) : undefined,
        traceId,
        traceType,
        offset: dateNow()
      }
    } else {
      return {
        '@type': TRACE_TYPE_EXCEPTION,
        type: isError ? error.name : undefined,
        message,
        stackTraceRows: parseStack ? parseStackTrace(undefined) : undefined,
        traceId,
        traceType,
        offset: dateNow()
      }
    }
  }catch(e){
    dispatchReport("createException", e)
  }
  return undefined;
}

export function parseStackTrace(stack?: string): StackTraceRow[] | undefined {
  try {
    if (!stack) {
      return undefined;
    }
    const rows = stack.split('\n').slice(1).flatMap(line => {
      const match = /^at\s+(?:(.*?)\s+\()?(.+):(\d+):(\d+)\)?$/.exec(line.trim());
      if (!match) {
        return [];
      }

      return [{
        className: match[2],
        methodName: match[1] || undefined,
        lineNumber: Number(match[3])
      }];
    });
    return rows.length > 0 ? rows : undefined;
  }catch (e) {
    dispatchReport("parseStackTrace", e)
  }
  return undefined;
}
