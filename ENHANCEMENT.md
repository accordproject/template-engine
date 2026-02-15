# Template Validation & Error Handling System

This enhancement adds a comprehensive validation, error handling, and debugging system to the Accord Project Template Engine.

## Overview

The enhancement consists of three main components:

1. **ValidationEngine** - Validates templates before processing
2. **ErrorHandler** - Provides detailed, actionable error messages
3. **DebugLogger** - Enables tracing and debugging of template execution

## Features

### 1. ValidationEngine

Validates templates for common issues and provides detailed reports.

**Key Features:**
- ✅ Validates template structure and format
- ✅ Checks variable references against the data model
- ✅ Validates conditional expressions
- ✅ Validates formula expressions
- ✅ Checks data type consistency
- ✅ Generates human-readable validation reports

**Usage Example:**

```typescript
import { ValidationEngine } from '@accordproject/template-engine';
import { ModelManager } from '@accordproject/concerto-core';

const modelManager = new ModelManager();
const templateDom = {
    $class: 'org.accordproject.templatemark@0.5.0.ClauseDefinition',
    // ... template content
};

const engine = new ValidationEngine(templateDom, modelManager, templateClass);
const result = engine.validate();

if (!result.isValid) {
    console.error('Validation failed:');
    console.error(engine.getReport(result));
} else {
    console.log('✓ Template is valid');
}
```

**Validation Categories:**

- **Template Structure** - Validates the root template format
- **Variables** - Checks variable definitions against data model
- **Conditionals** - Validates condition expressions
- **Formulas** - Checks formula syntax and content
- **Data Types** - Ensures type consistency

### 2. ErrorHandler

Provides enhanced, contextual error messages with recovery suggestions.

**Key Features:**
- ✅ Detailed error messages with context
- ✅ Error code classification
- ✅ Recovery suggestions
- ✅ Error wrapping and chaining
- ✅ JSON serialization for logging

**Usage Example:**

```typescript
import { ErrorHandler, TemplateEngineError } from '@accordproject/template-engine';

try {
    // Template processing
} catch (error) {
    const engineError = ErrorHandler.wrapError(error, { 
        templateName: 'myTemplate',
        dataId: '12345'
    });
    
    console.error(engineError.getDetailedMessage());
    
    if (ErrorHandler.isRecoverable(engineError)) {
        const suggestion = ErrorHandler.getRecoverySuggestion(engineError);
        console.log('Recovery suggestion:', suggestion);
    }
}
```

**Supported Error Codes:**

| Code | Description |
|------|-------------|
| `UNDEFINED_VARIABLE` | Variable not found in data model |
| `MISSING_VARIABLE_VALUE` | Required variable has no value |
| `VARIABLE_TYPE_MISMATCH` | Variable type doesn't match expected |
| `INVALID_FORMULA` | Formula contains invalid JavaScript |
| `FORMULA_EVALUATION_ERROR` | Formula evaluation failed |
| `EMPTY_FORMULA` | Formula is empty |
| `INVALID_CONDITION` | Condition expression is invalid |
| `CONDITION_EVALUATION_ERROR` | Condition evaluation failed |
| `INVALID_TEMPLATE_STRUCTURE` | Template DOM structure is invalid |
| `MISSING_DATA_MODEL` | Data model not found |
| `TEMPLATE_COMPILATION_ERROR` | Template compilation failed |
| `INVALID_DATA` | Input data is invalid |
| `DATA_VALIDATION_ERROR` | Data validation failed |
| `EXECUTION_ERROR` | Template execution failed |
| `JAVASCRIPT_EVALUATION_DISABLED` | JS evaluation is disabled |

### 3. DebugLogger

Provides detailed tracing and debugging of template execution.

**Key Features:**
- ✅ Multiple log levels (DEBUG, INFO, WARN, ERROR)
- ✅ Category-based event filtering
- ✅ Performance timing information
- ✅ Event history with timestamps
- ✅ Comprehensive debug reports
- ✅ Singleton pattern for application-wide logging

**Usage Example:**

```typescript
import { DebugLogger } from '@accordproject/template-engine';

// Initialize and enable debug logging
const logger = DebugLogger.getInstance(true);

// Log simple messages
logger.info('parser', 'Template parsing started');

// Log with data
logger.debug('evaluator', 'Evaluating formula', {
    formula: 'amount * rate',
    amount: 1000
});

// Log with timing
const result = logger.logSync('processor', 'Processing template', () => {
    return processTemplate(data);
});

// Get events by category
const parserEvents = logger.getEventsByCategory('parser');

// Generate debug report
const report = logger.generateReport();
console.log(report);
```

**Log Categories (Recommended):**

- `parser` - Template parsing operations
- `compiler` - Template compilation
- `evaluator` - Expression evaluation
- `processor` - Template processing
- `validator` - Validation operations
- `executor` - Template execution

