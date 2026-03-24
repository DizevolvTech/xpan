"use client";

import { PageLayout } from "@/components/shared/page-layout";
import { TenantSupportOccurrenceWorkspace } from "@/components/support/tenant-support-occurrence-workspace";

export default function AdministradorOcorrenciasPage() {
  return (
    <PageLayout
      title="Canal com o Sistema"
      description="Abra ocorrências administrativas, acompanhe a resposta do Master e confirme quando o caso estiver resolvido."
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
        description="Use este canal para tratar cadastro de usuários, recuperação de acesso, inativação/reativação e ajustes operacionais com o time Master."
      />
    </PageLayout>
  );
}
