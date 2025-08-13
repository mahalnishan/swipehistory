"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const START_YEAR = 1800;
const END_YEAR = 2025;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const Home = () => {
  const years = useMemo(() => {
    const totalYears = END_YEAR - START_YEAR + 1;
    return Array.from({ length: totalYears }, (_, i) => START_YEAR + i);
  }, []);
  const [yearIndex, setYearIndex] = useState<number>(() => END_YEAR - START_YEAR);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartX = useRef<number | null>(null);
  const [dragX, setDragX] = useState<number>(0);
  const [isExiting, setIsExiting] = useState<boolean>(false);
  const [exitDir, setExitDir] = useState<"left" | "right" | null>(null);
  const [isEntering, setIsEntering] = useState<boolean>(false);
  const [enterDir, setEnterDir] = useState<"left" | "right" | null>(null);
  const [atCenter, setAtCenter] = useState<boolean>(true);
  const ANIM_MS = 280;
  const MAX_DRAG = 120;
  const MAX_ROTATE_DEG = 6;
  const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)"; // back-out like overshoot

  const currentYear = years[yearIndex];
  // No adjacent card previews are needed anymore; keep logic minimal

  const handlePrev = useCallback(() => {
    if (yearIndex > 0) {
      setYearIndex((y) => y - 1);
      return;
    }
  }, [yearIndex]);

  const handleNext = useCallback(() => {
    if (yearIndex < years.length - 1) {
      setYearIndex((y) => y + 1);
      return;
    }
  }, [yearIndex, years.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    },
    [handleNext, handlePrev]
  );

  const handlePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (isExiting || isEntering) return;
    dragStartX.current = e.clientX;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  }, [isEntering, isExiting]);

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (dragStartX.current == null) return;
    const delta = e.clientX - dragStartX.current;
    setDragX(clamp(delta, -MAX_DRAG, MAX_DRAG));
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const threshold = 80;
    const delta = dragStartX.current == null ? 0 : e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(delta) < threshold) {
      setDragX(0);
      return;
    }
    // animate out then change year then animate in
    const swipedLeft = delta < 0;
    const goingNext = swipedLeft;
    if ((goingNext && yearIndex >= years.length - 1) || (!goingNext && yearIndex <= 0)) {
      // out of bounds, snap back
      setDragX(0);
      return;
    }
    setExitDir(swipedLeft ? "left" : "right");
    setIsExiting(true);
    setDragX(0);
    window.setTimeout(() => {
      if (goingNext) {
        setYearIndex((y) => y + 1);
      } else {
        setYearIndex((y) => y - 1);
      }
      setIsExiting(false);
      setExitDir(null);
      setEnterDir(swipedLeft ? "right" : "left");
      setIsEntering(true);
      setAtCenter(false);
      requestAnimationFrame(() => {
        setAtCenter(true);
        window.setTimeout(() => {
          setIsEntering(false);
          setEnterDir(null);
        }, ANIM_MS);
      });
    }, ANIM_MS);
  }, [ANIM_MS, yearIndex, years.length]);

  return (
    <div
      ref={containerRef}
      className="h-screen w-full flex items-center justify-center p-4 sm:p-6 touch-pan-y select-none"
      role="application"
      aria-label="Historical timeline year swiper"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className="relative w-full h-full">
        {/* Current card */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            data-card="current"
            className={[
              "relative w-full h-full rounded-3xl border border-white/25 bg-white/[0.06] backdrop-blur-lg cursor-grab active:cursor-grabbing",
              "shadow-[0_10px_40px_rgba(0,0,0,0.6)] px-6 py-8 sm:px-12 sm:py-16 text-white overflow-hidden flex flex-col",
              "transition-transform duration-500 will-change-transform",
              "transition-opacity",
              isExiting && exitDir === "left" ? "-translate-x-full opacity-0 rotate-[-6deg]" : "",
              isExiting && exitDir === "right" ? "translate-x-full opacity-0 rotate-[6deg]" : "",
              !isExiting && isEntering && enterDir === "left" && !atCenter ? "-translate-x-full opacity-0 rotate-[-4deg]" : "",
              !isExiting && isEntering && enterDir === "right" && !atCenter ? "translate-x-full opacity-0 rotate-[4deg]" : "",
              !isExiting && isEntering && atCenter ? "translate-x-0 opacity-100 rotate-0" : "",
            ].join(" ")}
            style={{
              transform:
                dragX !== 0 && !isExiting && !isEntering
                  ? `translateX(${dragX}px) rotate(${(dragX / MAX_DRAG) * MAX_ROTATE_DEG}deg)`
                  : undefined,
              transitionTimingFunction: SPRING_EASE,
            }}
            role="region"
            aria-label={`Year ${currentYear}`}
          >
            <div className="flex items-baseline justify-between">
              <div className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                {currentYear}
              </div>
              <div className="text-xs sm:text-sm text-white/70">{yearIndex + 1} / {years.length}</div>
            </div>
            <div className="mt-4 flex-1 min-h-0 overflow-y-auto overscroll-y-contain pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              <Achievement year={currentYear} />
            </div>

            <div className="mt-4 sm:mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={handlePrev}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/15 hover:border-white/30 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Previous event"
              >
                <span className="sr-only">Previous</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 mx-auto"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M15.53 4.47a.75.75 0 0 1 0 1.06L9.06 12l6.47 6.47a.75.75 0 1 1-1.06 1.06l-7-7a.75.75 0 0 1 0-1.06l7-7a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
                </svg>
              </button>

              <div className="text-xs sm:text-sm text-white/70">Use ← → to swipe</div>

              <button
                type="button"
                onClick={handleNext}
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/15 hover:border-white/30 active:scale-95 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                aria-label="Next event"
              >
                <span className="sr-only">Next</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-5 w-5 mx-auto"
                  aria-hidden="true"
                >
                  <path fillRule="evenodd" d="M8.47 19.53a.75.75 0 0 1 0-1.06L14.94 12 8.47 5.53a.75.75 0 1 1 1.06-1.06l7 7a.75.75 0 0 1 0 1.06l-7 7a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

type AchievementProps = {
  year: number;
};

const Achievement = ({ year }: AchievementProps) => {
  const [items, setItems] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");

  // Simple in-memory client cache across navigations
  const cacheRef = useRef<Map<number, string[]>>(new Map());

  useEffect(() => {
    let isCurrent = true;
    const fetchAchievement = async () => {
      try {
        // Use client cache first
        const cached = cacheRef.current.get(year);
        if (cached && cached.length > 0) {
          setItems(cached);
          setStatus("success");
          return;
        }

        setStatus("loading");
        setItems([]);
        const res = await fetch(`/api/achievement?year=${year}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Request failed");
        }
        const data: { items?: string[] } = await res.json();
        if (!isCurrent) return;
        const nextItems = Array.isArray(data?.items) ? data.items : [];
        cacheRef.current.set(year, nextItems);
        setItems(nextItems);
        setStatus("success");
      } catch (err) {
        if (!isCurrent) return;
        setStatus("error");
      }
    };

    fetchAchievement();
    return () => {
      isCurrent = false;
    };
  }, [year]);

  if (status === "loading") {
    return <p className="mt-8 text-lg sm:text-xl leading-relaxed text-white/70">Loading highlights...</p>;
  }
  if (status === "error") {
    return <p className="mt-8 text-lg sm:text-xl leading-relaxed text-white/60">No data available for this year.</p>;
  }

  if (items.length === 0) {
    return <p className="mt-8 text-lg sm:text-xl leading-relaxed text-white/70 break-words">No highlights found.</p>;
  }

  return (
    <ul className="mt-8 space-y-3 text-white/90 break-words">
      {items.map((item, idx) => (
        <li key={`${year}-${idx}`} className="text-xl sm:text-2xl leading-relaxed break-words">
          {item}
        </li>
      ))}
    </ul>
  );
};
