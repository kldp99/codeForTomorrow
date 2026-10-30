/**
 * Translates MySQL / TypeORM database errors into AppError instances with proper
 * HTTP status codes. Called from the central error handler middleware.
 *
 * Common MySQL error numbers:
 *  1062 – ER_DUP_ENTRY        → 409 Conflict
 *  1452 – ER_NO_REFERENCED_ROW → 404 Not Found (FK violation)
 *  1048 – ER_BAD_NULL_ERROR    → 400 Bad Request
 *  1364 – ER_NO_DEFAULT_FOR_FIELD → 400 Bad Request
 */

import { AppError } from './AppError';

interface MySQLErrorLike extends Error {
  errno?: number;
  sqlMessage?: string;
  sqlState?: string;
  code?: string;
  driverError?: {
    errno?: number;
    sqlMessage?: string;
    code?: string;
  };
}

/** Returns true if the given error is a MySQL or TypeORM driver error */
export function isMySQLError(err: unknown): err is MySQLErrorLike {
  if (!(err instanceof Error)) return false;
  const e = err as MySQLErrorLike;
  const errno = e.errno ?? e.driverError?.errno;
  return typeof errno === 'number';
}

/**
 * Convert a MySQL / TypeORM database error into an AppError.
 */
export function translateMySQLError(err: MySQLErrorLike): AppError | null {
  const errno = err.errno ?? err.driverError?.errno;
  const sqlMessage = err.sqlMessage ?? err.driverError?.sqlMessage ?? err.message;

  switch (errno) {
    case 1062: {
      // ER_DUP_ENTRY – unique constraint violated
      const field = extractDuplicateField(sqlMessage);
      return AppError.conflict(
        field
          ? `A record with this ${field} already exists.`
          : 'A record with these details already exists.',
        'DUPLICATE_ENTRY'
      );
    }

    case 1452:
      // ER_NO_REFERENCED_ROW_2 – FK reference does not exist
      return AppError.notFound(
        'Referenced resource',
        'FOREIGN_KEY_NOT_FOUND'
      );

    case 1048:
      // ER_BAD_NULL_ERROR – NOT NULL column received NULL
      return AppError.badRequest(
        `A required field is missing: ${extractColumnName(sqlMessage)}`,
        'NULL_NOT_ALLOWED'
      );

    case 1364:
      // ER_NO_DEFAULT_FOR_FIELD – required field not supplied
      return AppError.badRequest(
        `A required field has no default value: ${extractColumnName(sqlMessage)}`,
        'MISSING_REQUIRED_FIELD'
      );

    default:
      return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDuplicateField(sqlMessage: string): string {
  const match = sqlMessage.match(/for key ['`]?(?:\w+\.)?(\w+)['`]?/i);
  return match ? match[1] : '';
}

function extractColumnName(sqlMessage: string): string {
  const match = sqlMessage.match(/['`](\w+)['`]/);
  return match ? match[1] : '';
}
