export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errorCode: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, errorCode = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, message, errorCode, details);
  }

  static unauthorized(message = 'Authentication required', errorCode = 'UNAUTHORIZED') {
    return new ApiError(401, message, errorCode);
  }

  static forbidden(
    message = 'You do not have permission to perform this action',
    errorCode = 'FORBIDDEN',
  ) {
    return new ApiError(403, message, errorCode);
  }

  static notFound(message: string, errorCode = 'NOT_FOUND') {
    return new ApiError(404, message, errorCode);
  }

  static conflict(message: string, errorCode = 'CONFLICT') {
    return new ApiError(409, message, errorCode);
  }
}
