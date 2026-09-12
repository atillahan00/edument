'use client';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
export const FilePicker = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function FilePicker({ onChange, ...props }, ref) {
    const [name, setName] = useState('Dosya seçilmedi');
    return (
      <span className="file-picker">
        <span className="file-prompt">Dosya seç</span>
        <span className="file-name" aria-hidden="true">
          {name}
        </span>
        <input
          {...props}
          ref={ref}
          type="file"
          onChange={(e) => {
            setName(e.target.files?.[0]?.name || 'Dosya seçilmedi');
            onChange?.(e);
          }}
        />
      </span>
    );
  },
);
