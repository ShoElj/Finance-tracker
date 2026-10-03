import { cn } from "@/lib/utils";
import { DemoBanner, Header } from "./Header";

export function PageShell({
  children,
  className,
  headerRight,
  wide = false,
}: {
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <Header right={headerRight} />
      <main className={cn("mx-auto w-full flex-1 px-4 pb-10", wide ? "max-w-6xl" : "max-w-2xl", className)}>{children}</main>
    </div>
  );
}
