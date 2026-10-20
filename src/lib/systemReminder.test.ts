import { describe, it, expect } from 'vitest';
import { describeEnvironmentChanges, isSystemReminder, makeSystemReminder } from './systemReminder';

describe('isSystemReminder', () => {
  it('recognizes a message made by makeSystemReminder', () => {
    expect(isSystemReminder(makeSystemReminder('The date changed.'))).toBe(true);
  });

  it('does not hide a user message that only mentions the tag', () => {
    expect(isSystemReminder({ role: 'user', content: 'What is a <system-reminder>?' })).toBe(false);
    expect(isSystemReminder({ role: 'user', content: '<system-reminder>a</system-reminder> and <system-reminder>b</system-reminder>' })).toBe(false);
  });

  it('only applies to user messages with text content', () => {
    expect(isSystemReminder({ role: 'assistant', content: '<system-reminder>x</system-reminder>' })).toBe(false);
    expect(isSystemReminder({ role: 'user', content: [{ type: 'text', text: '<system-reminder>x</system-reminder>' }] })).toBe(false);
  });
});

describe('describeEnvironmentChanges', () => {
  const before = { date: 'Monday, October 19, 2026' };

  it('says nothing when nothing changed', () => {
    expect(describeEnvironmentChanges(before, { ...before })).toBeUndefined();
  });

  it('describes each change', () => {
    const text = describeEnvironmentChanges(before, {
      date: 'Tuesday, October 20, 2026',
      deployedUrl: 'https://example.shakespeare.wtf',
      repositoryUrl: 'https://git.example/repo.git',
    })!;

    expect(text).toContain('The current date is now Tuesday, October 20, 2026.');
    expect(text).toContain('The project is now deployed at https://example.shakespeare.wtf.');
    expect(text).toContain("The project's repository URL is now https://git.example/repo.git.");
    expect(text).toContain('Edit with Shakespeare');
  });

  it('describes something being removed', () => {
    const text = describeEnvironmentChanges({ ...before, deployedUrl: 'https://a.example' }, before);
    expect(text).toBe('The project is no longer deployed.');
  });
});
