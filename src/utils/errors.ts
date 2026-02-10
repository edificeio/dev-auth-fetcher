/**
 * Erreurs métier typées pour la CLI.
 */

export class AppConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppConfigError';
    Object.setPrototypeOf(this, AppConfigError.prototype);
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

export class EnvFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvFileError';
    Object.setPrototypeOf(this, EnvFileError.prototype);
  }
}

export class AppDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppDiscoveryError';
    Object.setPrototypeOf(this, AppDiscoveryError.prototype);
  }
}
