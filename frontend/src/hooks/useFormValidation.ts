import { useState, useCallback } from 'react';

interface ValidationRule<T> {
  validator: (value: T) => boolean;
  message: string;
}

interface UseFormValidationProps<T> {
  initialValues: T;
  validationRules?: Partial<Record<keyof T, ValidationRule<T[keyof T]>[]>>;
}

interface ValidationError {
  field: string;
  message: string;
}

interface UseFormValidationReturn<T> {
  values: T;
  errors: Record<string, string>;
  isValid: boolean;
  handleChange: (field: keyof T, value: T[keyof T]) => void;
  setFieldValue: (field: keyof T, value: T[keyof T]) => void;
  setValues: (values: T) => void;
  validateField: (field: keyof T) => boolean;
  validateForm: () => boolean;
  clearErrors: () => void;
  reset: () => void;
}

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  validationRules = {},
}: UseFormValidationProps<T>): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: keyof T): boolean => {
    const value = values[field];
    const rules = validationRules[field];

    if (!rules || rules.length === 0) {
      return true;
    }

    for (const rule of rules) {
      if (!rule.validator(value as any)) {
        setErrors(prev => ({ ...prev, [field as string]: rule.message }));
        return false;
      }
    }

    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field as string];
      return newErrors;
    });
    return true;
  }, [values, validationRules]);

  const validateForm = useCallback((): boolean => {
    let isFormValid = true;
    const newErrors: Record<string, string> = {};

    Object.keys(validationRules).forEach(field => {
      const typedField = field as keyof T;
      const value = values[typedField];
      const rules = validationRules[typedField];

      if (rules) {
        for (const rule of rules) {
          if (!rule.validator(value as any)) {
            newErrors[field] = rule.message;
            isFormValid = false;
            break;
          }
        }
      }
    });

    setErrors(newErrors);
    return isFormValid;
  }, [values, validationRules]);

  const handleChange = useCallback((field: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field as string]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as string];
        return newErrors;
      });
    }
  }, [errors]);

  const setFieldValue = useCallback((field: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    isValid,
    handleChange,
    setFieldValue,
    setValues,
    validateField,
    validateForm,
    clearErrors,
    reset,
  };
}