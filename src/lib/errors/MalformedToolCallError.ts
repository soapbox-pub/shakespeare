/**
 * Error thrown when an AI provider sends a malformed tool call response
 * (e.g., missing function name in the streaming response)
 */
export class MalformedToolCallError extends Error {
	public readonly code = 'malformed_tool_call' as const;
	public readonly toolCallId: string;
	public readonly providerModel: string;

	constructor(message: string, toolCallId: string, providerModel: string) {
		super(message);
		this.name = 'MalformedToolCallError';
		this.toolCallId = toolCallId;
		this.providerModel = providerModel;

		// Maintains proper stack trace for where our error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, MalformedToolCallError);
		}
	}
}

