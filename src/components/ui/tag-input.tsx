import * as React from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TagInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string[];
  onChange: (tags: string[]) => void;
  /** Character(s) that trigger tag creation. Default: [' ', ','] */
  delimiters?: string[];
  /** Transform tag before adding (e.g., toLowerCase). Default: (tag) => tag.trim() */
  transformTag?: (tag: string) => string;
  /** Validate tag before adding. Return false to reject. */
  validateTag?: (tag: string) => boolean;
  /** Allow duplicate tags. Default: false */
  allowDuplicates?: boolean;
}

export const TagInput = React.forwardRef<HTMLInputElement, TagInputProps>(
  (
    {
      className,
      value = [],
      onChange,
      delimiters = [' ', ','],
      transformTag = (tag) => tag.trim(),
      validateTag,
      allowDuplicates = false,
      disabled,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    // Combine external ref with internal ref
    React.useImperativeHandle(ref, () => inputRef.current!);

    const addTag = (tag: string) => {
      const transformed = transformTag(tag);
      
      if (!transformed) return;

      // Check for duplicates if not allowed
      if (!allowDuplicates && value.includes(transformed)) {
        setInputValue('');
        return;
      }

      // Validate if validator provided
      if (validateTag && !validateTag(transformed)) {
        setInputValue('');
        return;
      }

      onChange([...value, transformed]);
      setInputValue('');
    };

    const removeTag = (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Handle delimiters (space, comma, etc.)
      if (delimiters.includes(e.key)) {
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        return;
      }

      // Handle Enter key
      if (e.key === 'Enter') {
        e.preventDefault();
        if (inputValue.trim()) {
          addTag(inputValue);
        }
        return;
      }

      // Handle Backspace - delete last tag if input is empty
      if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        e.preventDefault();
        removeTag(value.length - 1);
        return;
      }
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      
      // Check if any delimiter was typed
      const hasDelimiter = delimiters.some(delimiter => newValue.includes(delimiter));
      
      if (hasDelimiter) {
        // Extract the part before the delimiter
        const parts = newValue.split(new RegExp(`[${delimiters.map(d => d === ' ' ? '\\s' : d).join('')}]`));
        const tagToAdd = parts[0];
        
        if (tagToAdd.trim()) {
          addTag(tagToAdd);
        }
      } else {
        setInputValue(newValue);
      }
    };

    const handleContainerClick = () => {
      inputRef.current?.focus();
    };

    return (
      <div
        ref={containerRef}
        className={cn(
          'flex min-h-10 w-full flex-wrap gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className
        )}
        onClick={handleContainerClick}
      >
        {/* Render tags */}
        {value.map((tag, index) => (
          <Badge
            key={index}
            variant="secondary"
            className="gap-1 pr-1.5 pl-2.5 py-0.5 h-6"
          >
            <span>{tag}</span>
            <button
              type="button"
              className="ml-1 rounded-sm hover:bg-secondary-foreground/20 focus:outline-none focus:ring-1 focus:ring-ring"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Remove {tag}</span>
            </button>
          </Badge>
        ))}

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : undefined}
          className={cn(
            'flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground',
            'disabled:cursor-not-allowed'
          )}
          {...props}
        />
      </div>
    );
  }
);

TagInput.displayName = 'TagInput';
