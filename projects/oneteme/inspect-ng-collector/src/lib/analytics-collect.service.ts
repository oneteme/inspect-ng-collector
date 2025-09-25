import {extractName} from "./trace.model";
import {SessionManager} from "./session-manager.service";
import {createReport, dateNow, DISPATCH, logInspect, prettyActionUserFormat} from "./util";
import {ContextManager} from "./context-manager";

  const elementsWithClickListeners = new WeakSet();
  let  eventHandlers :  {[key:string]: (target: HTMLElement)=>boolean} = {
    'click' : (target:HTMLElement)=> lookUpChild(target,1),
  }
  export function analyticsEventsListener(){
    try{
      if( ContextManager.instance.techConfig.analytics){
        const body = window.document.body;
        body.addEventListener('click', globalHandler, true);
        body.addEventListener('change', (event) => globalHandler(event), true);
        body.addEventListener('scrollend', (event) => globalHandler(event), true);
        body.addEventListener('dragend', (event) => globalHandler(event), true);
        window.document.addEventListener('DOMContentLoaded', (event) => globalHandler(event), true);
      }
    }catch(e){
      console.warn(e)
      window.dispatchEvent(new CustomEvent( DISPATCH,{ detail : { traces : createReport("Error while subscribing to analytics user events: " + JSON.stringify(e)) } }));
    }
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


  function globalHandler(event: Event | MouseEvent){
   // event.stopPropagation()
   // event.preventDefault()
    let target = event.target as HTMLElement;
    let eventType = event.type;
    try {
      if(eventHandlers.hasOwnProperty(eventType) && !eventHandlers[eventType](target)){
        return;
      }
      addActionUser(eventType,target);
    }catch(err){
      console.warn(err);
    }
  }

  function lookUpChild(t: HTMLElement, depth: number):boolean {
    if(t.hasChildNodes() && t.children.length <= 5) {
      if(++depth > 5){
        return false;
      }
      return Array.from(t.childNodes).reduce((acc, c) =>
        acc && lookUpChild(c as HTMLElement, depth), true);
    }
    return true;
  }

  function addActionUser(eventType: string, target: HTMLElement){
    const ua = {
      '@type': "", // todo: set this type for user action
      type: eventType,
      start: dateNow(),
      name : extractName(target),
      nodeName : target.tagName?.toLowerCase(),
      sessionId: SessionManager.instance?.getCurrentSession().id
    }
    logInspect('user',() => prettyActionUserFormat(SessionManager.instance?.getCurrentSession(),ua));
   //  window.dispatchEvent(new CustomEvent( DISPATCH ,{ detail : ua})); // DISPATCH
  }



