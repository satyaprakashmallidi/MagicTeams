"use client";

import { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  target: string; // CSS selector for the target element
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: {
    label: string;
    onClick: () => void;
  };
  highlight?: boolean;
  spotlightPadding?: number;
}

interface GuidedTourProps {
  steps: TourStep[];
  isActive: boolean;
  onComplete: () => void;
  onSkip: () => void;
  currentStepIndex?: number;
}

export function GuidedTour({
  steps,
  isActive,
  onComplete,
  onSkip,
  currentStepIndex = 0
}: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(currentStepIndex);

  // Update current step when prop changes
  useEffect(() => {
    setCurrentStep(currentStepIndex);
  }, [currentStepIndex]);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const tourRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];

  useEffect(() => {
    if (!isActive || !step) {
      setIsVisible(false);
      return;
    }

    const updateTargetRect = () => {
      const target = document.querySelector(step.target);
      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const target = document.querySelector(step.target);
      if (target) {
        // First scroll element into view
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        // Wait for scroll to complete before getting rect and showing tour
        setTimeout(() => {
          const rect = target.getBoundingClientRect();
          setTargetRect(rect);
          setIsVisible(true);

          // Add highlighting class if needed
          if (step.highlight) {
            target.classList.add('tour-highlight');

            // For better highlighting of complex components, also add inline styles
            if (target instanceof HTMLElement) {
              const originalStyles = {
                position: target.style.position,
                zIndex: target.style.zIndex,
                boxShadow: target.style.boxShadow,
                borderRadius: target.style.borderRadius,
                outline: target.style.outline
              };

              target.style.position = 'relative';
              target.style.zIndex = '9997';
              target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)';
              target.style.borderRadius = '12px';
              target.style.outline = 'none';

              // Store original styles for cleanup
              (target as any)._tourOriginalStyles = originalStyles;
            }
          }
        }, 500); // Wait for smooth scroll to complete
      }
    }, 100);

    // Update position on scroll and resize with debouncing
    let scrollTimeout: NodeJS.Timeout;
    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateTargetRect, 100);
    };

    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateTargetRect, 100);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);

      // Clean up highlighting
      if (step?.target) {
        const target = document.querySelector(step.target);
        if (target) {
          target.classList.remove('tour-highlight');

          // Restore original styles if they were stored
          if (target instanceof HTMLElement) {
            const originalStyles = (target as any)._tourOriginalStyles;
            if (originalStyles) {
              target.style.position = originalStyles.position || '';
              target.style.zIndex = originalStyles.zIndex || '';
              target.style.boxShadow = originalStyles.boxShadow || '';
              target.style.borderRadius = originalStyles.borderRadius || '';
              target.style.outline = originalStyles.outline || '';
              delete (target as any)._tourOriginalStyles;
            }
          }
        }
      }
    };
  }, [isActive, step, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      // Clean up current step highlighting before moving
      if (step?.target) {
        const target = document.querySelector(step.target);
        if (target) {
          target.classList.remove('tour-highlight');

          // Restore original styles if they were stored
          if (target instanceof HTMLElement) {
            const originalStyles = (target as any)._tourOriginalStyles;
            if (originalStyles) {
              target.style.position = originalStyles.position || '';
              target.style.zIndex = originalStyles.zIndex || '';
              target.style.boxShadow = originalStyles.boxShadow || '';
              target.style.borderRadius = originalStyles.borderRadius || '';
              target.style.outline = originalStyles.outline || '';
              delete (target as any)._tourOriginalStyles;
            }
          }
        }
      }

      setIsVisible(false);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
      }, 600); // Longer delay to account for cleanup and scroll
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      // Clean up current step highlighting before moving
      if (step?.target) {
        const target = document.querySelector(step.target);
        if (target) {
          target.classList.remove('tour-highlight');

          // Restore original styles if they were stored
          if (target instanceof HTMLElement) {
            const originalStyles = (target as any)._tourOriginalStyles;
            if (originalStyles) {
              target.style.position = originalStyles.position || '';
              target.style.zIndex = originalStyles.zIndex || '';
              target.style.boxShadow = originalStyles.boxShadow || '';
              target.style.borderRadius = originalStyles.borderRadius || '';
              target.style.outline = originalStyles.outline || '';
              delete (target as any)._tourOriginalStyles;
            }
          }
        }
      }

      setIsVisible(false);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
      }, 600); // Longer delay to account for cleanup and scroll
    }
  };

  const handleSkip = () => {
    setIsVisible(false);
    onSkip();
  };

  const getTooltipPosition = () => {
    if (!targetRect) return { top: '50%', left: '50%' };

    const tooltipWidth = 320;
    const tooltipHeight = 200;
    const padding = 20;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    // Calculate absolute position including scroll
    const absoluteTop = targetRect.top + scrollTop;
    const absoluteLeft = targetRect.left + scrollLeft;
    const absoluteBottom = absoluteTop + targetRect.height;
    const absoluteRight = absoluteLeft + targetRect.width;

    let top = 0;
    let left = 0;

    if (step.position === 'center') {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }

    switch (step.position || 'bottom') {
      case 'top':
        top = absoluteTop - tooltipHeight - padding;
        left = absoluteLeft + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        top = absoluteBottom + padding;
        left = absoluteLeft + (targetRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        top = absoluteTop + (targetRect.height / 2) - (tooltipHeight / 2);
        left = absoluteLeft - tooltipWidth - padding;
        break;
      case 'right':
        top = absoluteTop + (targetRect.height / 2) - (tooltipHeight / 2);
        left = absoluteRight + padding;
        break;
      default:
        top = absoluteBottom + padding;
        left = absoluteLeft + (targetRect.width / 2) - (tooltipWidth / 2);
    }

    // Ensure tooltip stays within viewport (accounting for scroll)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    top = Math.max(scrollTop + padding, Math.min(top, scrollTop + viewportHeight - tooltipHeight - padding));
    left = Math.max(scrollLeft + padding, Math.min(left, scrollLeft + viewportWidth - tooltipWidth - padding));

    return { top: `${top}px`, left: `${left}px` };
  };

  if (!isActive || !step) return null;

  const tourContent = (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9998]"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Backdrop with spotlight */}
          <div
            className="absolute inset-0"
            onClick={handleSkip}
            style={{ backgroundColor: '' }}
          >
            {targetRect && step.highlight && (
              <div
                className="absolute"
                style={{
                  top: targetRect.top + (window.pageYOffset || document.documentElement.scrollTop) - (step.spotlightPadding || 8),
                  left: targetRect.left + (window.pageXOffset || document.documentElement.scrollLeft) - (step.spotlightPadding || 8),
                  width: targetRect.width + (step.spotlightPadding || 8) * 2,
                  height: targetRect.height + (step.spotlightPadding || 8) * 2,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75)',
                  borderRadius: '12px',
                  pointerEvents: 'none',
                  backgroundColor: 'transparent',
                  border: '3px solid rgba(59, 130, 246, 0.6)',
                  outline: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              />
            )}
          </div>

          {/* Tooltip */}
          <motion.div
            ref={tourRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.3, type: 'spring' }}
            className="absolute z-[9999]"
            style={{
              ...getTooltipPosition(),
              pointerEvents: 'auto'
            }}
          >
            <Card className="w-80 shadow-xl border-0 overflow-hidden">
              {/* Progress bar */}
              <div className="h-1 bg-gray-200">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                />
              </div>

              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-base">{step.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Step {currentStep + 1} of {steps.length}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleSkip}
                  >
                    <Icon name="x" className="h-4 w-4" />
                  </Button>
                </div>

                {/* Content */}
                <p className="text-sm text-gray-600 mb-4">
                  {step.content}
                </p>

                {/* Custom action button if provided */}
                {step.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mb-3"
                    onClick={step.action.onClick}
                  >
                    {step.action.label}
                  </Button>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handlePrevious}
                    disabled={currentStep === 0}
                  >
                    <Icon name="chevronLeft" className="h-3 w-3 mr-1" />
                    Previous
                  </Button>

                  <div className="flex items-center gap-1">
                    {steps.map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-all",
                          index === currentStep
                            ? "bg-blue-500 w-3"
                            : "bg-gray-300"
                        )}
                      />
                    ))}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleNext}
                  >
                    {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
                    <Icon name="chevronRight" className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            </Card>

            {/* Arrow pointer */}
            {targetRect && step.position !== 'center' && (
              <div
                className={cn(
                  "absolute w-0 h-0",
                  step.position === 'top' && "bottom-[-8px] left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-white",
                  step.position === 'bottom' && "top-[-8px] left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white",
                  step.position === 'left' && "right-[-8px] top-1/2 -translate-y-1/2 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[8px] border-l-white",
                  step.position === 'right' && "left-[-8px] top-1/2 -translate-y-1/2 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[8px] border-r-white",
                  !step.position && "top-[-8px] left-1/2 -translate-x-1/2 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[8px] border-b-white"
                )}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Portal to render at document root
  if (typeof document !== 'undefined') {
    return createPortal(tourContent, document.body);
  }

  return null;
}

// Contextual hint component for subtle guidance
export function ContextualHint({
  children,
  hint,
  position = 'top'
}: {
  children: ReactNode;
  hint: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "absolute z-50 px-2 py-1 text-xs bg-gray-900 text-white rounded whitespace-nowrap",
              position === 'top' && "bottom-full left-1/2 -translate-x-1/2 mb-2",
              position === 'bottom' && "top-full left-1/2 -translate-x-1/2 mt-2",
              position === 'left' && "right-full top-1/2 -translate-y-1/2 mr-2",
              position === 'right' && "left-full top-1/2 -translate-y-1/2 ml-2"
            )}
          >
            {hint}
            <div
              className={cn(
                "absolute w-0 h-0",
                position === 'top' && "top-full left-1/2 -translate-x-1/2 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-gray-900",
                position === 'bottom' && "bottom-full left-1/2 -translate-x-1/2 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[4px] border-b-gray-900",
                position === 'left' && "left-full top-1/2 -translate-y-1/2 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[4px] border-l-gray-900",
                position === 'right' && "right-full top-1/2 -translate-y-1/2 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-r-[4px] border-r-gray-900"
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// CSS for highlighting elements during tour
export const tourStyles = `
  .tour-highlight {
    position: relative;
    z-index: 9997 !important;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4) !important;
    border-radius: 8px !important;
  }

  .tour-highlight * {
    position: relative;
    z-index: 9997 !important;
  }
`;