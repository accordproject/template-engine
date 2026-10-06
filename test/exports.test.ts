import { TemplateLogic } from '../src/index';

describe('package exports', () => {
    it('should export TemplateLogic as a runtime value', () => {
        expect(TemplateLogic).toBeDefined();
        expect(typeof TemplateLogic).toBe('function');
    });
});
