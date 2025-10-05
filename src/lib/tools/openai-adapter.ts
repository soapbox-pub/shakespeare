import OpenAI from 'openai';
import { Tool } from './Tool';

/**
 * Convert a custom Tool to OpenAI's ChatCompletionTool format
 */
export function toolToOpenAI<TParams>(name: string, tool: Tool<TParams>): OpenAI.Chat.Completions.ChatCompletionTool {
  const functionDef: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  } = {
    name,
    description: tool.description,
  };

  if (tool.inputSchema) {
    functionDef.parameters = zodSchemaToJsonSchema(tool.inputSchema);
  } else {
    functionDef.parameters = { type: "object" };
  }

  return {
    type: 'function',
    function: functionDef
  };
}

/**
 * Convert a Zod schema to JSON Schema format for OpenAI
 */
function zodSchemaToJsonSchema(schema: unknown): Record<string, unknown> {
  // This is a simplified conversion. For a full implementation,
  // you might want to use a library like zod-to-json-schema
  const schemaObj = schema as { _def?: { typeName?: string; shape?: () => Record<string, unknown> } };

  if (schemaObj._def?.typeName === 'ZodObject') {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    const shape = schemaObj._def.shape?.();
    if (shape) {
      for (const [key, value] of Object.entries(shape)) {
        const fieldSchema = value as { _def?: { typeName?: string } };
        properties[key] = convertZodField(fieldSchema);

        if (!fieldSchema._def?.typeName?.includes('Optional')) {
          required.push(key);
        }
      }
    }

    return {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  return { type: 'object' };
}

/**
 * Convert individual Zod field to JSON Schema
 */
function convertZodField(field: unknown): Record<string, unknown> {
  const fieldObj = field as {
    _def?: {
      typeName?: string;
      description?: string;
      checks?: Array<{ kind: string; value: unknown }>;
      innerType?: unknown;
      type?: unknown;
    }
  };

  const typeName = fieldObj._def?.typeName;

  switch (typeName) {
    case 'ZodString':
      return {
        type: 'string',
        description: fieldObj._def?.description
      };
    case 'ZodNumber':
      return {
        type: 'number',
        description: fieldObj._def?.description,
        minimum: fieldObj._def?.checks?.find((c) => c.kind === 'min')?.value
      };
    case 'ZodBoolean':
      return {
        type: 'boolean',
        description: fieldObj._def?.description
      };
    case 'ZodOptional':
      return convertZodField(fieldObj._def?.innerType);
    case 'ZodArray':
      return {
        type: 'array',
        items: convertZodField(fieldObj._def?.type),
        description: fieldObj._def?.description
      };
    default:
      return {
        type: 'string',
        description: fieldObj._def?.description || ''
      };
  }
}