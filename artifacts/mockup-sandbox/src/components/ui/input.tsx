import * as React from "react"

import { cn } from "@/lib/utils"
import { disabledField, focusRing1 } from "@/lib/design-tokens"

const INPUT_CLASSES = {
  root: `flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground ${focusRing1} ${disabledField} md:text-sm`,
} as const

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(INPUT_CLASSES.root, className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
