'use client';

import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnimatedButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
    iconPosition?: 'left' | 'right';
}

export function AnimatedButton({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconPosition = 'right',
    className,
    disabled,
    ...props
}: AnimatedButtonProps) {
    const baseStyles = 'relative inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-300 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden';

    const variantStyles = {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/90 border border-border',
        ghost: 'text-foreground hover:bg-muted',
    };

    const sizeStyles = {
        sm: 'px-4 py-2 text-sm',
        md: 'px-6 py-3 text-base',
        lg: 'px-8 py-4 text-lg',
    };

    return (
        <motion.button
            className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
            disabled={disabled || loading}
            whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
            whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            {...props}
        >
            {/* Content */}
            <div className="relative flex items-center gap-2">
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <>
                        {icon && iconPosition === 'left' && icon}
                        {children}
                        {icon && iconPosition === 'right' && icon}
                    </>
                )}
            </div>
        </motion.button>
    );
}
