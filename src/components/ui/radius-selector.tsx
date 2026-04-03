"use client";

import React from "react";
import { MapPin } from "lucide-react";
import { RADIUS_OPTIONS, RadiusOption } from "@/lib/geo-utils";

interface RadiusSelectorProps {
  value: RadiusOption;
  onChange: (radius: RadiusOption) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Radius selector component for geographic search filtering
 * Allows users to select a distance radius for location-based filtering
 */
export function RadiusSelector({
  value,
  onChange,
  disabled = false,
  className = "",
}: RadiusSelectorProps) {
  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <MapPin className="h-4 w-4" />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as RadiusOption)}
        disabled={disabled}
        className="w-full h-9 pl-10 pr-3 rounded-md border border-border/50 bg-input/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 disabled:cursor-not-allowed appearance-none cursor-pointer"
      >
        {RADIUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {/* Custom dropdown arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="h-4 w-4 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}

export default RadiusSelector;
