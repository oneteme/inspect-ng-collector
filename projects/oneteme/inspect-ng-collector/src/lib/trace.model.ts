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
    requestMask: number;
}

export interface MainSessionCallBack extends EventTrace {
  '@type': string;
   id: string;
   end?: number;
   requestMask: number;
   exception?: ExceptionInfo; // make a list ?
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
    collector?:string;
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
    contentType?: string;
    authScheme?: string;
    dataSize:number;
    user?:string;
    start: number;
    sessionId: string | undefined;
}

export interface RestRequestCallBack extends EventTrace {
  '@type': string;
   id: string;
   status?: number;
   end?: number;
   dataSize?:number;
   linked?: boolean;
   contentType?: string;
   bodyContent? : string;
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
    sessionId: string;
}

export interface LocalRequestCallBack extends EventTrace {
  '@type': string;
  end: number;
}

export interface ExceptionInfo {
    type: string | null;
    message: string | null;
}

export interface UserAction extends EventTrace{
  '@type': string;
  type: string;
  start: number; //todo  rename  instant
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
