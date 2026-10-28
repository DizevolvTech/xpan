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
        // Quadro #7 (27/10): margem de cima menor — o conteúdo começa mais perto do topo.
        "mx-auto w-full max-w-[2000px] px-3 py-3 sm:px-5 lg:px-6 lg:py-3",
        className,
      )}
    >
      {children}
    </main>
  );
}
