import { ModelManager } from '@accordproject/concerto-core';
import { readFileSync } from 'fs';
import { TypeScriptToJavaScriptCompiler } from '../src/TypeScriptToJavaScriptCompiler';

const ARCHIVE_MODEL_DIR = 'test/archives/latedeliveryandpenalty-typescript/model';
const CONTRACT = readFileSync(`${ARCHIVE_MODEL_DIR}/@models.accordproject.org.accordproject.contract@0.2.0.cto`, 'utf-8');
const RUNTIME = readFileSync(`${ARCHIVE_MODEL_DIR}/@models.accordproject.org.accordproject.runtime@0.2.0.cto`, 'utf-8');

/*
 * These tests verify how the compilation context enforces the runtime model hierarchy.
 * Because Request/Response/State are concrete, the bare base type is allowed. The union
 * still rejects types that are structurally incompatible with the base - e.g. a plain
 * concept used as a Response, which lacks $timestamp. State carries only $identifier, so
 * a concept-shaped state is admitted here and enforced nominally at runtime instead (see
 * TemplateArchiveProcessor.assertRuntimeHierarchy).
 */

const NS = 'org.accordproject.helloworldstate@0.1.0';

const MODEL_HEADER = `namespace ${NS}
import org.accordproject.contract@0.2.0.Clause from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,Response,State} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto
transaction MyRequest extends Request { o String input }
transaction MyResponse extends Response { o String output }
@template
asset TemplateModel extends Clause { o String name }
`;

// A plain concept masquerading as a state - this is the invalid definition.
const INVALID_STATE = `${MODEL_HEADER}concept HelloWorldState identified { o Double counter }`;

// A valid state that extends the runtime State asset.
const VALID_STATE = `${MODEL_HEADER}asset HelloWorldState extends State { o Double counter }`;

// A valid state alongside a plain (non-Obligation) event. Emitting plain events must
// remain backward compatible - the events array is typed as the broad IEvent.
const VALID_STATE_WITH_EVENT = `${MODEL_HEADER}asset HelloWorldState extends State { o Double counter }
event MyPlainEvent { o String note }`;

// Clean logic (no @ts-ignore / @ts-expect-error suppressions) that uses the
// declared state type as the TemplateLogic state parameter.
const LOGIC = `import { ITemplateModel, IMyRequest, IHelloWorldState } from './generated/${NS}';
class HelloWorldStateLogic extends TemplateLogic<ITemplateModel, IHelloWorldState> {
    async init(data: ITemplateModel): Promise<InitResponse<IHelloWorldState>> {
        return {
            state: { $class: '${NS}.HelloWorldState', $identifier: data.$identifier, counter: 0 },
        };
    }
    async trigger(data: ITemplateModel, request: IMyRequest, state: IHelloWorldState): Promise<TriggerResponse<IHelloWorldState>> {
        return {
            result: { $class: '${NS}.MyResponse', $timestamp: new Date() } as unknown as IResponse,
            state: { $class: '${NS}.HelloWorldState', $identifier: state.$identifier, counter: state.counter + 1 },
            events: [],
        };
    }
}
export default HelloWorldStateLogic;`;

/**
 * Compiles the logic against a model and returns the TypeScript
 * "does not satisfy the constraint" (TS2344) errors.
 */
async function constraintErrors(model: string) {
    const modelManager = new ModelManager();
    modelManager.addCTOModel(CONTRACT, 'contract.cto');
    modelManager.addCTOModel(RUNTIME, 'runtime.cto');
    modelManager.addCTOModel(model, 'model.cto');
    const compiler = new TypeScriptToJavaScriptCompiler(modelManager, `${NS}.TemplateModel`);
    await compiler.initialize();
    const result = compiler.compile(LOGIC);
    return (result.errors || []).filter(e => e.category === 1 && e.code === 2344);
}

