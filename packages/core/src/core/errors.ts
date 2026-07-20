import { Code, ConnectError } from "@connectrpc/connect";

export class HttpException extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }

  getResponse(): unknown {
    if (this.response !== undefined) {
      return this.response;
    }

    return {
      statusCode: this.status,
      message: this.message,
      error: this.name,
    };
  }
}

export class BadRequestException extends HttpException {
  constructor(message = "Bad Request", response?: unknown) {
    super(400, message, response);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = "Unauthorized", response?: unknown) {
    super(401, message, response);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = "Forbidden", response?: unknown) {
    super(403, message, response);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = "Not Found", response?: unknown) {
    super(404, message, response);
  }
}

export class InternalServerErrorException extends HttpException {
  constructor(message = "Internal Server Error", response?: unknown) {
    super(500, message, response);
  }
}

interface ErrorMappingOptions {
  exposeInternalErrors?: boolean;
}

function internalErrorMessage(error: Error, options?: ErrorMappingOptions): string {
  if (options?.exposeInternalErrors && error.message.trim().length > 0) {
    return error.message;
  }

  return "Internal Server Error";
}

function connectCodeToHttpStatus(code: Code): number {
  switch (code) {
    case Code.Canceled:
      return 499;
    case Code.Unknown:
      return 500;
    case Code.InvalidArgument:
      return 400;
    case Code.DeadlineExceeded:
      return 504;
    case Code.NotFound:
      return 404;
    case Code.AlreadyExists:
      return 409;
    case Code.PermissionDenied:
      return 403;
    case Code.ResourceExhausted:
      return 429;
    case Code.FailedPrecondition:
      return 412;
    case Code.Aborted:
      return 409;
    case Code.OutOfRange:
      return 400;
    case Code.Unimplemented:
      return 501;
    case Code.Internal:
      return 500;
    case Code.Unavailable:
      return 503;
    case Code.DataLoss:
      return 500;
    case Code.Unauthenticated:
      return 401;
    default:
      return 500;
  }
}

function httpStatusToConnectCode(status: number): Code {
  if (status === 400) return Code.InvalidArgument;
  if (status === 401) return Code.Unauthenticated;
  if (status === 403) return Code.PermissionDenied;
  if (status === 404) return Code.NotFound;
  if (status === 409) return Code.Aborted;
  if (status === 412) return Code.FailedPrecondition;
  if (status === 429) return Code.ResourceExhausted;
  if (status === 499) return Code.Canceled;
  if (status === 501) return Code.Unimplemented;
  if (status === 503) return Code.Unavailable;
  if (status === 504) return Code.DeadlineExceeded;
  return Code.Internal;
}

export function toHttpError(error: unknown, options?: ErrorMappingOptions): { status: number; body: unknown } {
  if (error instanceof HttpException) {
    return {
      status: error.status,
      body: error.getResponse(),
    };
  }

  if (error instanceof ConnectError) {
    const status = connectCodeToHttpStatus(error.code);
    const isInternal = status >= 500;

    return {
      status,
      body: {
        statusCode: status,
        message: isInternal ? internalErrorMessage(error, options) : error.message,
        code: error.code,
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        statusCode: 500,
        message: internalErrorMessage(error, options),
        error: error.name,
      },
    };
  }

  return {
    status: 500,
    body: {
      statusCode: 500,
      message: "Internal Server Error",
    },
  };
}

export function toConnectError(error: unknown, options?: ErrorMappingOptions): ConnectError {
  if (error instanceof ConnectError) {
    if (error.code === Code.Internal && !options?.exposeInternalErrors) {
      return new ConnectError("Internal Server Error", error.code);
    }

    return error;
  }

  if (error instanceof HttpException) {
    const code = httpStatusToConnectCode(error.status);
    if (code === Code.Internal && !options?.exposeInternalErrors) {
      return new ConnectError("Internal Server Error", code);
    }

    return new ConnectError(error.message, code);
  }

  if (error instanceof Error) {
    return new ConnectError(internalErrorMessage(error, options), Code.Internal);
  }

  return new ConnectError("Internal Server Error", Code.Internal);
}
