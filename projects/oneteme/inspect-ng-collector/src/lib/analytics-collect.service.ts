import {extractName} from "./trace.model";
import {SessionManager} from "./session-manager.service";
import {createReport, dateNow, DISPATCH} from "./util";
import {ContextManager} from "./context-manager";

  let  eventHandlers :  {[key:string]: (target: HTMLElement)=>boolean} = {
    'click' : (target:HTMLElement)=> lookUpChild(target,1),
  }
  export function analyticsEventsListener() {
    if (ContextManager.instance.techConfig.analytics) { // todo use document instead of body
        try {
          const body = window.document.body;
          body.addEventListener('click', globalHandler, true);
          body.addEventListener('change', (event) => globalHandler(event), true);
          body.addEventListener('scrollend', (event) => globalHandler(event), true);
          body.addEventListener('dragend', (event) => globalHandler(event), true);
          window.document.addEventListener('DOMContentLoaded', (event) => globalHandler(event), true);
        }
    catch (e) {
        window.dispatchEvent(new CustomEvent(DISPATCH, {detail: {traces: createReport("Error while subscribing to analytics user events: " + JSON.stringify(e))}}));
      }
    }
  }


  function globalHandler(event: Event | MouseEvent){
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
      '@type': "user-act",
      type: eventType,
      start: dateNow(),
      name : extractName(target),
      nodeName : target.tagName?.toLowerCase(),
      sessionId: SessionManager.instance?.getCurrentSession().id
    }
     //window.dispatchEvent(new CustomEvent( DISPATCH ,{ detail :  { traces:ua }})); // DISPATCH // todo remove this once type added to backend
  }



