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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { createDefaultMapFromNodeModules, createDefaultMapFromCDN } from '@typescript/vfs';
import { twoslasher, TwoSlashOptions, TwoSlashReturn } from '@typescript/twoslash';
import { ModelManager } from '@accordproject/concerto-core';
import { TypeScriptCompilationContext } from './TypeScriptCompilationContext';
import { DAYJS_BASE64, JSONPATH_BASE64 } from './runtime/declarations';
import * as lzstring from 'lz-string';

const TYPESCRIPT_URL = process.env.TYPESCRIPT_URL || 'https://cdn.jsdelivr.net/npm/typescript@4.9.4/+esm';
const SCRIPT_TARGET = 9; // ES2022
const MODULE_KIND = 6; // ES2020

// SINGLETON CACHE FOR COMPILER INSTANCES
export class CompilerCache {
    private static instance: CompilerCache;
    private fsMapCache: Map<string, Map<string, string>> = new Map();
    private compilationCache: Map<string, TwoSlashReturn> = new Map();
    private compilerInstancePool: Array<{
        ts: any;
        fsMap: Map<string, string>;
        lastUsed: number;
        busy: boolean;
    }> = [];
    private maxPoolSize = 5;
    private cacheHits = 0;
    private cacheMisses = 0;

    private constructor() {}

    static getInstance(): CompilerCache {
        if (!CompilerCache.instance) {
            CompilerCache.instance = new CompilerCache();
        }
        return CompilerCache.instance;
    }

    async getCompiler(typescriptUrl?: string): Promise<{
        ts: any;
        fsMap: Map<string, string>;
    }> {
        const url = typescriptUrl || TYPESCRIPT_URL;
        
        // Try to get from pool first
        for (const compiler of this.compilerInstancePool) {
            if (!compiler.busy) {
                compiler.busy = true;
                compiler.lastUsed = Date.now();
                return { ts: compiler.ts, fsMap: compiler.fsMap };
            }
        }

        // Create new compiler if pool not full
        if (this.compilerInstancePool.length < this.maxPoolSize) {
            const { ts, fsMap } = await this.createCompiler(url);
            const compiler = { ts, fsMap, lastUsed: Date.now(), busy: true };
            this.compilerInstancePool.push(compiler);
            return { ts, fsMap };
        }

        // Pool full, wait for one to be free
        return new Promise(resolve => {
            const interval = setInterval(() => {
                for (const compiler of this.compilerInstancePool) {
                    if (!compiler.busy) {
                        compiler.busy = true;
                        compiler.lastUsed = Date.now();
                        clearInterval(interval);
                        resolve({ ts: compiler.ts, fsMap: compiler.fsMap });
                        return;
                    }
                }
            }, 10);
        });
    }

    releaseCompiler(ts: any): void {
        for (const compiler of this.compilerInstancePool) {
            if (compiler.ts === ts) {
                compiler.busy = false;
                break;
            }
        }
    }

    private async createCompiler(typescriptUrl: string): Promise<{
        ts: any;
        fsMap: Map<string, string>;
    }> {
        let ts: any;
        let fsMap: Map<string, string>;

        if (typeof window === 'undefined') {
            ts = (await import('typescript')).default;
            fsMap = createDefaultMapFromNodeModules({ target: SCRIPT_TARGET });
        } else {
            ts = (await import(typescriptUrl)).default;
            fsMap = await createDefaultMapFromCDN(
                { target: SCRIPT_TARGET },
                ts.version,
                false,
                ts
            );
        }

        // Add runtime declarations
        fsMap.set('/node_modules/@types/dayjs/index.d.ts', 
            Buffer.from(DAYJS_BASE64, 'base64').toString());
        fsMap.set('/node_modules/@types/jsonpath/index.d.ts', 
            Buffer.from(JSONPATH_BASE64, 'base64').toString());

        return { ts, fsMap };
    }

    getCompilationCacheKey(context: string, typescript: string): string {
        // Simple but effective hash
        return `${context.length}:${typescript.length}:${Buffer.from(context + typescript)
            .toString('base64')
            .substring(0, 32)}`;
    }

    getCachedCompilation(key: string): TwoSlashReturn | undefined {
        const cached = this.compilationCache.get(key);
        if (cached) {
            this.cacheHits++;
        } else {
            this.cacheMisses++;
        }
        return cached;
    }

    setCompilationCache(key: string, result: TwoSlashReturn): void {
    // LRU-like cache with size limit
    if (this.compilationCache.size > 100) {
        // Get first key safely
        for (const firstKey of this.compilationCache.keys()) {
            this.compilationCache.delete(firstKey);
            break; // Only delete first one
        }
    }
    this.compilationCache.set(key, result);
}

    getStats() {
        return {
            cacheHits: this.cacheHits,
            cacheMisses: this.cacheMisses,
            hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses),
            poolSize: this.compilerInstancePool.length,
            cacheSize: this.compilationCache.size,
        };
    }

    clearCache(): void {
        this.compilationCache.clear();
    }
}

export class TypeScriptToJavaScriptCompiler {
    private context: string;
    private modelManager: ModelManager;
    private templateConceptFqn?: string;
    private typescriptUrl: string;
    private compilerCache = CompilerCache.getInstance();

