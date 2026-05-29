export const focusRing1 = "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"

export const focusRing2 = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

export const disabledField = "disabled:cursor-not-allowed disabled:opacity-50"

export const disabledInteractive = "disabled:pointer-events-none disabled:opacity-50"

export const overlayBase = "fixed inset-0 z-50 bg-black/80"

export const animateInOut = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"

export const zoomInOut95 = "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"

export const sideSlideIn = "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"

export const popupAnimations = `${animateInOut} ${zoomInOut95} ${sideSlideIn}`

export const dialogContentBase = "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg"

export const menuSubContentBase = "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"

export const menuItemFocusDisabled = "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"

export const menuIndicatorSpan = "absolute left-2 flex h-3.5 w-3.5 items-center justify-center"

export const menuLabel = "px-2 py-1.5 text-sm font-semibold"

export const menuSeparator = "-mx-1 my-1 h-px bg-muted"

export const menuShortcutBase = "ml-auto text-xs tracking-widest"

export const mutedText = "text-muted-foreground"

export const descriptionText = "text-sm text-muted-foreground"

export const headingTracking = "leading-none tracking-tight"

export const titleBase = `text-lg font-semibold ${headingTracking}`

export const iconSm = "h-4 w-4"

export const bgMuted = "bg-muted"

export const cursorNotAllowed = "disabled:cursor-not-allowed"

export const flexCenter = "flex items-center justify-center"
