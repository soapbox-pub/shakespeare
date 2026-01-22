import { describe, it, expect, beforeEach } from 'vitest';
import { TodoReadTool } from './TodoReadTool';
import { TodoWriteTool } from './TodoWriteTool';
import { MockFS } from '@/test/MockFS';
import type { JSRuntimeFS } from '../JSRuntime';

describe('TodoReadTool', () => {
  let fs: JSRuntimeFS;
  let readTool: TodoReadTool;
  let writeTool: TodoWriteTool;
  const projectId = 'test-project';

  beforeEach(() => {
    fs = new MockFS() as unknown as JSRuntimeFS;
    readTool = new TodoReadTool(fs, projectId);
    writeTool = new TodoWriteTool(fs, projectId);
  });

  it('should have a description', () => {
    expect(readTool.description).toBeDefined();
    expect(readTool.description.length).toBeGreaterThan(0);
  });

  it('should have an input schema', () => {
    expect(readTool.inputSchema).toBeDefined();
  });

  it('should return empty message when no todos exist', async () => {
    const result = await readTool.execute({});

    // Should return empty JSON array
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual([]);
  });

  it('should read todos from .git/ai/TODO file', async () => {
    const todos = [
      {
        id: '1',
        content: 'Test task 1',
        status: 'pending' as const,
        priority: 'high' as const,
      },
      {
        id: '2',
        content: 'Test task 2',
        status: 'completed' as const,
        priority: 'medium' as const,
      },
    ];

    // Write todos first
    await writeTool.execute({ todos });

    // Read them back
    const result = await readTool.execute({});

    // Should return JSON
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual(todos);
    
    // Verify counts
    const active = resultData.filter((x: { status: string }) => x.status !== 'completed' && x.status !== 'cancelled');
    const completed = resultData.filter((x: { status: string }) => x.status === 'completed');
    expect(active.length).toBe(1);
    expect(completed.length).toBe(1);
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
      {
        id: '4',
        content: 'Task 4',
        status: 'cancelled' as const,
        priority: 'low' as const,
      },
    ];

    await writeTool.execute({ todos });
    const result = await readTool.execute({});

    // Should return JSON
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual(todos);
    
    // Verify counts
    const active = resultData.filter((x: { status: string }) => x.status !== 'completed' && x.status !== 'cancelled');
    const completed = resultData.filter((x: { status: string }) => x.status === 'completed');
    expect(active.length).toBe(2);
    expect(completed.length).toBe(1);
  });

  it('should handle invalid JSON in TODO file', async () => {
    // Write invalid JSON
    await fs.mkdir(`/projects/${projectId}/.git/ai`, { recursive: true });
    await fs.writeFile(`/projects/${projectId}/.git/ai/TODO`, 'invalid json');

    const result = await readTool.execute({});

    // Should return empty JSON array when file is invalid
    const resultData = JSON.parse(result.content);
    expect(resultData).toEqual([]);
  });

  it('should display full todo information', async () => {
    const todos = [
      {
        id: 'abc123',
        content: 'Implement new feature',
        status: 'in_progress' as const,
        priority: 'high' as const,
      },
    ];

    await writeTool.execute({ todos });
    const result = await readTool.execute({});

    // Should return JSON
    const parsed = JSON.parse(result.content);
    expect(parsed[0].id).toBe('abc123');
    expect(parsed[0].content).toBe('Implement new feature');
    expect(parsed[0].status).toBe('in_progress');
    expect(parsed[0].priority).toBe('high');
  });
});
