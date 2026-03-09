"use client";

import { motion } from "framer-motion";

import { PageContainer } from "@/components/layout/page-container";
import { PageHero, type PageHeroProps } from "@/components/shared/page-hero";

interface PageLayoutProps extends PageHeroProps {
  children: React.ReactNode;
  contentClassName?: string;
}

export function PageLayout({
  children,
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className,
  contentClassName,
}: PageLayoutProps) {
  return (
    <PageContainer className={className}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <PageHero
          title={title}
          description={description}
          badge={badge}
          actions={actions}
          breadcrumbs={breadcrumbs}
        />
      </motion.div>

      <motion.div
        className={contentClassName ?? "mt-6 space-y-6"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </PageContainer>
  );
}

export { KPICard } from "@/components/shared/kpi-card";
