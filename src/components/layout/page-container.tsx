import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main
      className={cn(
        // Reunião 22/10 (bloco 3): usa a largura do monitor (limite só em telas muito largas).
        "mx-auto w-full max-w-[2000px] px-3 py-5 sm:px-5 lg:px-6 lg:py-6",
        className,
      )}
    >
      {children}
    </main>
  );
}
