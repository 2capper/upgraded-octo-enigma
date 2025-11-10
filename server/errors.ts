export class DomainError extends Error {
  httpStatus: number;
  
  constructor(message: string, httpStatus: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.httpStatus = httpStatus;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class InvalidPlayoffSlotError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class DiamondConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 400);
  }
}
