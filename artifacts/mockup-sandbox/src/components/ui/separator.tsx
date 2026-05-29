import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"

import { cn } from "@/lib/utils"

const SEPARATOR_CLASSES = {
  base: "shrink-0 bg-border",
  horizontal: "h-[1px] w-full",
  vertical: "h-full w-[1px]",
} as const

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        SEPARATOR_CLASSES.base,
        orientation === "horizontal" ? SEPARATOR_CLASSES.horizontal : SEPARATOR_CLASSES.vertical,
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
