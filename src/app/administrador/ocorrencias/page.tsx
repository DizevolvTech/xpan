"use client";

import { PageLayout } from "@/components/shared/page-layout";
import { TenantSupportOccurrenceWorkspace } from "@/components/support/tenant-support-occurrence-workspace";

export default function AdministradorOcorrenciasPage() {
  return (
    <PageLayout
      title="Canal com o Sistema"
      description="Ocorrências administrativas com o time Master."
      badge="Administrador"
      breadcrumbs={[
        { label: "Administrador", href: "/administrador" },
        { label: "Canal com o Sistema" },
      ]}
    >
      <TenantSupportOccurrenceWorkspace
        apiBasePath="/api/admin/support-occurrences"
        mode="tenant"
        title="Ocorrências administrativas"
        description="Acesso, usuários, reativação e ajustes operacionais."
      />
    </PageLayout>
  );
}
