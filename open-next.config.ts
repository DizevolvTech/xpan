import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Hospedagem na Cloudflare Workers (rota institucional Dizevolv). Sem cache incremental
// persistente: as paginas do Xpan sao dinamicas (sessao por usuario).
export default defineCloudflareConfig();
