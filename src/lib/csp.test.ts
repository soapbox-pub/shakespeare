import { describe, it, expect } from 'vitest';
import {
  parseCSP,
  stringifyCSP,
  addSourceToDirective,
  addDomainToCSP,
  type CSPDirectives
} from './csp';

describe('parseCSP', () => {
  it('should parse basic CSP with multiple directives', () => {
    const csp = "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src *";
    const result = parseCSP(csp);
    
    expect(result).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'img-src': ['*']
    });
  });

  it('should handle directives without sources', () => {
    const csp = "upgrade-insecure-requests; block-all-mixed-content";
    const result = parseCSP(csp);
    
    expect(result).toEqual({
      'upgrade-insecure-requests': [],
      'block-all-mixed-content': []
    });
  });

  it('should handle empty or whitespace-only CSP', () => {
    expect(parseCSP('')).toEqual({});
    expect(parseCSP('   ')).toEqual({});
    expect(parseCSP(';;;')).toEqual({});
  });

  it('should handle extra whitespace and semicolons', () => {
    const csp = " default-src 'self' ; script-src   'self'  ; ";
    const result = parseCSP(csp);
    
    expect(result).toEqual({
      'default-src': ["'self'"],
      'script-src': ["'self'"]
    });
  });
});

describe('stringifyCSP', () => {
  it('should convert directives back to CSP string', () => {
    const directives: CSPDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'"],
      'img-src': ['*']
    };
    
    const result = stringifyCSP(directives);
    expect(result).toBe("default-src 'self'; script-src 'self' 'unsafe-inline'; img-src *");
  });

  it('should handle directives without sources', () => {
    const directives: CSPDirectives = {
      'upgrade-insecure-requests': [],
      'default-src': ["'self'"]
    };
    
    const result = stringifyCSP(directives);
    expect(result).toBe("upgrade-insecure-requests; default-src 'self'");
  });

  it('should handle empty directives object', () => {
    expect(stringifyCSP({})).toBe('');
  });
});

describe('addSourceToDirective', () => {
  it('should add new source to existing sources', () => {
    const sources = ["'self'", "'unsafe-inline'"];
    const result = addSourceToDirective(sources, 'https://example.com');
    
    expect(result).toEqual(["'self'", "'unsafe-inline'", 'https://example.com']);
  });

  it('should not duplicate existing sources', () => {
    const sources = ["'self'", 'https://example.com'];
    const result = addSourceToDirective(sources, 'https://example.com');
    
    expect(result).toEqual(["'self'", 'https://example.com']);
  });

  it('should replace none with new source', () => {
    const sources = ["'none'"];
    const result = addSourceToDirective(sources, 'https://example.com');
    
    expect(result).toEqual(['https://example.com']);
  });

  it('should replace none even with other sources present', () => {
    const sources = ["'self'", "'none'", "'unsafe-inline'"];
    const result = addSourceToDirective(sources, 'https://example.com');
    
    expect(result).toEqual(["'self'", 'https://example.com', "'unsafe-inline'"]);
  });

  it('should handle empty sources array', () => {
    const sources: string[] = [];
    const result = addSourceToDirective(sources, 'https://example.com');
    
    expect(result).toEqual(['https://example.com']);
  });
});

describe('addDomainToCSP', () => {
  it('should add domain to specified directives', () => {
    const csp = "default-src 'self'; script-src 'self'; img-src 'self'";
    const result = addDomainToCSP(csp, 'https://cdn.example.com', ['script-src', 'img-src']);
    
    expect(result).toContain('script-src \'self\' https://cdn.example.com');
    expect(result).toContain('img-src \'self\' https://cdn.example.com');
    expect(result).toContain('default-src \'self\''); // unchanged
  });

  it('should not modify directives that do not exist', () => {
    const csp = "default-src 'self'";
    const result = addDomainToCSP(csp, 'https://cdn.example.com', ['script-src', 'img-src']);
    
    expect(result).toBe("default-src 'self'");
  });

  it('should handle multiple domains being added', () => {
    const csp = "script-src 'self'";
    let result = addDomainToCSP(csp, 'https://cdn1.example.com', ['script-src']);
    result = addDomainToCSP(result, 'https://cdn2.example.com', ['script-src']);
    
    expect(result).toBe("script-src 'self' https://cdn1.example.com https://cdn2.example.com");
  });

  it('should replace none in specified directives', () => {
    const csp = "default-src 'self'; script-src 'none'; img-src 'self'";
    const result = addDomainToCSP(csp, 'https://cdn.example.com', ['script-src']);
    
    expect(result).toContain('script-src https://cdn.example.com');
    expect(result).toContain('img-src \'self\''); // unchanged
  });
});