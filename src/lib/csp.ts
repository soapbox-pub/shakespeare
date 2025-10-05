/**
 * Content Security Policy (CSP) utilities for managing and updating CSP directives
 */

export interface CSPDirectives {
  [directive: string]: string[];
}

/**
 * Parses a CSP string into a structured format
 */
export function parseCSP(csp: string): CSPDirectives {
  const directives: CSPDirectives = {};
  
  // Split by semicolon and parse each directive
  csp.split(';').forEach(directive => {
    const trimmed = directive.trim();
    if (!trimmed) return;
    
    const parts = trimmed.split(/\s+/);
    const directiveName = parts[0];
    const sources = parts.slice(1);
    
    directives[directiveName] = sources;
  });

  return directives;
}

/**
 * Converts CSP directives back to a string format
 */
export function stringifyCSP(directives: CSPDirectives): string {
  const directiveStrings: string[] = [];
  
  Object.entries(directives).forEach(([directiveName, sources]) => {
    if (sources.length > 0) {
      directiveStrings.push(`${directiveName} ${sources.join(' ')}`);
    } else {
      directiveStrings.push(directiveName);
    }
  });

  return directiveStrings.join('; ');
}

/**
 * Adds a source to a CSP directive, handling special cases
 */
export function addSourceToDirective(sources: string[], newSource: string): string[] {
  // Don't add if already present
  if (sources.includes(newSource)) {
    return sources;
  }

  // If 'none' is present, replace it with the new source
  if (sources.includes("'none'")) {
    const noneIndex = sources.indexOf("'none'");
    const newSources = [...sources];
    newSources[noneIndex] = newSource;
    return newSources;
  }

  // Add to existing sources
  return [...sources, newSource];
}

/**
 * Updates CSP directives to allow a specific domain for multiple directive types
 */
export function addDomainToCSP(
  csp: string,
  domain: string,
  directiveTypes: string[]
): string {
  const directives = parseCSP(csp);
  
  // Add domain to each relevant directive if it exists
  directiveTypes.forEach(directiveName => {
    const sources = directives[directiveName];
    if (sources) {
      directives[directiveName] = addSourceToDirective(sources, domain);
    }
  });

  return stringifyCSP(directives);
}
