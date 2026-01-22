import { describe, it, expect, beforeEach } from 'vitest';
import { TodoWriteTool } from './TodoWriteTool';
import { MockFS } from '@/test/MockFS';
import type { JSRuntimeFS } from '../JSRuntime';

describe('TodoWriteTool', () => {
  let fs: JSRuntimeFS;
  let tool: TodoWriteTool;
  const projectId = 'test-project';

  beforeEach(() => {
    fs = new MockFS() as unknown as JSRuntimeFS;
    tool = new TodoWriteTool(fs, projectId);
  });

  it('should have a description', () => {
    expect(tool.description).toBeDefined();
    expect(tool.description.length).toBeGreaterThan(0);
  });

  it('should have an input schema', () => {
    expect(tool.inputSchema).toBeDefined();
  });

  it('should write todos to .git/ai/TODO file', async () => {
    const todos = [
      {
        id: '1',
        content: 'Test task',
        status: 'pending' as const,
        priority: 'medium' as const,
      },
    ];

    const result = await tool.execute({ todos });

    // Result should be JSON
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual(todos);

    // Check file was written
    const content = await fs.readFile(`/projects/${projectId}/.git/ai/TODO`, 'utf8');
    const savedTodos = JSON.parse(content);
    expect(savedTodos).toEqual(todos);
  });

  it('should count active and completed tasks correctly', async () => {
    const todos = [
      {
        id: '1',
        content: 'Task 1',
        status: 'pending' as const,
        priority: 'high' as const,
      },
      {
        id: '2',
        content: 'Task 2',
        status: 'completed' as const,
        priority: 'medium' as const,
      },
      {
        id: '3',
        content: 'Task 3',
        status: 'in_progress' as const,
        priority: 'low' as const,
      },
    ];

    const result = await tool.execute({ todos });

    // Result should be JSON
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual(todos);
    
    // Verify counts
    const active = resultData.filter((x: { status: string }) => x.status !== 'completed' && x.status !== 'cancelled');
    const completed = resultData.filter((x: { status: string }) => x.status === 'completed');
    expect(active.length).toBe(2);
    expect(completed.length).toBe(1);
  });

  it('should handle cancelled tasks', async () => {
    const todos = [
      {
        id: '1',
        content: 'Task 1',
        status: 'cancelled' as const,
        priority: 'low' as const,
      },
      {
        id: '2',
        content: 'Task 2',
        status: 'completed' as const,
        priority: 'medium' as const,
      },
    ];

    const result = await tool.execute({ todos });

    // Result should be JSON
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual(todos);
    
    // Verify counts
    const active = resultData.filter((x: { status: string }) => x.status !== 'completed' && x.status !== 'cancelled');
    const completed = resultData.filter((x: { status: string }) => x.status === 'completed');
    expect(active.length).toBe(0);
    expect(completed.length).toBe(1);
  });

  it('should handle empty todo list', async () => {
    const todos: Array<{ id: string; content: string; status: 'pending' | 'in_progress' | 'completed' | 'cancelled'; priority: 'high' | 'medium' | 'low' }> = [];

    const result = await tool.execute({ todos });

    // Result should be JSON
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual([]);
  });

  it('should create .git/ai directory if it does not exist', async () => {
    const todos = [
      {
        id: '1',
        content: 'Test task',
        status: 'pending' as const,
        priority: 'medium' as const,
      },
    ];

    await tool.execute({ todos });

    // Verify directory was created
    const stat = await fs.stat(`/projects/${projectId}/.git/ai`);
    expect(stat.isDirectory()).toBe(true);
  });
});
