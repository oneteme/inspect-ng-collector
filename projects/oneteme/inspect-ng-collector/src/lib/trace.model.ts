type InstantType = "SERVER"  | "CLIENT";
type MainSessionType =  "VIEW" | "BATCH" | "STARTUP";
export type Level = "INFO" | "WARN" | "ERROR";



export interface EventTrace {

}

export interface MainSession extends EventTrace{
    '@type': string;
    id: string;
    type: MainSessionType;
    name?: string;
    location: string;
    user?: string;
    start: number;
    end?: number;
    exceptions: ExceptionInfo[], // to be changed ?
    loading?: boolean
}

export interface InstanceEnvironment {
    id:string;
    name?: string;
    address?: string;
    version?: string;
    env?: string;
    os?: string;
    re?: string;
    user?: string;
    type?: InstantType;
    instant?:number;
    collector?:string; //ng-collector
    resource: MachineResource;
    additionalProperties?: {[key:string]: any};
    configuration?: {[key:string]: any};

}

export interface RestRequest extends EventTrace {
   '@type': string;
    id: string;
    method: string;
    protocol: string;
    host: string;
    port: number;
    path: string;
    query: string;
    contentType: string;
    authScheme?: string;
    status?: number;
    inDataSize?: number;
    ouDataSize?: number;
    user?:string;
    start: number;
    end?: number;
    sessionId: string | undefined;
}

export interface HttpRequestStage extends EventTrace {
  '@type': string;
  name: string;
  start: number;
  end?: number;
  exception?: ExceptionInfo | null;
  requestId: string;
}

export interface LocalRequest extends EventTrace {
    '@type': string;
    id: string;
    name: string;
    location: string;
    user?: string;
    start: number;
    end?: number;
    exception?: ExceptionInfo
    sessionId: string;
}

export interface ExceptionInfo { // to bechanged
    type: string | null;
    message: string | null;
}

export interface UserAction extends EventTrace{
  '@type': string;
  type: string;
  start: number;
  name: string| null;
  nodeName: string;
  sessionId: string;
}

export interface LogEntry extends EventTrace{
  '@type': string;
  instant: number;
  level: Level;
  message: string;
  sessionId?: string;
}

export interface MachineResource extends EventTrace {
  maxHeap?: number;
}

export interface MachineRessourceUsage extends  EventTrace{
  '@type': string;
  instant: number;
  commitedHeap: number;
  usedHeap: number;
}

export const genericMap : ((t:HTMLElement)=>string|null)[] = [
    t => t.getAttribute('placeholder'),
    t => t.getAttribute('title'),
    t => t.innerText,
    t => t.getAttribute('name'),
    t => t.getAttribute('id'),
  ]

export const MAP: {[key:string]:  ((t:HTMLElement)=>string|null)[]} = {
  'img' : [
    t=> t.getAttribute('alt'),
    t=> t.getAttribute('src'),
  ],
  'input': [
    t=> t.getAttribute('name'),
  ],
  'a' : [
    t=> t.getAttribute('href'),
  ],
  'label':[
    t=> t.getAttribute('for'),
  ],
}

export function getFirst(c:((t:HTMLElement)=>string|null)[], t: HTMLElement) {
  for (const o of c) {
    let r = o(t)?.trim();
    if (r) {
      return r;
    }
  }
  return null;
}

export function extractName(t: HTMLElement){
  try
  {
    let tagName = t.tagName
    if(tagName){
      let name;
      let c =  MAP[tagName.toLowerCase()];
      if(c){
        name  = getFirst(c,t);
      }
      return name ?? getFirst(genericMap,t)!;
    }

  }catch(err){
    console.warn(err)
  }
  return null
}
