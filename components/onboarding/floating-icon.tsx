'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FloatingIconProps {
    children: React.ReactNode;
    delay?: number;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function FloatingIcon({ children, delay = 0, className, size = 'md' }: FloatingIconProps) {
    const sizeStyles = {
        sm: 'w-12 h-12 text-xl',
        md: 'w-16 h-16 text-2xl',
        lg: 'w-20 h-20 text-3xl',
    };

    return (
        <motion.div
            className={cn(
                'relative flex items-center justify-center rounded-2xl bg-muted/50 border border-border',
                sizeStyles[size],
                className
            )}
            initial={{ opacity: 0, y: 20 }}
            animate={{
                opacity: 1,
                y: [0, -10, 0],
            }}
            transition={{
                opacity: { duration: 0.6, delay },
                y: {
                    duration: 3,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay,
                },
            }}
        >
            {/* Icon */}
            <div className="relative z-10 text-primary">{children}</div>
        </motion.div>
    );
}
