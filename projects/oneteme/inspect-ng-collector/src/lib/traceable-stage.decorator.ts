import { SessionManager } from "./session-manager.service";


export function TraceableStage(){
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args: any[]){
          if(SessionManager.instance){
            let session = SessionManager.instance.getCurrentSession();
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
              SessionManager.instance.getCurrentSession().localRequests.push({
                  name: propertyKey,
                  location: target.constructor.name,
                  user: session.user,
                  start: start, 
                  end: end,
                  exception: exception
              })
            }
          }
        }
        return descriptor;
    }
  }