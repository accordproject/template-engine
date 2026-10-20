import { ITemplateModel, IGreetingRequest, IGreetingResponse } from "./generated/org.example@0.0.1";

// stateless logic: defines only trigger and inherits the default init
// @ts-expect-error TemplateLogic is imported by the runtime
class GreetingLogic extends TemplateLogic<ITemplateModel> {
    async trigger(data: ITemplateModel, request: IGreetingRequest) {
        const result: IGreetingResponse = {
            $class: 'org.example@0.0.1.GreetingResponse',
            $timestamp: new Date().toISOString(),
            message: request.greeting + ' ' + data.name
        };
        return { result, events: [] };
    }
}

export default GreetingLogic;
