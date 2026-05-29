import { cn } from "@/lib/utils"
import { mutedText } from "@/lib/design-tokens"

const KBD_CLASSES = {
  root: `bg-muted ${mutedText} pointer-events-none inline-flex h-5 w-fit min-w-5 select-none items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium [&_svg:not([class*='size-'])]:size-3 [[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10`,
  group: "inline-flex items-center gap-1",
} as const

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(KBD_CLASSES.root, className)}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn(KBD_CLASSES.group, className)}
      {...props}
    />
  )
}

export { Kbd, KbdGroup }
