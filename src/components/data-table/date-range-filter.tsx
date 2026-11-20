"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DateRangeFilterProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
};

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: DateRangeFilterProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="start-date">De</Label>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          className="w-auto"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="end-date">Até</Label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          className="w-auto"
        />
      </div>
    </div>
  );
}
