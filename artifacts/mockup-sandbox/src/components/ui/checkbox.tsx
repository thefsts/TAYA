import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { disabledField, focusRing1, iconSm } from "@/lib/design-tokens"

const CHECKBOX_CLASSES = {
  root: `grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow ${focusRing1} ${disabledField} data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground`,
  indicator: "grid place-content-center text-current",
  icon: iconSm,
} as const

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(CHECKBOX_CLASSES.root, className)}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn(CHECKBOX_CLASSES.indicator)}>
      <Check className={CHECKBOX_CLASSES.icon} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
