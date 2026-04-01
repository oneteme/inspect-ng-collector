import {
  adaptedConfig,
  CollectorConfig, getOrCall,
  require,
  validateAndGetConfig
} from "./configuration";
import { InstanceEnvironment, dateNow } from "./trace.model";
import { dispatchReport } from "./event-bus";

export const SLASH = '/';

export function ContextManger(conf: CollectorConfig){
  let id = crypto.randomUUID();
  return ContextManager._instance = new ContextManager(createInstance(conf, id), validateAndGetConfig(conf, id));
}

export class ContextManager {
   static _instance: ContextManager;


  constructor(private readonly _instanceEnv: any, private readonly _techConfig: any) {
  }

  get techConfig(): any {
    return this._techConfig;
  }
  get instanceEnv(): any {
    return this._instanceEnv;
  }

  static get instance() {
    if (!ContextManager._instance) {
      console.warn("[Inspect-ng-collector] Error while initializing ContextManager");
    }
    return ContextManager._instance;
  }

}
function getClientID() {
  let cid = localStorage.getItem("jarvis.inspect.cid");
  if (!cid) {
    localStorage.setItem("jarvis.inspect.cid", cid = crypto.randomUUID());
  }
  return cid;
}

function toURL(host: string, path: string) {
  return host.endsWith(SLASH) || path.startsWith(SLASH) ? host + path : [host, path].join(SLASH);
}

export function detectBrowser() {
  try {
    const agent = window.navigator.userAgent.toLowerCase()
    switch (true) {
      case agent.indexOf('edg') > -1:
        return 'Edge';
      case agent.indexOf('opr') > -1:
        return 'Opera';
      case agent.indexOf('chrome') > -1:
        return 'Chrome';
      case agent.indexOf('firefox') > -1:
        return 'Firefox';
      case agent.indexOf('safari') > -1:
        return 'Safari';
      case agent.indexOf('msie') > -1:
        return 'IE';
    }
  }
  catch (e) {
    console.error(e); //TODO report
    dispatchReport("ContextManager.detectBrowser", JSON.stringify(e)) // TODO cannot report here the event dispatcher is not initialized yet, maybe store it and dispatch it at initialization ?
  }
  return undefined;
}

export function detectOs() {
  try {
    let versionMatch, version;
    const agent = window.navigator.userAgent.toLowerCase()
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
    console.error(e); //TODO report
    dispatchReport("ContextManager.detectBrowser", JSON.stringify(e))  // TODO cannot report here the event dispatcher is not initialized yet, maybe store it and dispatch it at initialization ?
  }
  return undefined;
}

export function createInstance(conf: CollectorConfig, instanceId: string): InstanceEnvironment {
  return {
    id: instanceId,
    instant: dateNow(),
    name: require(getOrCall<string>(conf?.monitoring?.name), 'name'),
    version: getOrCall<string>(conf?.monitoring?.version),
    address: getClientID(), //server side
    env: require(getOrCall<string>(conf?.monitoring?.env), 'env'),
    os: detectOs(),
    re: detectBrowser(),
    user: undefined, // cannot get user
    type: "CLIENT",
    collector: "inspect-ng-collector-0.0.1",
    resource: { maxHeap: (('memory' in performance) && (performance as any).memory.jsHeapSizeLimit / (1024 * 1024)) || undefined },
    additionalProperties: conf?.monitoring?.additionalProperties(),
    configuration: adaptedConfig(conf)
  }
}
