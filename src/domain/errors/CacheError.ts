export class CacheError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CacheError';
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

export class CacheNotFoundError extends CacheError {
  constructor(key: string) {
    super(`Cache entry not found for key: ${key}`);
    this.name = 'CacheNotFoundError';
    Object.setPrototypeOf(this, CacheNotFoundError.prototype);
  }
}

export class CacheExpiredError extends CacheError {
  constructor(key: string) {
    super(`Cache entry expired for key: ${key}`);
    this.name = 'CacheExpiredError';
    Object.setPrototypeOf(this, CacheExpiredError.prototype);
  }
}

export class CacheMemoryError extends CacheError {
  constructor(message: string) {
    super(message);
    this.name = 'CacheMemoryError';
    Object.setPrototypeOf(this, CacheMemoryError.prototype);
  }
}
