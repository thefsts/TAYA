import * as React from "react"

import { cn } from "@/lib/utils"
import { disabledField, focusRing1 } from "@/lib/design-tokens"

const TEXTAREA_CLASSES = {
  root: `flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground ${focusRing1} ${disabledField} md:text-sm`,
} as const

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(TEXTAREA_CLASSES.root, className)}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
