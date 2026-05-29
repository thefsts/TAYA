import { cn } from "@/lib/utils"

const SKELETON_CLASSES = {
  root: "animate-pulse rounded-md bg-primary/10",
} as const

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(SKELETON_CLASSES.root, className)}
      {...props}
    />
  )
}

export { Skeleton }
