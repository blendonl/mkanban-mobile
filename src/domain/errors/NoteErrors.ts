export class NoteValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteValidationError';
  }
}

export class NoteSaveError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'NoteSaveError';
  }
}

export class NoteNotFoundError extends Error {
  constructor(noteId: string) {
    super(`Note with ID "${noteId}" not found`);
    this.name = 'NoteNotFoundError';
  }
}

export class EntityNotFoundError extends Error {
  constructor(entityType: string, entityId: string) {
    super(`${entityType} with ID "${entityId}" not found`);
    this.name = 'EntityNotFoundError';
  }
}
