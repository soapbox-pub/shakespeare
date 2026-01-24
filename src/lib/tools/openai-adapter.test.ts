import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { toolToOpenAI } from './openai-adapter';
import { Tool } from './Tool';
import type OpenAI from 'openai';

describe('openai-adapter', () => {
  describe('toolToOpenAI', () => {
    it('should convert a simple string parameter tool', () => {
      const tool: Tool<{ message: string }> = {
        description: 'Test tool',
        inputSchema: z.object({
          message: z.string().describe('A test message'),
        }),
        async execute() {
          return { content: 'test' };
        },
      };

      const result = toolToOpenAI('test_tool', tool) as OpenAI.Chat.Completions.ChatCompletionTool & { type: 'function' };

      expect(result.type).toBe('function');
      expect(result.function.name).toBe('test_tool');
      expect(result.function.description).toBe('Test tool');
      expect(result.function.parameters).toMatchObject({
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'A test message',
          },
        },
        required: ['message'],
      });
    });

    it('should convert nested object parameters', () => {
      const tool: Tool<{ user: { name: string; age: number } }> = {
        description: 'User tool',
        inputSchema: z.object({
          user: z.object({
            name: z.string().describe('User name'),
            age: z.number().describe('User age'),
          }).describe('User information'),
        }),
        async execute() {
          return { content: 'test' };
        },
      };

      const result = toolToOpenAI('user_tool', tool) as OpenAI.Chat.Completions.ChatCompletionTool & { type: 'function' };

      expect(result.function.parameters).toMatchObject({
        type: 'object',
        properties: {
          user: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'User name',
              },
              age: {
                type: 'number',
                description: 'User age',
              },
            },
            required: ['name', 'age'],
            description: 'User information',
          },
        },
        required: ['user'],
      });
    });

    it('should convert array of objects parameters', () => {
      const tool: Tool<{ todos: Array<{ id: string; content: string; status: string }> }> = {
        description: 'Todo tool',
        inputSchema: z.object({
          todos: z.array(
            z.object({
              id: z.string().describe('Todo ID'),
              content: z.string().describe('Todo content'),
              status: z.enum(['pending', 'completed']).describe('Todo status'),
            })
          ).describe('List of todos'),
        }),
        async execute() {
          return { content: 'test' };
        },
      };

      const result = toolToOpenAI('todo_tool', tool) as OpenAI.Chat.Completions.ChatCompletionTool & { type: 'function' };

      expect(result.function.parameters).toMatchObject({
        type: 'object',
        properties: {
          todos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'Todo ID',
                },
                content: {
                  type: 'string',
                  description: 'Todo content',
                },
                status: {
                  type: 'string',
                  enum: ['pending', 'completed'],
                  description: 'Todo status',
                },
              },
              required: ['id', 'content', 'status'],
            },
            description: 'List of todos',
          },
        },
        required: ['todos'],
      });
    });

    it('should handle optional parameters', () => {
      const tool: Tool<{ required: string; optional?: string }> = {
        description: 'Test tool',
        inputSchema: z.object({
          required: z.string().describe('Required param'),
          optional: z.string().optional().describe('Optional param'),
        }),
        async execute() {
          return { content: 'test' };
        },
      };

      const result = toolToOpenAI('test_tool', tool) as OpenAI.Chat.Completions.ChatCompletionTool & { type: 'function' };

      expect(result.function.parameters).toMatchObject({
        type: 'object',
        properties: {
          required: {
            type: 'string',
            description: 'Required param',
          },
          optional: {
            type: 'string',
            description: 'Optional param',
          },
        },
        required: ['required'],
      });
    });

    it('should handle tools without input schema', () => {
      const tool: Tool<Record<string, never>> = {
        description: 'No params tool',
        async execute() {
          return { content: 'test' };
        },
      };

      const result = toolToOpenAI('no_params_tool', tool) as OpenAI.Chat.Completions.ChatCompletionTool & { type: 'function' };

      expect(result.function.parameters).toEqual({
        type: 'object',
        properties: {},
      });
    });

    it('should convert enum parameters', () => {
      const tool: Tool<{ priority: 'high' | 'medium' | 'low' }> = {
        description: 'Priority tool',
        inputSchema: z.object({
          priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
        }),
        async execute() {
          return { content: 'test' };
        },
      };

      const result = toolToOpenAI('priority_tool', tool) as OpenAI.Chat.Completions.ChatCompletionTool & { type: 'function' };

      expect(result.function.parameters).toMatchObject({
        type: 'object',
        properties: {
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            description: 'Priority level',
          },
        },
        required: ['priority'],
      });
    });
  });
});
