import { Template } from '@accordproject/cicero-core';
import { TemplateMarkInterpreter } from './TemplateMarkInterpreter';
import { TemplateMarkTransformer } from '@accordproject/markdown-template';
import { transform } from '@accordproject/markdown-transform';
import { TypeScriptToJavaScriptCompiler } from './TypeScriptToJavaScriptCompiler';
import type Script from '@accordproject/cicero-core/types/src/script';
import type { TwoSlashReturn } from '@typescript/twoslash';
import { JavaScriptEvaluator } from './JavaScriptEvaluator';
import { SMART_LEGAL_CONTRACT_BASE64 } from './runtime/declarations';

export type State = Record<string, unknown>;
export type Response = Record<string, unknown>;
export type Event = Record<string, unknown>;

export interface TriggerResponse {
    result: Response;
    state: State;
    events: Event[];
}

export interface InitResponse {
    state: State;
}

export interface CompileOptions {
    compiledTemplate?: Record<string, TwoSlashReturn>;
    currentTime?: string;
    utcOffset?: number;
}

export interface DraftOptions {
    currentTime?: string;
    [key: string]: unknown;
}

interface TemplateData {
    [key: string]: unknown;
}

interface TemplateRequest {
    [key: string]: unknown;
}

/**
 * A template archive processor with compilation caching
 */
export class TemplateArchiveProcessor {
    private template: Template;
    private static compilationCache = new Map<string, Record<string, TwoSlashReturn>>();
    private compilationCacheKey: string;
    private isInitialized = false;

    constructor(template: Template) {
        this.template = template;
        this.compilationCacheKey = this.generateCompilationCacheKey();
    }

    private generateCompilationCacheKey(): string {
        const metadata = this.template.getMetadata();
        const identifier = this.template.getIdentifier();
        const version = metadata.getVersion();
        
        const logicManager = this.template.getLogicManager();
        const scripts = logicManager.getScriptManager().getScriptsForTarget('typescript');
        const scriptContents = scripts.map((script: Script) => script.getContents()).join('');
        
        return `${identifier}@${version}:${Buffer.from(scriptContents).toString('base64').substring(0, 32)}`;
    }

    private async compileTemplate(): Promise<Record<string, TwoSlashReturn>> {
        if (TemplateArchiveProcessor.compilationCache.has(this.compilationCacheKey)) {
            return TemplateArchiveProcessor.compilationCache.get(this.compilationCacheKey)!;
        }

        const logicManager = this.template.getLogicManager();
        if (logicManager.getLanguage() !== 'typescript') {
            throw new Error('Only TypeScript is supported at this time');
        }

        const compiledCode: Record<string, TwoSlashReturn> = {};
        const tsFiles: Script[] = logicManager.getScriptManager().getScriptsForTarget('typescript');
        
        const compiler = new TypeScriptToJavaScriptCompiler(
            this.template.getModelManager(),
            this.template.getTemplateModel().getFullyQualifiedName()
        );
        
        await compiler.initialize();
        const runtimeDefinitions = Buffer.from(SMART_LEGAL_CONTRACT_BASE64, 'base64').toString();

        for (const tsFile of tsFiles) {
            const code = `${runtimeDefinitions}\n${tsFile.getContents()}`;
            const result = compiler.compile(code);
            compiledCode[tsFile.getIdentifier()] = result;
        }

        TemplateArchiveProcessor.compilationCache.set(this.compilationCacheKey, compiledCode);
        return compiledCode;
    }

    private async executeLogic(
        functionName: 'init' | 'trigger',
        data: TemplateData,
        request?: TemplateRequest,
        state?: State,
        currentTime?: string,
        utcOffset?: number
    ): Promise<InitResponse | TriggerResponse> {
        const compiledCode = await this.compileTemplate();
        const mainLogic = compiledCode['logic/logic.ts'];
        
        if (!mainLogic) {
            throw new Error('Main logic file not found');
        }

        const evaluator = new JavaScriptEvaluator();
        
        const args = functionName === 'init' 
            ? [data, currentTime, utcOffset]
            : [data, request, state, currentTime, utcOffset];
        
        const argNames = functionName === 'init' 
            ? ['data', 'currentTime', 'utcOffset']
            : ['data', 'request', 'state', 'currentTime', 'utcOffset'];

        const evalResponse = await evaluator.evalDangerously({
            templateLogic: true,
            verbose: false,
            functionName,
            code: mainLogic.code,
            argumentNames: argNames,
            arguments: args
        });

        if (evalResponse.result) {
            return evalResponse.result as InitResponse | TriggerResponse;
        } else {
            throw new Error(`${functionName.charAt(0).toUpperCase() + functionName.slice(1)} failed: ${evalResponse.message || 'Unknown error'}`);
        }
    }

    async draft(
        data: TemplateData, 
        format: string, 
        options: DraftOptions = {}, 
        currentTime?: string
    ): Promise<string> {
        const metadata = this.template.getMetadata();
        const templateKind = metadata.getTemplateType() !== 0 ? 'clause' : 'contract';

        const modelManager = this.template.getModelManager();
        const engine = new TemplateMarkInterpreter(modelManager, {});
        const templateMarkTransformer = new TemplateMarkTransformer();
        
        const templateMarkDom = templateMarkTransformer.fromMarkdownTemplate(
            { content: this.template.getTemplate() }, 
            modelManager, 
            templateKind, 
            { options: options as any }
        );
        
        const now = currentTime || new Date().toISOString();
        const ciceroMark = await engine.generate(templateMarkDom, data, { now });
        
        return transform(
            ciceroMark.toJSON(), 
            'ciceromark', 
            ['ciceromark_unquoted', format], 
            null, 
            options
        );
    }

    async init(
        data: TemplateData, 
        currentTime?: string, 
        utcOffset?: number,
        options: CompileOptions = {}
    ): Promise<InitResponse> {
        if (options.compiledTemplate) {
            TemplateArchiveProcessor.compilationCache.set(this.compilationCacheKey, options.compiledTemplate);
        }
        
        const result = await this.executeLogic('init', data, undefined, undefined, currentTime, utcOffset);
        return result as InitResponse;
    }

    async trigger(
        data: TemplateData, 
        request: TemplateRequest, 
        state?: State, 
        currentTime?: string, 
        utcOffset?: number,
        options: CompileOptions = {}
    ): Promise<TriggerResponse> {
        if (options.compiledTemplate) {
            TemplateArchiveProcessor.compilationCache.set(this.compilationCacheKey, options.compiledTemplate);
        }
        
        const result = await this.executeLogic('trigger', data, request, state, currentTime, utcOffset);
        return result as TriggerResponse;
    }

    async compile(): Promise<Record<string, TwoSlashReturn>> {
        return this.compileTemplate();
    }

    getCachedCompilation(): Record<string, TwoSlashReturn> | undefined {
        return TemplateArchiveProcessor.compilationCache.get(this.compilationCacheKey);
    }

    clearCache(): void {
        TemplateArchiveProcessor.compilationCache.delete(this.compilationCacheKey);
    }

    static clearAllCaches(): void {
        TemplateArchiveProcessor.compilationCache.clear();
    }
}