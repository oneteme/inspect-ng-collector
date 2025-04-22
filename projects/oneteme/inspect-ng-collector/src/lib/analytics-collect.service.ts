import {Inject, Injectable} from "@angular/core";
import {DOCUMENT} from "@angular/common";
import {extractName} from "./trace.model";
import {SessionManager} from "./session-manager.service";
import {dateNow, logInspect, prettyActionUserFormat} from "./util";

@Injectable({
  providedIn: 'root'
})
export class AnalyticsCollector {

  eventHandlers :  {[key:string]: (target: HTMLElement)=>boolean} = {
    'click' : (target:HTMLElement)=> this.lookUpChild(target,1),
    'scrollend' : (target:HTMLElement)=> this.lookUpChild(target,1),
  }
  patchedEvent : {[key:string]:boolean}  = {};
  elementsWithClickListeners = new WeakSet();
  constructor(@Inject(DOCUMENT) private readonly document: Document,
              private readonly sessionManager: SessionManager) {

  }
  subscribeToEvents(){
    const body = this.document.body;
    body.addEventListener('click', (event) => this.GlobalHandler(event), true);
    body.addEventListener('change', (event) => this.GlobalHandler(event), true);
    body.addEventListener('scrollend', (event) => this.GlobalHandler(event), true);
    body.addEventListener('dragend', (event) => this.GlobalHandler(event), true);
    this.document.addEventListener('DOMContentLoaded', (event) => this.GlobalHandler(event), true);
   /* let that =this;

    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: boolean | AddEventListenerOptions) {
      if(type === "click"){
          that.elementsWithClickListeners.add(this);
          const wrapperListener = (event: any) => {
            if(that.elementsWithClickListeners.has(event.currentTarget)){
              console.log('click event',event);
              that.GlobalHandler(event);
            }
            return listener.apply(this, arguments);
          };
          return originalAddEventListener.apply(this,[type,wrapperListener,options])
      }
      return originalAddEventListener.call(this, type, listener, options);
    }*/
  }



  GlobalHandler(event: Event | MouseEvent){
   //event.stopPropagation()
   // event.preventDefault()
    let target = event.target as HTMLElement;
    let eventType = event.type;
    try {
      if(this.eventHandlers.hasOwnProperty(eventType) && !this.eventHandlers[eventType](target)){
        return;
      }
      this.addActionUser(eventType,target);
    }catch(err){
      console.warn(err);
    }
  }

  lookUpChild(t: HTMLElement, depth: number):boolean {
    if(t.hasChildNodes() && t.children.length <= 5) {
      if(++depth > 5){
        return false;
      }
      return Array.from(t.childNodes).reduce((acc, c) =>
        acc && this.lookUpChild(c as HTMLElement, depth), true);
    }
    return true;
  }

  addActionUser(eventType: string, target: HTMLElement){
    const ua = {
      type: eventType,
      start: dateNow(),
      name : extractName(target),
      nodeName : target.tagName?.toLowerCase(),
    }
    logInspect('user',() => prettyActionUserFormat(this.sessionManager.getCurrentSession(),ua));
    this.sessionManager.getCurrentSession().userActions.push(ua);
  }


}
