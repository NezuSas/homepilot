import React, { useState, useEffect, useRef } from 'react';
import { RangeInput } from './ui/RangeInput';

interface CoverPositionControlProps {
  initialPosition?: number;
  onPositionChange: (position: number) => void;
  disabled?: boolean;
  ariaLabel?: string;
}

/**
 * CoverPositionControl
 * Control deslizante minimalista para ajustar la posición de persianas/cortinas.
 */
export const CoverPositionControl: React.FC<CoverPositionControlProps> = ({
  initialPosition = 0,
  onPositionChange,
  disabled = false,
  ariaLabel = 'Cover position'
}) => {
  const [value, setValue] = useState(initialPosition);
  const lastCommittedValue = useRef(initialPosition);

  // Sincronizar con el estado externo cuando cambie
  useEffect(() => {
    setValue(initialPosition);
    lastCommittedValue.current = initialPosition;
  }, [initialPosition]);

  const commitValue = () => {
    if (disabled) return;
    if (lastCommittedValue.current === value) return;
    lastCommittedValue.current = value;
    onPositionChange(value);
  };

  return (
    <div className="flex flex-col gap-2 w-full px-1">
      <RangeInput
        min={0}
        max={100}
        aria-label={ariaLabel}
        value={value}
        onValueChange={setValue}
        onValueCommit={commitValue}
        disabled={disabled}
        showBounds
        formatValue={(nextValue) => `${nextValue}%`}
      />
    </div>
  );
};
