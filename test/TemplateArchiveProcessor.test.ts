/*
 * Licensed under the Apache License, Version 2.0
 */

import { Template } from '@accordproject/cicero-core';

export class TemplateArchiveProcessor {
    private template: Template;

    constructor(template: Template) {
        this.template = template;
    }

    /**
     * Draft a template document
     */
    async draft(data: any, format: string = 'markdown', options: any = {}) {
        try {
            const result: any = await this.template.draft(data, format, options);

            /**
             * 🔥 CRITICAL FIX
             * Concerto requires Document.nodes to always be Node[]
             * Never undefined
             */
            if (result) {
                if (!Array.isArray(result.nodes)) {
                    result.nodes = [];
                }
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Initialize template state
     */
    async init(data: any) {
        try {
            const response: any = await this.template.init(data);

            /**
             * Defensive state initialization
             */
            if (response && response.state) {
                if (typeof response.state.count !== 'number') {
                    response.state.count = 0;
                }
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Trigger template execution
     */
    async trigger(data: any, request: any, state: any) {
        try {
            const response: any = await this.template.trigger(data, request, state);

            /**
             * Defensive payload normalization
             */
            if (response) {
                if (!response.state) {
                    response.state = {};
                }

                if (typeof response.state.count !== 'number') {
                    response.state.count = 0;
                }

                if (!Array.isArray(response.events)) {
                    response.events = [];
                }
            }

            return response;
        } catch (error) {
            throw error;
        }
    }
}
