import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TagInput } from './tag-input';

describe('TagInput', () => {
  it('renders with placeholder when no tags', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        value={[]}
        onChange={onChange}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');
    expect(input).toBeInTheDocument();
  });

  it('displays existing tags', () => {
    const onChange = vi.fn();
    render(
      <TagInput
        value={['tag1', 'tag2', 'tag3']}
        onChange={onChange}
      />
    );

    expect(screen.getByText('tag1')).toBeInTheDocument();
    expect(screen.getByText('tag2')).toBeInTheDocument();
    expect(screen.getByText('tag3')).toBeInTheDocument();
  });

  it('adds tag on space key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={[]}
        onChange={onChange}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'newtag ');

    expect(onChange).toHaveBeenCalledWith(['newtag']);
  });

  it('adds tag on comma key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={[]}
        onChange={onChange}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'newtag,');

    expect(onChange).toHaveBeenCalledWith(['newtag']);
  });

  it('adds tag on Enter key', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={[]}
        onChange={onChange}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'newtag{Enter}');

    expect(onChange).toHaveBeenCalledWith(['newtag']);
  });

  it('removes last tag on Backspace when input is empty', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={['tag1', 'tag2']}
        onChange={onChange}
      />
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(onChange).toHaveBeenCalledWith(['tag1']);
  });

  it('removes tag when clicking X button', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={['tag1', 'tag2', 'tag3']}
        onChange={onChange}
      />
    );

    const removeButtons = screen.getAllByRole('button');
    await user.click(removeButtons[1]); // Remove tag2

    expect(onChange).toHaveBeenCalledWith(['tag1', 'tag3']);
  });

  it('transforms tags using transformTag function', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={[]}
        onChange={onChange}
        transformTag={(tag) => tag.toUpperCase()}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, 'lowercase ');

    expect(onChange).toHaveBeenCalledWith(['LOWERCASE']);
  });

  it('prevents duplicate tags by default', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={['existing']}
        onChange={onChange}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'existing ');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('allows duplicate tags when allowDuplicates is true', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={['existing']}
        onChange={onChange}
        allowDuplicates={true}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'existing ');

    expect(onChange).toHaveBeenCalledWith(['existing', 'existing']);
  });

  it('validates tags using validateTag function', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={[]}
        onChange={onChange}
        validateTag={(tag) => tag.length >= 3}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');

    // Try adding tag that's too short
    await user.type(input, 'ab ');
    expect(onChange).not.toHaveBeenCalled();

    // Add valid tag
    await user.type(input, 'valid ');
    expect(onChange).toHaveBeenCalledWith(['valid']);
  });

  it('does not add empty tags', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagInput
        value={[]}
        onChange={onChange}
        placeholder="Add tags..."
      />
    );

    const input = screen.getByPlaceholderText('Add tags...');
    await user.type(input, '   '); // Just spaces

    expect(onChange).not.toHaveBeenCalled();
  });

  it('focuses input when container is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { container } = render(
      <TagInput
        value={['tag1']}
        onChange={onChange}
      />
    );

    const inputContainer = container.querySelector('div');
    if (inputContainer) {
      await user.click(inputContainer);
    }

    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
  });

  it('is disabled when disabled prop is true', () => {
    const onChange = vi.fn();

    render(
      <TagInput
        value={['tag1']}
        onChange={onChange}
        disabled={true}
      />
    );

    const input = screen.getByRole('textbox');
    expect(input).toBeDisabled();
  });
});
