
import {DISPATCH, RequestMask, WIN} from "./util";
import {SessionManager} from "./session-manager.service";


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
            WIN["inspect-session-manager"]?.updateMask(RequestMask.LOCAL);
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
            window.dispatchEvent(new CustomEvent(
              DISPATCH,
              { detail :
                  { traces : {
                    "@type":"locl-req",
                    id: crypto.randomUUID(),
                    name: propertyKey,
                    location: target.constructor.name,
                    user: WIN["inspect-session-manager"]?.currentSession?.user,
                    start: start,
                    end: end,
                    exception: exception,
                    sessionId : WIN["inspect-session-manager"]?.currentSession?.id
                    }
                  }
              }));
          }

        }
        return descriptor;
    }
  }
