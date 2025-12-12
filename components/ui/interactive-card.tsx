'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InteractiveCardProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    selected?: boolean;
    onClick?: () => void;
    className?: string;
    children?: React.ReactNode;
    disabled?: boolean;
}

export function InteractiveCard({
    title,
    description,
    icon,
    selected = false,
    onClick,
    className,
    children,
    disabled = false,
}: InteractiveCardProps) {
    return (
        <motion.div
            className={cn(
                'relative group cursor-pointer rounded-2xl p-6 transition-all duration-300',
                'bg-card border border-border',
                'hover:border-primary/50 hover:shadow-lg',
                selected && 'border-primary shadow-lg bg-primary/5',
                disabled && 'opacity-50 cursor-not-allowed hover:border-border',
                className
            )}
            onClick={disabled ? undefined : onClick}
            whileHover={disabled ? {} : { y: -4, transition: { duration: 0.2 } }}
            whileTap={disabled ? {} : { scale: 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        >
            {/* Selection indicator */}
            <motion.div
                className={cn(
                    'absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300',
                    selected
                        ? 'bg-primary text-primary-foreground shadow-lg'
                        : 'bg-muted border border-border'
                )}
                initial={false}
                animate={{
                    scale: selected ? 1 : 0.9,
                }}
                transition={{ duration: 0.3 }}
            >
                {selected && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                    >
                        <Check className="w-4 h-4" />
                    </motion.div>
                )}
            </motion.div>

            {/* Icon */}
            {icon && (
                <div
                    className={cn(
                        'mb-4 inline-flex p-3 rounded-xl transition-all duration-300',
                        selected
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary'
                    )}
                >
                    {icon}
                </div>
            )}

            {/* Content */}
            <div className="relative">
                <h3 className={cn(
                    'text-lg font-semibold mb-2 transition-colors duration-300',
                    selected ? 'text-foreground' : 'text-foreground/90'
                )}>
                    {title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
                {children && <div className="mt-4">{children}</div>}
            </div>
        </motion.div>
    );
}
