type InstantType = "SERVER"  | "CLIENT";
type MainSessionType =  "VIEW" | "BATCH" | "STARTUP";
export type UserActionType = "CLICK" | "SELECT" | "DRAG" | "DROP" | "SCROLL";
export type ElementType = "button" | "input" | "a" | "textarea" | 'img' ;



export interface MainSession {
    '@type'?: string;
    type: MainSessionType;
    name?: string;
    location: string;
    user?: string;
    start: number;
    end?: number;
    exception?: ExceptionInfo // to be changed ?
    restRequests: RestRequest[],
    localRequests: LocalRequest[],
    userActions: UserAction[],
    loading?: boolean
}

export interface InstanceEnvironment {
    id?:string;
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
    exception?: ExceptionInfo
}

export interface LocalRequest {
    name: string;
    location: string;
    user?: string;
    start: number;
    end: number;
    exception?: ExceptionInfo
}

export interface ExceptionInfo { // to bechanged
    type: string | null;
    message: string | null;
}

export interface UserAction{
  type: UserActionType;
  start: number;
  name: string;
}

export abstract class Element{
   protected target: HTMLElement;

    constructor(target: HTMLElement) {
      this.target = target;
    }

    abstract extractName():string;

  static createElement(element:HTMLElement){
    const tagCLass =  ElementRegistry.getELementClass(element.nodeName);//(element);
    return new tagCLass(element);
  }

  getFirst(values:any[]){
    for(const v of values){
      if(v && v.trim() != ''){
        return v.trim();
      }
    }
  }

}

export class GenericElement extends Element{
  override extractName(): string {
    return this.getFirst([
      this.target.textContent,
      this.target.getAttribute('title'),
      this.target.getAttribute('aria-label'),
      this.target.getAttribute('id'),
      this.target.getAttribute('name'),
      `${this.target.tagName.toLowerCase()}`
    ]);
  }

}

export class ImgElement extends Element{
  override extractName(): string {
    return this.getFirst([
      this.target.getAttribute('alt'),
      this.target.getAttribute('title'),
      this.target.getAttribute('aria-label'),
      this.target.getAttribute('name'),
      `${this.target.tagName.toLowerCase()}`
    ]);
  }
}

export type ElementConstructor = new (element: HTMLElement) => Element;

export class ElementRegistry {
   private static registry: Map<string, ElementConstructor> = new Map();
   private static readonly defaultElementConstructor = GenericElement;

   static register(eLementConstructor: ElementConstructor, elementsName: string[]){
      elementsName.forEach(e=> this.registry.set( e.toLowerCase(), eLementConstructor))
   }

   static getELementClass(elementName: string):ElementConstructor{
     return this.registry.get(elementName.toLowerCase()) || this.defaultElementConstructor;
   }
}

ElementRegistry.register(ImgElement,['img'])




