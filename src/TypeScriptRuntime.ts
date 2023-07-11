/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const DEBUG = false;

// BEWARE adding imports to this file
// as it is used by the static code generator

/**
 * BEWARE - this type is duplicated in TypeScriptCompilationContext
 * for use by code generation
 */
export type GenerationOptions = {
    now?:string,
    locale?:string
}

export function joinList(data:Array<string>, joinDef:any, options?:GenerationOptions) : string {
    if(joinDef.separator) {
        return data.join(joinDef.separator);
    }
    else {
        const formatter = new Intl.ListFormat( joinDef.locale ? joinDef.locale : options?.locale,
            {
                style: (joinDef.style as Intl.ListFormatStyle),
                type: (joinDef.type as Intl.ListFormatType)
            }
        );
        return formatter.format(data);
    }
}

/**
 * These utility functions are used by the typescript code that
 * is generated from TemplateMark. They manage a stack to improve
 * debuggability.
 */

function dump(op:string, $data:any[]) {
    if(DEBUG) {
        console.log(`${op}: ${JSON.stringify($data)}`);
    }
}

export function peek($data:any[]) : any {
    if($data.length <= 0) {
        throw new Error('Empty array');
    }
    const result = $data[$data.length-1];
    dump('peek', $data);
    return result;
}

export function peekProperty($data:any[], propertyName:string, allowUndefined=false) : any {
    const head = peek($data);
    const result = head[propertyName];
    if(!allowUndefined && result === undefined) {
        throw new Error(`Undefined property ${propertyName}. Current stack is ${JSON.stringify($data)}`);
    }
    return result;
}

export function push($data:any[], item:any) : number {
    const result = $data.push(item);
    dump('push', $data);
    return result;
}

export function addChild($data:any[], item:any) {
    const node = peek($data);
    node.nodes ? node.nodes.push(item) : node.nodes = [item];
}

export function pop($data:any[]) : any {
    if($data.length <= 0) {
        throw new Error('Empty array');
    }
    const result = $data.pop();
    dump('pop', $data);
    return result;
}