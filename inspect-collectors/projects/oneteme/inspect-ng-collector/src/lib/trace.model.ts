type InstantType = "SERVER"  | "CLIENT";
type MainSessionType =  "VIEW" | "BATCH" | "STARTUP";
export interface MainSession {
    '@type'?: string;
    type: MainSessionType;
    name?: string;
    location: string;
    user?: string;
    start: number;
    end?: number;
    threadName?:string;  // always null 
    exception?: ExceptionInfo // to be changed ? 
    restRequests: RestRequest[]
}

export interface InstanceEnvironment {
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
}

export interface RestRequest {
    id?: string;
    method: string;
    protocol: string;
    host: string;
    port: number;
    path: string;
    query: string;
    contentType: string;
    authScheme?: string;
    status: number;
    inDataSize: number;
    ouDataSize: number;
    user?:string;
    start: number;
    end: number;
    threadName?:string;
    exception?: ExceptionInfo
}

export interface ExceptionInfo { // to bechanged 
    type: string;
    message: string;
}

