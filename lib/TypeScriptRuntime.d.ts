/**
 * BEWARE - this type is duplicated in TypeScriptCompilationContext
 * for use by code generation
 */
export type GenerationOptions = {
    now?: string;
    locale?: string;
    disableJavaScriptEvaluation?: boolean;
    childProcessJavaScriptEvaluation?: boolean;
    timeout?: number;
};
export declare function joinList(data: Array<string>, joinDef: any, options?: GenerationOptions): string;
export declare function peek($data: any[]): any;
export declare function peekProperty($data: any[], propertyName: string, allowUndefined?: boolean): any;
export declare function push($data: any[], item: any): number;
export declare function addChild($data: any[], item: any): void;
export declare function pop($data: any[]): any;
