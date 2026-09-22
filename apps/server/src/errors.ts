export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = 'Error',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message, 'BadRequest');
}

export function notFound(message: string): HttpError {
  return new HttpError(404, message, 'NotFound');
}