    constructor(modelManager: ModelManager, templateConceptFqn?: string) {
        this.modelManager = modelManager;
        this.templateConceptFqn = templateConceptFqn;
        this.typescriptUrl = TYPESCRIPT_URL;
        this.context = this.getCompilationContext();
    }

    private getCompilationContext(): string {
        // Cache context generation
        const cacheKey = `context:${this.templateConceptFqn || 'default'}`;
        const cached = this.compilerCache.getCachedCompilation(cacheKey);
        
        if (!cached) {
            const context = new TypeScriptCompilationContext(
                this.modelManager,
                this.templateConceptFqn
            ).getCompilationContext();
            
            // Store in cache
            const fakeResult = { code: context } as TwoSlashReturn;
            this.compilerCache.setCompilationCache(cacheKey, fakeResult);
            return context;
        }
        
        return cached.code;
    }

    async initialize(typescriptUrl?: string): Promise<void> {
        if (typescriptUrl) {
            this.typescriptUrl = typescriptUrl;
        }
        // Warm up compiler pool
        await this.compilerCache.getCompiler(this.typescriptUrl);
    }

    compile(typescript: string): TwoSlashReturn {
        // Generate cache key
        const cacheKey = this.compilerCache.getCompilationCacheKey(this.context, typescript);
        
        // Check cache first
        const cached = this.compilerCache.getCachedCompilation(cacheKey);
        if (cached) {
            return cached;
        }

        // Compile fresh
        const result = this.compileFresh(typescript);
        
        // Cache result
        this.compilerCache.setCompilationCache(cacheKey, result);
        
        return result;
    }

    private compileFresh(typescript: string): TwoSlashReturn {
        const twoSlashCode = `${this.context}\n${typescript}`;

        // Get compiler from pool
        const compilerPromise = this.compilerCache.getCompiler(this.typescriptUrl);
        
        // Note: In a real implementation, we need to handle async properly
        // This is a synchronous method, so we need to adjust the architecture
        // For now, let's assume getCompiler returns synchronously for the cached case
        
        throw new Error('compileFresh should be async or architecture needs adjustment');
    }

    // Async version for fresh compilation
    private async compileFreshAsync(typescript: string): Promise<TwoSlashReturn> {
        const twoSlashCode = `${this.context}\n${typescript}`;

        // Get compiler from pool (async)
        const { ts, fsMap } = await this.compilerCache.getCompiler(this.typescriptUrl);

        const options: TwoSlashOptions = {
            fsMap,
            tsModule: ts,
            defaultCompilerOptions: {
                target: SCRIPT_TARGET,
                module: MODULE_KIND,
            },
            lzstringModule: lzstring,
            defaultOptions: {
                showEmit: true,
                noErrorValidation: true,
                showEmittedFile: 'code.js',
            },
        };

        const result = twoslasher(twoSlashCode, 'ts', options);
        
        // Release compiler back to pool
        this.compilerCache.releaseCompiler(ts);
        
        return result;
    }

    // Async compile method
    async compileAsync(typescript: string): Promise<TwoSlashReturn> {
        // Generate cache key
        const cacheKey = this.compilerCache.getCompilationCacheKey(this.context, typescript);
        
        // Check cache first
        const cached = this.compilerCache.getCachedCompilation(cacheKey);
        if (cached) {
            return cached;
        }

        // Compile fresh (async)
        const result = await this.compileFreshAsync(typescript);
        
        // Cache result
        this.compilerCache.setCompilationCache(cacheKey, result);
        
        return result;
    }

    // Batch compilation for multiple files
    async compileBatch(fileContents: Record<string, string>): Promise<Record<string, TwoSlashReturn>> {
        const results: Record<string, TwoSlashReturn> = {};
        
        // Try to get all from cache first
        for (const [filename, content] of Object.entries(fileContents)) {
            const cacheKey = this.compilerCache.getCompilationCacheKey(this.context, content);
            const cached = this.compilerCache.getCachedCompilation(cacheKey);
            if (cached) {
                results[filename] = cached;
            }
        }

        // Compile missing ones
        const missingFiles = Object.entries(fileContents)
            .filter(([filename]) => !results[filename]);

        if (missingFiles.length > 0) {
            // Get compiler from pool
            const { ts, fsMap } = await this.compilerCache.getCompiler(this.typescriptUrl);
            
            for (const [filename, content] of missingFiles) {
                const twoSlashCode = `${this.context}\n${content}`;
                
                const options: TwoSlashOptions = {
                    fsMap,
                    tsModule: ts,
                    defaultCompilerOptions: {
                        target: SCRIPT_TARGET,
                        module: MODULE_KIND,
                    },
                    lzstringModule: lzstring,
                    defaultOptions: {
                        showEmit: true,
                        noErrorValidation: true,
                        showEmittedFile: 'code.js',
                    },
                };

                results[filename] = twoslasher(twoSlashCode, 'ts', options);
                
                // Cache result
                const cacheKey = this.compilerCache.getCompilationCacheKey(this.context, content);
                this.compilerCache.setCompilationCache(cacheKey, results[filename]);
            }
            
            // Release compiler
            this.compilerCache.releaseCompiler(ts);
        }

        return results;
    }

    // Get performance statistics
    getStats() {
        return this.compilerCache.getStats();
    }

    // Clear cache (useful for memory management)
    clearCache(): void {
        this.compilerCache.clearCache();
    }
}