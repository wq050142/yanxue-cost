'use client';

import { Input } from '@/components/ui/input';
import { useState, useRef, useEffect } from 'react';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberInput({ value, onChange, className, placeholder, ...props }: NumberInputProps) {
  const [displayValue, setDisplayValue] = useState<string>(value === 0 ? '' : String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // 同步外部value变化
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      setDisplayValue(value === 0 ? '' : String(value));
    }
  }, [value]);

  const handleFocus = () => {
    if (value === 0) {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    if (displayValue === '' || displayValue === '-') {
      setDisplayValue('');
      onChange(0);
    } else {
      const num = parseFloat(displayValue);
      if (!isNaN(num)) {
        onChange(num);
        setDisplayValue(num === 0 ? '' : String(num));
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || val === '-' || /^-?\d*\.?\d*$/.test(val)) {
      setDisplayValue(val);
      if (val !== '' && val !== '-') {
        const num = parseFloat(val);
        if (!isNaN(num)) {
          onChange(num);
        }
      }
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      className={className}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
    />
  );
}
