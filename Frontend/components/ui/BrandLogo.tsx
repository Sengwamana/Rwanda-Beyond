import React from 'react';
import { Sprout } from 'lucide-react';
import { cn } from '../../utils/cn';

interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  compact?: boolean;
  variant?: 'navbar' | 'sidebar';
}

const variantClasses: Record<NonNullable<BrandLogoProps['variant']>, { wrapper: string; mark: string; text: string }> = {
  navbar: {
    wrapper: 'gap-2',
    mark: 'rounded-lg p-1.5',
    text: 'text-lg',
  },
  sidebar: {
    wrapper: 'w-full min-w-0 gap-2.5',
    mark: 'rounded-lg p-1.5',
    text: 'text-lg',
  },
};

export function BrandLogo({
  compact = false,
  variant = 'navbar',
  className,
  ...props
}: BrandLogoProps) {
  const selectedVariant = variantClasses[variant];

  return (
    <div
      className={cn(
        'flex items-center',
        compact ? 'justify-center' : selectedVariant.wrapper,
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'shrink-0 bg-primary text-primary-foreground shadow-[0_16px_30px_-24px_rgba(15,81,50,0.7)]',
          compact ? 'rounded-lg p-1.5' : selectedVariant.mark
        )}
      >
        <Sprout className="fill-current" size={20} />
      </div>
      {!compact && (
        <span
          className={cn(
            'min-w-0 truncate font-bold tracking-tight leading-none text-primary',
            selectedVariant.text
          )}
        >
          RwandaBeyond
        </span>
      )}
    </div>
  );
}

export default BrandLogo;
