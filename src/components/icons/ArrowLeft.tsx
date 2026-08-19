import { cn } from "@/lib/utils";

interface ArrowLeftProps {
  className?: string;
}

export function ArrowLeft({ className }: ArrowLeftProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 -960 960 960"
      fill="currentColor"
      className={cn('w-6 h-6', className)}
    >
      <path d="m313-440 224 224-57 56-320-320 320-320 57 56-224 224h487v80H313Z" />
    </svg>
  );
}
