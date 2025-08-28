/** Error class for HTTP request failures */
export class HTTPError extends Error {
  /** The response object from the failed HTTP request */
  readonly response: Response;
  /** The original request object */
  readonly request: Request;

  constructor(response: Response, request: Request) {
    super(`HTTP Error: ${response.status} ${request.method} ${request.url}`);
    this.name = 'HTTPError';
    this.response = response;
    this.request = request;
  }
}