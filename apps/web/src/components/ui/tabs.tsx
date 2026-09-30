import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";

/** M3 primary tabs: 48 px high, active tab in primary with a 3 px indicator. */
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("flex w-full items-stretch border-b border-outline-variant", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "state-layer relative inline-flex h-12 flex-1 cursor-pointer items-center justify-center gap-2 px-4 text-title-s whitespace-nowrap text-on-surface-variant outline-none disabled:pointer-events-none disabled:opacity-38 data-active:text-primary",
        "before:absolute before:inset-x-4 before:bottom-0 before:h-[3px] before:rounded-t-full before:bg-primary before:opacity-0 data-active:before:opacity-100",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-6",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
