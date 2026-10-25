export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
  }
}

/** Invalid user input. The message is safe to show to the user. */
export class ValidationError extends DomainError {}
