import { TemplateLogic, TriggerResponse } from '@accordproject/template-engine';
import type {
    InitResponse,
} from '@accordproject/template-engine';
import { ITemplateModel, IGreetingRequest, IGreetingResponse } from "./generated/org.example@0.0.1";

// a top-level helper, also called from a formula in the grammar
function shout(text: string): string {
    return text.toUpperCase();
}

// written against the engine package's exports, with no @ts-expect-error
class GreetingLogic extends TemplateLogic<ITemplateModel> {
    async init(data: ITemplateModel): Promise<InitResponse> {
        return { state: { $class: 'org.accordproject.runtime@0.2.0.State', $identifier: data.$identifier } };
    }

    async trigger(data: ITemplateModel, request: IGreetingRequest): Promise<TriggerResponse> {
        const result: IGreetingResponse = {
            $class: 'org.example@0.0.1.GreetingResponse',
            $timestamp: new Date().toISOString(),
            message: shout(request.greeting + ' ' + data.name)
        };
        return { result, events: [] };
    }
}

export default GreetingLogic;
