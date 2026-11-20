"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DateRangeFilterProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  singleDay?: boolean;
  onSingleDayChange?: (value: boolean) => void;
};

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  singleDay = false,
  onSingleDayChange,
}: DateRangeFilterProps) {
  const checkboxId = useId();
  const startId = useId();
  const endId = useId();

  return (
    <div className="flex flex-wrap items-end gap-3">
      {onSingleDayChange && (
        <label
          htmlFor={checkboxId}
          className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={singleDay}
            onChange={(event) => {
              const checked = event.target.checked;
              onSingleDayChange(checked);
              if (checked && startDate) {
                onEndDateChange(startDate);
              }
            }}
            className="h-4 w-4 rounded border-input"
          />
          Dia único
        </label>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={startId}>{singleDay ? "Data" : "De"}</Label>
        <Input
          id={startId}
          type="date"
          value={startDate}
          onChange={(event) => {
            const value = event.target.value;
            onStartDateChange(value);
            if (singleDay) {
              onEndDateChange(value);
            }
          }}
          className="w-[11.5rem]"
        />
      </div>

      {!singleDay && (
        <div className="space-y-1.5">
          <Label htmlFor={endId}>Até</Label>
          <Input
            id={endId}
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="w-[11.5rem]"
          />
        </div>
      )}
    </div>
  );
}
