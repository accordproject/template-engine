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

import { Factory, ModelManager, Serializer } from '@accordproject/concerto-core';
import { TriggerResponse, InitResponse } from '../TemplateArchiveProcessor';

/**
 * Parses and validates LLM text output into typed TriggerResponse / InitResponse objects.
 * Validates all JSON objects against the Concerto data model using the project's Serializer.
 */
export class ResponseParser {

    /**
     * Extract JSON from LLM response text.
     * Handles raw JSON, markdown-fenced JSON (```json ... ```), and
     * responses with surrounding text.
     *
     * @param {string} raw - raw text output from the LLM
     * @returns {any} parsed JSON object
     * @throws {Error} if no valid JSON can be extracted
     */
    static extractJSON(raw: string): any {
        const trimmed = raw.trim();

        // Try direct parse first
        try {
            return JSON.parse(trimmed);
        } catch {
            // Continue to other strategies
        }

        // Try to extract from markdown code fences: ```json ... ``` or ``` ... ```
        const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
        if (fenceMatch) {
            try {
                return JSON.parse(fenceMatch[1].trim());
            } catch {
                // Continue
            }
        }

        // Try to find the first { ... } block
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                return JSON.parse(trimmed.substring(firstBrace, lastBrace + 1));
            } catch {
                // Continue
            }
        }

        throw new Error(`Failed to extract valid JSON from LLM response: ${trimmed.substring(0, 200)}...`);
    }

    /**
     * Validate a JSON object against the Concerto model.
     * Uses Serializer.fromJSON() to check the object conforms to the declared $class.
     *
     * @param {any} obj - the JSON object to validate
     * @param {ModelManager} modelManager - the model manager with type definitions
     * @returns {any} the validated object (with Concerto resource identity)
     * @throws {Error} if validation fails
     */
    static validateConcertoObject(obj: any, modelManager: ModelManager): any {
        if (!obj || typeof obj !== 'object') {
            throw new Error('Expected a JSON object for Concerto validation.');
        }
        if (!obj.$class) {
            throw new Error(`JSON object is missing required "$class" field: ${JSON.stringify(obj).substring(0, 200)}`);
        }

        try {
            const factory = new Factory(modelManager);
            const serializer = new Serializer(factory, modelManager);
            return serializer.fromJSON(obj);
        } catch (err: any) {
            throw new Error(`Concerto validation failed for type '${obj.$class}': ${err.message}`);
        }
    }

    /**
     * Parse and validate an LLM response as a TriggerResponse.
     *
     * @param {string} raw - raw text output from the LLM
     * @param {ModelManager} modelManager - the model manager with type definitions
     * @returns {TriggerResponse} validated trigger response
     * @throws {Error} if parsing or validation fails
     */
    static parseTriggerResponse(raw: string, modelManager: ModelManager): TriggerResponse {
        const json = ResponseParser.extractJSON(raw);

        // Validate structure
        if (!json.result) {
            throw new Error('LLM response is missing required "result" field.');
        }
        if (!json.state) {
            throw new Error('LLM response is missing required "state" field.');
        }
        if (!Array.isArray(json.events)) {
            // If events is missing, default to empty array
            json.events = json.events ? [json.events] : [];
        }

        // Validate each object against the Concerto model
        const errors: string[] = [];

        // Validate result
        try {
            ResponseParser.validateConcertoObject(json.result, modelManager);
        } catch (err: any) {
            errors.push(`result: ${err.message}`);
        }

        // Validate state
        try {
            ResponseParser.validateConcertoObject(json.state, modelManager);
        } catch (err: any) {
            errors.push(`state: ${err.message}`);
        }

        // Validate events
        for (let i = 0; i < json.events.length; i++) {
            try {
                ResponseParser.validateConcertoObject(json.events[i], modelManager);
            } catch (err: any) {
                errors.push(`events[${i}]: ${err.message}`);
            }
        }

        if (errors.length > 0) {
            throw new Error(`LLM response validation errors:\n${errors.join('\n')}`);
        }

        return {
            result: json.result,
            state: json.state,
            events: json.events,
        };
    }

    /**
     * Parse and validate an LLM response as an InitResponse.
     *
     * @param {string} raw - raw text output from the LLM
     * @param {ModelManager} modelManager - the model manager with type definitions
     * @returns {InitResponse} validated init response
     * @throws {Error} if parsing or validation fails
     */
    static parseInitResponse(raw: string, modelManager: ModelManager): InitResponse {
        const json = ResponseParser.extractJSON(raw);

        if (!json.state) {
            throw new Error('LLM response is missing required "state" field.');
        }

        // Validate state against the Concerto model
        try {
            ResponseParser.validateConcertoObject(json.state, modelManager);
        } catch (err: any) {
            throw new Error(`Init response state validation failed: ${err.message}`);
        }

        return {
            state: json.state,
        };
    }
}
