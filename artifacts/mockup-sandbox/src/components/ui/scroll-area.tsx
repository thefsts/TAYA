import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const SCROLL_AREA_CLASSES = {
  root: "relative overflow-hidden",
  viewport: "h-full w-full rounded-[inherit]",
  scrollbar: "flex touch-none select-none transition-colors",
  scrollbarVertical: "h-full w-2.5 border-l border-l-transparent p-[1px]",
  scrollbarHorizontal: "h-2.5 flex-col border-t border-t-transparent p-[1px]",
  thumb: "relative flex-1 rounded-full bg-border",
} as const

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn(SCROLL_AREA_CLASSES.root, className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className={SCROLL_AREA_CLASSES.viewport}>
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      SCROLL_AREA_CLASSES.scrollbar,
      orientation === "vertical" && SCROLL_AREA_CLASSES.scrollbarVertical,
      orientation === "horizontal" && SCROLL_AREA_CLASSES.scrollbarHorizontal,
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className={SCROLL_AREA_CLASSES.thumb} />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }
