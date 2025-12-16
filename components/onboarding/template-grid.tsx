'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Template } from '@/types/onboarding';

interface TemplateGridProps {
    templates: Template[];
    selectedTemplate: Template | null;
    onSelect: (template: Template) => void;
}

export function TemplateGrid({ templates, selectedTemplate, onSelect }: TemplateGridProps) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template, index) => {
                const isSelected = selectedTemplate?.id === template.id;

                return (
                    <motion.div
                        key={template.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.4 }}
                        className={cn(
                            'relative group cursor-pointer rounded-2xl p-6 transition-all duration-300 overflow-hidden',
                            'bg-card/30 backdrop-blur-sm border border-border/40',
                            'hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10',
                            isSelected && 'border-purple-500 bg-purple-500/5 shadow-xl shadow-purple-500/20'
                        )}
                        onClick={() => onSelect(template)}
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        {/* Background Shimmer Effect */}
                        {isSelected && (
                            <motion.div
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent"
                                initial={{ x: '-100%' }}
                                animate={{ x: '200%' }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                            />
                        )}

                        {/* Selection Indicator */}
                        <motion.div
                            className={cn(
                                'absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 z-10',
                                isSelected
                                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 shadow-lg shadow-purple-500/40'
                                    : 'bg-muted/30 border border-border/40'
                            )}
                            animate={{
                                scale: isSelected ? 1 : 0.9,
                                rotate: isSelected ? 360 : 0,
                            }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                        >
                            {isSelected && (
                                <motion.svg
                                    className="w-3 h-3 text-white"
                                    viewBox="0 0 12 12"
                                    fill="none"
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ duration: 0.3, delay: 0.1 }}
                                >
                                    <motion.path
                                        d="M2 6L5 9L10 3"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </motion.svg>
                            )}
                        </motion.div>

                        {/* Icon */}
                        <motion.div
                            className={cn(
                                'mb-4 text-4xl transition-all duration-300',
                                isSelected ? 'scale-110 drop-shadow-lg' : 'group-hover:scale-105'
                            )}
                            animate={isSelected ? { y: [0, -4, 0] } : {}}
                            transition={{ duration: 0.6, repeat: isSelected ? Infinity : 0 }}
                        >
                            {template.icon}
                        </motion.div>

                        {/* Content */}
                        <div className="relative z-10">
                            <h3 className={cn(
                                'text-lg font-semibold mb-2 transition-colors duration-300',
                                isSelected ? 'text-foreground' : 'text-foreground/90'
                            )}>
                                {template.name}
                            </h3>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {template.description}
                            </p>
                        </div>

                        {/* Hover Glow */}
                        <motion.div
                            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-500/0 via-blue-500/0 to-pink-500/0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 pointer-events-none"
                            initial={false}
                        />
                    </motion.div>
                );
            })}
        </div>
    );
}
