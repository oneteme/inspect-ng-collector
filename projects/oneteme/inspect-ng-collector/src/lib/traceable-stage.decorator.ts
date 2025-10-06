import { SessionManager } from "./session-manager.service";
import { DISPATCH} from "./util";


  export function TraceableStage(){
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]){
          if(SessionManager){
            let session = SessionManager.instance?.getCurrentSession();
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
              window.dispatchEvent(new CustomEvent(
                DISPATCH,
                { detail :
                    { traces : {
                      "@type":"locl-req",
                      id: crypto.randomUUID(),
                      name: propertyKey,
                      location: target.constructor.name,
                      user: session.user,
                      start: start,
                      end: end,
                      exception: exception,
                      sessionId : SessionManager.instance.currentSessionID()
                      }
                    }
                }));
            }
          }
        }
        return descriptor;
    }
  }
