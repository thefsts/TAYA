import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"

const SPINNER_CLASSES = {
  root: "size-4 animate-spin",
} as const

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Loading"
      className={cn(SPINNER_CLASSES.root, className)}
      {...props}
    />
  )
}

export { Spinner }
