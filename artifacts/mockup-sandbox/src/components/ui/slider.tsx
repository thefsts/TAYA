import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"
import { disabledInteractive, focusRing1 } from "@/lib/design-tokens"

const SLIDER_CLASSES = {
  root: "relative flex w-full touch-none select-none items-center",
  track: "relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20",
  range: "absolute h-full bg-primary",
  thumb: `block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors ${focusRing1} ${disabledInteractive}`,
} as const

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(SLIDER_CLASSES.root, className)}
    {...props}
  >
    <SliderPrimitive.Track className={SLIDER_CLASSES.track}>
      <SliderPrimitive.Range className={SLIDER_CLASSES.range} />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className={SLIDER_CLASSES.thumb} />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
