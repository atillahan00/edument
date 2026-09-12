'use client';
import { useEffect } from 'react';
import { tr } from '../locales/tr';
export function ValidationMessages() {
  useEffect(() => {
    function invalid(event: Event) {
      const input = event.target;
      if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement ||
        input instanceof HTMLSelectElement
      )
        input.setCustomValidity(
          input.validity.valueMissing
            ? tr.validation.required
            : input.validity.typeMismatch
              ? tr.validation.type
              : tr.validation.invalid,
        );
    }
    function clear(event: Event) {
      const input = event.target;
      if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement ||
        input instanceof HTMLSelectElement
      )
        input.setCustomValidity('');
    }
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('input', clear, true);
    document.addEventListener('change', clear, true);
    return () => {
      document.removeEventListener('invalid', invalid, true);
      document.removeEventListener('input', clear, true);
      document.removeEventListener('change', clear, true);
    };
  }, []);
  return null;
}
