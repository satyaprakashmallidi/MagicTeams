"use client";

import { useRef, useEffect } from "react";
import {
  EngagementCard,
  TotalCallsCard,
  TestimonialCard,
  SpikeGraphCard,
  SystemSummaryCard,
} from "./carousel-cards";

const SignInCarousel = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  const cardComponents = [
    <EngagementCard key="engagement" />,
    <TotalCallsCard key="calls" />,
    <TestimonialCard key="testimonial" />,
    <SpikeGraphCard key="spike" />,
    <SystemSummaryCard key="summary" />,
  ];

  // Duplicate for infinite loop
  const displayCards = [...cardComponents, ...cardComponents];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let y = 0;
    const SCROLL_SPEED = 1;

    const step = () => {
      if (!container) return;

      y += SCROLL_SPEED;
      container.scrollTop = y;

      // Reset when we reach halfway (original cards height)
      if (y >= container.scrollHeight / 2) {
        y = 0;
        container.scrollTop = 0;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, []);

  return (
    <div className="h-screen bg-white flex items-center justify-center overflow-hidden">
      <div
        ref={containerRef}
        className="overflow-hidden h-full flex flex-col items-center justify-start relative"
      >
        <div className="flex flex-col gap-14">
          {displayCards.map((card, index) => (
            <div key={index} className="flex-shrink-0">
              {card}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SignInCarousel;
