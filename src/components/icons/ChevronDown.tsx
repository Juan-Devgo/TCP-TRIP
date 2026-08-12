import { cn } from '@/lib/utils';

interface ChevronDownProps {
  className?: string
}

export function ChevronDown({ className }: ChevronDownProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={cn('w-6 h-6', className)}
    >
      <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
    </svg>
  );
}
