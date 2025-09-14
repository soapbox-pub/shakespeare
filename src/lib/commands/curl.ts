import { join } from "@std/path";
import type { JSRuntimeFS } from "../JSRuntime";
import type { ShellCommand, ShellCommandResult } from "./ShellCommand";
import { createSuccessResult, createErrorResult } from "./ShellCommand";
import { isAbsolutePath, validateWritePath } from "../security";

/**
 * Parsed curl options
 */
interface CurlOptions {
  url?: string;
  method: string;
  headers: Record<string, string>;
  data?: string;
  output?: string;
  includeHeaders: boolean;
  followRedirects: boolean;
  silent: boolean;
  verbose: boolean;
  userAgent?: string;
  timeout?: number;
  maxRedirects: number;
  showProgress: boolean;
  writeOut?: string;
}

/**
 * Implementation of the 'curl' command
 * Transfer data from or to a server using HTTP/HTTPS
 */
export class CurlCommand implements ShellCommand {
  name = 'curl';
  description = 'Transfer data from or to a server using HTTP/HTTPS';
  usage = 'curl [options] <url>';

  private fs: JSRuntimeFS;

  constructor(fs: JSRuntimeFS) {
    this.fs = fs;
  }

  async execute(args: string[], cwd: string, _input?: string): Promise<ShellCommandResult> {
    try {
      const options = this.parseOptions(args);

      if (!options.url) {
        return createErrorResult(`${this.name}: no URL specified\nUsage: ${this.usage}`);
      }

      // Validate URL
      let url: URL;
      try {
        url = new URL(options.url);
      } catch {
        return createErrorResult(`${this.name}: invalid URL: ${options.url}`);
      }

      // Only allow HTTP and HTTPS protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        return createErrorResult(`${this.name}: unsupported protocol: ${url.protocol}`);
      }

      // Proxy the URL through CorsProxy
      const originalUrl = url.toString();
      const proxiedUrl = `https://corsproxy.io/?url=${encodeURIComponent(originalUrl)}`;

      // Prepare request
      const requestInit: RequestInit = {
        method: options.method,
        headers: options.headers,
      };

      // Add body for POST, PUT, PATCH requests
      if (options.data && ['POST', 'PUT', 'PATCH'].includes(options.method)) {
        requestInit.body = options.data;

        // Set default content-type if not specified
        if (!options.headers['content-type'] && !options.headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      // Set User-Agent
      if (options.userAgent) {
        options.headers['User-Agent'] = options.userAgent;
      } else if (!options.headers['user-agent'] && !options.headers['User-Agent']) {
        options.headers['User-Agent'] = 'curl/8.0.0 (compatible; JavaScript fetch)';
      }

      // Handle timeout
      const controller = new AbortController();
      let timeoutId: ReturnType<typeof setTimeout> | undefined;

      if (options.timeout) {
        timeoutId = setTimeout(() => controller.abort(), options.timeout * 1000);
        requestInit.signal = controller.signal;
      }

      try {
        if (options.verbose && !options.silent) {
          console.log(`* Trying ${url.hostname}... (via CorsProxy)`);
          console.log(`> ${options.method} ${url.pathname}${url.search} HTTP/1.1`);
          console.log(`> Host: ${url.hostname}`);
          for (const [key, value] of Object.entries(options.headers)) {
            console.log(`> ${key}: ${value}`);
          }
          if (options.data) {
            console.log(`> `);
            console.log(options.data);
          }
        }

        // Make the request using the proxied URL
        const response = await fetch(proxiedUrl, requestInit);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        // Handle redirects manually if followRedirects is false
        if (!options.followRedirects && response.redirected) {
          return createErrorResult(`${this.name}: redirect not followed (use -L to follow redirects)`);
        }

        let output = '';

        // Include response headers if requested
        if (options.includeHeaders) {
          output += `HTTP/1.1 ${response.status} ${response.statusText}\n`;
          response.headers.forEach((value, key) => {
            output += `${key}: ${value}\n`;
          });
          output += '\n';
        }

        // Get response body
        const responseText = await response.text();

        if (options.verbose && !options.silent) {
          console.log(`< HTTP/1.1 ${response.status} ${response.statusText}`);
          response.headers.forEach((value, key) => {
            console.log(`< ${key}: ${value}`);
          });
        }

        // Handle non-success status codes
        if (!response.ok && !options.silent) {
          const errorMsg = `HTTP ${response.status}: ${response.statusText}`;
          if (options.output) {
            // Still write to file even on error
            await this.writeToFile(options.output, responseText, cwd);
            return createErrorResult(errorMsg);
          } else {
            output += responseText;
            return createErrorResult(`${errorMsg}\n${output}`);
          }
        }

        output += responseText;

        // Write to file if output option is specified
        if (options.output) {
          await this.writeToFile(options.output, responseText, cwd);
          if (!options.silent) {
            return createSuccessResult(`  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current\n                                 Dload  Upload   Total   Spent    Left  Speed\n100  ${responseText.length}  100  ${responseText.length}    0     0   ${Math.round(responseText.length / 0.1)}      0 --:--:-- --:--:-- --:--:--  ${Math.round(responseText.length / 0.1)}`);
          } else {
            return createSuccessResult('');
          }
        }

        // Handle write-out format
        if (options.writeOut) {
          const writeOutResult = this.formatWriteOut(options.writeOut, response, responseText);
          if (options.silent) {
            return createSuccessResult(writeOutResult);
          } else {
            output += '\n' + writeOutResult;
          }
        }

        return createSuccessResult(options.silent ? '' : output);

      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return createErrorResult(`${this.name}: operation timed out after ${options.timeout} seconds`);
          } else if (error.message.includes('fetch')) {
            return createErrorResult(`${this.name}: failed to connect to ${url.hostname}: ${error.message}`);
          } else {
            return createErrorResult(`${this.name}: ${error.message}`);
          }
        } else {
          return createErrorResult(`${this.name}: unknown error occurred`);
        }
      }

    } catch (error) {
      return createErrorResult(`${this.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse curl command line options
   */
  private parseOptions(args: string[]): CurlOptions {
    const options: CurlOptions = {
      method: 'GET',
      headers: {},
      includeHeaders: false,
      followRedirects: true,
      silent: false,
      verbose: false,
      maxRedirects: 50,
      showProgress: true,
    };

    let i = 0;
    while (i < args.length) {
      const arg = args[i];

      if (arg.startsWith('-')) {
        // Handle options
        switch (arg) {
          case '-X':
          case '--request':
            i++;
            if (i < args.length) {
              options.method = args[i].toUpperCase();
            }
            break;

          case '-H':
          case '--header':
            i++;
            if (i < args.length) {
              const header = args[i];
              const colonIndex = header.indexOf(':');
              if (colonIndex > 0) {
                const key = header.substring(0, colonIndex).trim();
                const value = header.substring(colonIndex + 1).trim();
                options.headers[key] = value;
              }
            }
            break;

          case '-d':
          case '--data':
          case '--data-raw':
            i++;
            if (i < args.length) {
              options.data = args[i];
              if (options.method === 'GET') {
                options.method = 'POST';
              }
            }
            break;

          case '-o':
          case '--output':
            i++;
            if (i < args.length) {
              options.output = args[i];
            }
            break;

          case '-i':
          case '--include':
            options.includeHeaders = true;
            break;

          case '-L':
          case '--location':
            options.followRedirects = true;
            break;

          case '-s':
          case '--silent':
            options.silent = true;
            options.showProgress = false;
            break;

          case '-v':
          case '--verbose':
            options.verbose = true;
            break;

          case '-A':
          case '--user-agent':
            i++;
            if (i < args.length) {
              options.userAgent = args[i];
            }
            break;

          case '-m':
          case '--max-time':
            i++;
            if (i < args.length) {
              options.timeout = parseInt(args[i], 10);
            }
            break;

          case '--max-redirs':
            i++;
            if (i < args.length) {
              options.maxRedirects = parseInt(args[i], 10);
            }
            break;

          case '-w':
          case '--write-out':
            i++;
            if (i < args.length) {
              options.writeOut = args[i];
            }
            break;

          case '--no-progress-meter':
            options.showProgress = false;
            break;

          default:
            // Handle combined short options like -sL
            if (arg.startsWith('-') && arg.length > 2 && !arg.startsWith('--')) {
              for (let j = 1; j < arg.length; j++) {
                const shortOpt = '-' + arg[j];
                switch (shortOpt) {
                  case '-s':
                    options.silent = true;
                    options.showProgress = false;
                    break;
                  case '-L':
                    options.followRedirects = true;
                    break;
                  case '-i':
                    options.includeHeaders = true;
                    break;
                  case '-v':
                    options.verbose = true;
                    break;
                }
              }
            }
            break;
        }
      } else {
        // This should be the URL
        if (!options.url) {
          options.url = arg;
        }
      }

      i++;
    }

    return options;
  }

  /**
   * Write response to a file
   */
  private async writeToFile(filename: string, content: string, cwd: string): Promise<void> {
    try {
      // Validate write permissions for absolute paths
      validateWritePath(filename, 'curl', cwd);

      // Handle both absolute and relative paths
      let absolutePath: string;
      if (isAbsolutePath(filename)) {
        absolutePath = filename;
      } else {
        absolutePath = join(cwd, filename);
      }

      await this.fs.writeFile(absolutePath, content, 'utf8');
    } catch (error) {
      throw new Error(`failed to write to file ${filename}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Format write-out variables
   */
  private formatWriteOut(format: string, response: Response, responseText: string): string {
    const variables: Record<string, string | number> = {
      'http_code': response.status,
      'response_code': response.status,
      'http_version': '1.1',
      'size_download': responseText.length,
      'size_upload': 0,
      'time_total': 0.1, // Placeholder since we don't track timing
      'time_namelookup': 0.01,
      'time_connect': 0.02,
      'time_appconnect': 0.03,
      'time_pretransfer': 0.04,
      'time_redirect': 0.0,
      'time_starttransfer': 0.05,
      'url_effective': response.url,
      'content_type': response.headers.get('content-type') || '',
    };

    let result = format;

    // Replace variables
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`%\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value));
    }

    // Handle escape sequences
    result = result.replace(/\\n/g, '\n');
    result = result.replace(/\\t/g, '\t');
    result = result.replace(/\\r/g, '\r');
    result = result.replace(/\\\\/g, '\\');

    return result;
  }
}