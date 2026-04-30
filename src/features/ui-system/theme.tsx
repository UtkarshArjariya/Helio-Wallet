import React from 'react';

export const SolarPatterns = {
  OrbitalLines: () => (
    <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="200" cy="200" r="100" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="0.5" />
      <circle cx="200" cy="200" r="190" stroke="currentColor" strokeWidth="0.5" />
      <line x1="200" y1="0" x2="200" y2="400" stroke="currentColor" strokeWidth="0.5" />
      <line x1="0" y1="200" x2="400" y2="200" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  ),
  HalftoneGlow: () => (
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,213,72,0.05),transparent_70%)] pointer-events-none" />
  )
};

export const ThemeGradients = {
  Solar: "bg-gradient-to-br from-[#F5D548] via-[#FF9448] to-[#7C5CFF]",
  Cosmic: "bg-gradient-to-br from-[#7C5CFF] via-[#58A6FF] to-[#38D39F]",
  Surface: "bg-gradient-to-b from-[#10141C] to-[#070A0F]",
};
