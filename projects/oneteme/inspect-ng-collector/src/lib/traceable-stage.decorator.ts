
import {DISPATCH, RequestMask, WIN} from "./util";
import {MainSessionCallBack} from "./trace.model";
  export function TraceableStage(){
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]){
            let exception;
            let start,end;

          start = Date.now();
          try{
            return originalMethod.apply(this,args);
          }catch(e:any){
              let type=null,message=null;
              if(e){
                if(typeof e === "string"){
                  message = e;
                }else if(e instanceof Error){
                  type = e.name;
                  message = e.message;
                }else{
                  message = JSON.stringify(e)
                }
              }
              exception = {
                type : type,
                message : message
              }
            throw e;
          }finally{
            end = Date.now();
            let id = crypto.randomUUID();
            if(WIN["inspect-session-manager"]?.currentSessionID() != null){ //TODO DUAL EVENT TRACE !!??
              let doUpdateMask = WIN["inspect-session-manager"]?.updateMask(RequestMask.LOCAL); //TODO use .createRequest 
              doUpdateMask &&  window.dispatchEvent(new CustomEvent( DISPATCH, { detail :  {
                  traces : {
                    "@type":"03",
                    id : WIN["inspect-session-manager"]?.currentSessionID(),
                    main: true,
                    mask: WIN["inspect-session-manager"]?.getCurrentSessionCallBack((s:MainSessionCallBack) =>  s.requestMask)
                  } }
              }));
            }
            window.dispatchEvent(new CustomEvent(
              DISPATCH,
              { detail :
                  { traces : {
                    "@type":"110",
                    id: id,
                    name: propertyKey,
                    location: target.constructor.name,
                    user: WIN["inspect-session-manager"]?.currentSession?.user,
                    start: start,
                    sessionId : WIN["inspect-session-manager"]?.currentSession?.id
                    }
                  }
              }));
            window.dispatchEvent(new CustomEvent(
              DISPATCH,
              { detail :
                  { traces : {
                      "@type":"111",
                      id: id,
                      exception: exception,
                      end : end
                    }
                  }
              }));
          }

        }
        return descriptor;
    }
  }