describe('runtime State hierarchy enforcement', () => {
    test('accepts a state that extends the runtime State asset', async () => {
        const errors = await constraintErrors(VALID_STATE);
        expect(errors).toHaveLength(0);
    });

    test('a plain-concept state now type-checks (bare base is allowed; the hierarchy is enforced at runtime instead)', async () => {
        // The State base is concrete, so the RuntimeState union is no longer `never` - it
        // includes the base. Because State carries only $identifier, an identified concept
        // is structurally assignable to it, so a plain-concept state can no longer be
        // rejected at compile time (that is the cost of allowing the bare base); it is
        // caught nominally at runtime by TemplateArchiveProcessor.assertRuntimeHierarchy.
        // (Before this change the same input produced a TS2344 `never`-constraint error.)
        const errors = await constraintErrors(INVALID_STATE);
        expect(errors).toHaveLength(0);
    });

    test('remains backward compatible with templates that emit plain (non-Obligation) events', async () => {
        const modelManager = new ModelManager();
        modelManager.addCTOModel(CONTRACT, 'contract.cto');
        modelManager.addCTOModel(RUNTIME, 'runtime.cto');
        modelManager.addCTOModel(VALID_STATE_WITH_EVENT, 'model.cto');
        const compiler = new TypeScriptToJavaScriptCompiler(modelManager, `${NS}.TemplateModel`);
        await compiler.initialize();
        const eventLogic = `import { ITemplateModel, IMyRequest, IMyResponse, IHelloWorldState, IMyPlainEvent } from './generated/${NS}';
class HelloWorldStateLogic extends TemplateLogic<ITemplateModel, IHelloWorldState> {
    async init(data: ITemplateModel): Promise<InitResponse<IHelloWorldState>> {
        return { state: { $class: '${NS}.HelloWorldState', $identifier: data.$identifier, counter: 0 } };
    }
    async trigger(data: ITemplateModel, request: IMyRequest, state: IHelloWorldState): Promise<TriggerResponse<IHelloWorldState>> {
        const event: IMyPlainEvent = { $class: '${NS}.MyPlainEvent', $timestamp: new Date(), note: 'n' } as unknown as IMyPlainEvent;
        const result: IMyResponse = { $class: '${NS}.MyResponse', $timestamp: new Date(), output: 'o' } as unknown as IMyResponse;
        return {
            result,
            state: { $class: '${NS}.HelloWorldState', $identifier: state.$identifier, counter: state.counter + 1 },
            events: [event],
        };
    }
}
export default HelloWorldStateLogic;`;
        const errors = (compiler.compile(eventLogic).errors || []).filter(e => e.category === 1);
        expect(errors).toHaveLength(0);
    });

    // Compiles a bespoke model + logic and returns all category-1 (error) diagnostics.
    async function compileModel(model: string, logic: string) {
        const modelManager = new ModelManager();
        modelManager.addCTOModel(CONTRACT, 'contract.cto');
        modelManager.addCTOModel(RUNTIME, 'runtime.cto');
        modelManager.addCTOModel(model, 'model.cto');
        const compiler = new TypeScriptToJavaScriptCompiler(modelManager, `${NS}.TemplateModel`);
        await compiler.initialize();
        return (compiler.compile(logic).errors || []).filter(e => e.category === 1);
    }

    test('rejects a response that does not extend the runtime Response', async () => {
        // MyResponse is a plain concept rather than a transaction extending Response.
        const model = `namespace ${NS}
import org.accordproject.contract@0.2.0.Clause from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,State} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto
transaction MyRequest extends Request { o String input }
concept MyResponse identified { o String output }
@template
asset TemplateModel extends Clause { o String name }
asset MyState extends State { o Double counter }`;
        const logic = `import { ITemplateModel, IMyRequest, IMyResponse, IMyState } from './generated/${NS}';
class L extends TemplateLogic<ITemplateModel, IMyState> {
    async init(data: ITemplateModel): Promise<InitResponse<IMyState>> {
        return { state: { $class: '${NS}.MyState', $identifier: data.$identifier, counter: 0 } };
    }
    async trigger(data: ITemplateModel, request: IMyRequest, state: IMyState): Promise<TriggerResponse<IMyState>> {
        const result: IMyResponse = { $class: '${NS}.MyResponse', $identifier: 'x', output: 'o' } as unknown as IMyResponse;
        return { result, state, events: [] };
    }
}
export default L;`;
        const errors = await compileModel(model, logic);
        // A plain concept lacks $timestamp, so it is not assignable to the (now base-inclusive)
        // Response union - rejected at compile time in this return position because the
        // required transaction discriminant $timestamp is missing.
        expect(errors.length).toBeGreaterThan(0);
        expect(errors.some(e => /\$timestamp/.test(e.renderedMessage))).toBe(true);
    });

    test('rejects an emitted event that does not extend the base Event', async () => {
        // MyEvent is a plain concept rather than an event.
        const model = `namespace ${NS}
import org.accordproject.contract@0.2.0.Clause from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,Response,State} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto
transaction MyRequest extends Request { o String input }
transaction MyResponse extends Response { o String output }
concept MyEvent identified { o String note }
@template
asset TemplateModel extends Clause { o String name }
asset MyState extends State { o Double counter }`;
        const logic = `import { ITemplateModel, IMyRequest, IMyResponse, IMyState, IMyEvent } from './generated/${NS}';
class L extends TemplateLogic<ITemplateModel, IMyState> {
    async init(data: ITemplateModel): Promise<InitResponse<IMyState>> {
        return { state: { $class: '${NS}.MyState', $identifier: data.$identifier, counter: 0 } };
    }
    async trigger(data: ITemplateModel, request: IMyRequest, state: IMyState): Promise<TriggerResponse<IMyState>> {
        const result: IMyResponse = { $class: '${NS}.MyResponse', $timestamp: new Date(), output: 'o' } as unknown as IMyResponse;
        const event: IMyEvent = { $class: '${NS}.MyEvent', $identifier: 'x', note: 'n' } as unknown as IMyEvent;
        return { result, state, events: [event] };
    }
}
export default L;`;
        const errors = await compileModel(model, logic);
        expect(errors.some(e => e.code === 2322 && /is not assignable to type 'never'/.test(e.renderedMessage))).toBe(true);
    });
});
