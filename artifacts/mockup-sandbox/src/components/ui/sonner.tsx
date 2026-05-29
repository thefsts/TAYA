"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

const SONNER_CLASSES = {
  toaster: "toaster group",
  toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
  description: "group-[.toast]:text-muted-foreground",
  actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
  cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
} as const

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={SONNER_CLASSES.toaster}
      toastOptions={{
        classNames: {
          toast: SONNER_CLASSES.toast,
          description: SONNER_CLASSES.description,
          actionButton: SONNER_CLASSES.actionButton,
          cancelButton: SONNER_CLASSES.cancelButton,
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
