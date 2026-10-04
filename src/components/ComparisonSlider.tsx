'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ComparisonSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}

export function ComparisonSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Ảnh gốc (Mờ/Vỡ)',
  afterLabel = 'AI Làm nét (Ultra HD)',
  className = '',
}: ComparisonSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep track of container width for perfect pixel registration between before and after images
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, []);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    let pos = (x / rect.width) * 100;
    pos = Math.max(0, Math.min(100, pos));
    setSliderPosition(pos);
  }, []);

  // Window listeners during drag so cursor leaving the container doesn't drop the drag
  useEffect(() => {
    if (!isDragging) return;

    const onGlobalMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const onGlobalMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
    };
  }, [isDragging, handleMove]);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden rounded-xl bg-slate-950 border border-slate-800 shadow-2xl cursor-ew-resize ${className}`}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        if (e.touches[0]) handleMove(e.touches[0].clientX);
      }}
      onTouchMove={handleTouchMove}
    >
      {/* After Image (Full width background) */}
      <img
        src={afterSrc}
        alt="After AI enhancement"
        className="block w-full h-auto max-h-[70vh] object-contain mx-auto pointer-events-none"
      />

      {/* Before Image (Clipped overlay, fixed pixel width so it doesn't get squished) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeSrc}
          alt="Before enhancement"
          className="block h-auto max-h-[70vh] object-contain mx-auto pointer-events-none"
          style={{
            width: containerWidth ? `${containerWidth}px` : '100%',
            maxWidth: 'none',
          }}
        />
      </div>

      {/* Slider Divider Line */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)] pointer-events-none z-10"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Handle Button */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-indigo-600 text-white border-2 border-white shadow-xl flex items-center justify-center text-xs font-bold pointer-events-auto cursor-ew-resize hover:scale-110 active:scale-95 transition-transform">
          ⇄
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-medium text-slate-300 border border-white/10 pointer-events-none shadow-md">
        {beforeLabel}
      </div>
      <div className="absolute top-3 right-3 bg-indigo-950/85 backdrop-blur-md px-2.5 py-1 rounded-md text-xs font-semibold text-indigo-200 border border-indigo-500/30 pointer-events-none shadow-md">
        {afterLabel}
      </div>
    </div>
  );
}
