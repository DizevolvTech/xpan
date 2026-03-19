export type SupabaseError = {
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

export function assertSupabaseResult<T>(result: SupabaseResult<T>, message: string): T {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  if (result.data === null) {
    throw new Error(`${message}: no data returned`);
  }

  return result.data;
}

export function resolveOptionalSupabaseResult<T>(result: SupabaseResult<T>, message: string): T | null {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  return result.data;
}
