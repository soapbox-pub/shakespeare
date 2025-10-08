/**
 * Error thrown when the AI generates an empty message with no content, reasoning, or tool calls.
 * This typically indicates an issue with the AI provider or model configuration.
 */
export class EmptyMessageError extends Error {
  constructor(
    message: string,
    public readonly providerModel: string,
  ) {
    super(message);
    this.name = 'EmptyMessageError';
  }
}
