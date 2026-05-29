import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"
import { disabledField, focusRing2 } from "@/lib/design-tokens"

const SWITCH_CLASSES = {
  root: `peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors ${focusRing2} focus-visible:ring-offset-background ${disabledField} data-[state=checked]:bg-primary data-[state=unchecked]:bg-input`,
  thumb: "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0",
} as const

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(SWITCH_CLASSES.root, className)}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb className={cn(SWITCH_CLASSES.thumb)} />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
