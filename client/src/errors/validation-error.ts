import { ZodError } from 'zod';

/**
 * Convert Zod errors to Ant Design form field errors format
 * Returns: { fieldName: 'error message' }
 */
export function zodToFormErrors(error: ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    if (path && !fieldErrors[path]) {
      fieldErrors[path] = issue.message;
    }
  });
  return fieldErrors;
}

/**
 * Validate data against a Zod schema, return { success, data, errors }
 */
export function validateForm<T>(schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: ZodError } }, data: unknown): {
  success: boolean;
  data?: T;
  errors?: Record<string, string>;
} {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  return { success: false, errors: zodToFormErrors(result.error!) };
}