## Integration Example

Here's how to use all three components together:

```typescript
import { 
    TemplateMarkInterpreter,
    ValidationEngine,
    ErrorHandler,
    DebugLogger
} from '@accordproject/template-engine';
import { ModelManager } from '@accordproject/concerto-core';

async function processTemplateWithValidation(templateDom: any, data: any) {
    const logger = DebugLogger.getInstance(true);
    const modelManager = new ModelManager();
    
    try {
        // Step 1: Validate the template
        logger.info('main', 'Starting template validation');
        const validator = new ValidationEngine(templateDom, modelManager);
        const validationResult = validator.validate();
        
        if (!validationResult.isValid) {
            logger.error('main', 'Template validation failed', {
                errors: validationResult.errors
            });
            console.error(validator.getReport(validationResult));
            throw ErrorHandler.createError('INVALID_TEMPLATE_STRUCTURE', {
                details: 'Template failed validation checks'
            });
        }
        
        logger.info('main', 'Template validation passed');
        
        // Step 2: Process the template
        logger.info('main', 'Starting template processing');
        const interpreter = new TemplateMarkInterpreter();
        const result = await logger.logAsync(
            'processor',
            'Process template',
            () => interpreter.processTemplate(templateDom, data)
        );
        
        logger.info('main', 'Template processing completed successfully');
        return result;
        
    } catch (error) {
        // Step 3: Handle errors gracefully
        const engineError = ErrorHandler.wrapError(error, {
            templateName: 'myTemplate',
            timestamp: new Date().toISOString()
        });
        
        logger.error('main', 'Template processing failed', {
            error: engineError.toJSON()
        });
        
        console.error('Detailed error:', engineError.getDetailedMessage());
        
        if (ErrorHandler.isRecoverable(engineError)) {
            console.log('Suggestion:', ErrorHandler.getRecoverySuggestion(engineError));
        }
        
        throw engineError;
    } finally {
        // Output debug information
        console.log('\n=== Debug Report ===\n');
        console.log(logger.generateReport());
    }
}
```

## Benefits

### For Developers
- ✅ **Better Error Messages** - Clear, actionable error messages instead of cryptic failures
- ✅ **Easier Debugging** - Comprehensive logging and timing information
- ✅ **Early Detection** - Validate templates before processing
- ✅ **Recovery Guidance** - Get suggestions on how to fix errors

### For Production
- ✅ **Stability** - Prevent silent failures
- ✅ **Visibility** - Detailed logs for troubleshooting
- ✅ **Reliability** - Better error handling and recovery
- ✅ **Maintainability** - Clear error codes and categorization

### For System Architecture
- ✅ **System-Wide** - Works across all template processing workflows
- ✅ **Non-Intrusive** - Can be integrated without breaking existing code
- ✅ **Extensible** - Easy to add custom validators or error handlers
- ✅ **Reusable** - Components can be used independently or together

## Performance Impact

- **Minimal Overhead** - Validation and logging add negligible overhead
- **Event Pooling** - Debug logger maintains a bounded event history (default 1000 events)
- **Lazy Evaluation** - Debug messages are only evaluated when enabled
- **Async Support** - No blocking operations in the error handling path

## Best Practices

1. **Always Validate Templates** - Run validation before processing in production
2. **Enable Debug Logging** - Use debug logger in development and during testing
3. **Handle Errors Gracefully** - Check `isRecoverable()` to determine recovery strategy
4. **Include Context** - Always provide context when wrapping errors
5. **Generate Reports** - Use debug reports for post-mortem analysis
6. **Monitor Error Codes** - Track which error codes occur most frequently
7. **Follow Error Suggestions** - Implement recovery logic based on suggestions

## Testing

Comprehensive test suite included in `test/ValidationAndErrorHandling.test.ts`:

```bash
npm test -- test/ValidationAndErrorHandling.test.ts
```

Tests cover:
- Template structure validation
- Variable reference checking
- Error message generation
- Error wrapping and recovery
- Debug logging and reporting
- Filtering and report generation

## Migration Guide

To add validation and error handling to existing code:

```typescript
// Before
const result = await interpreter.processTemplate(templateDom, data);

// After
const validator = new ValidationEngine(templateDom, modelManager);
const validationResult = validator.validate();

if (!validationResult.isValid) {
    throw ErrorHandler.createError('INVALID_TEMPLATE_STRUCTURE', {
        details: validator.getReport(validationResult)
    });
}

const result = await interpreter.processTemplate(templateDom, data);
```

## Future Enhancements

Potential areas for expansion:
- Custom validation rules
- Template linting
- Performance profiling
- Error analytics
- Template versioning support
- Conditional recovery strategies
- Multi-language error messages
