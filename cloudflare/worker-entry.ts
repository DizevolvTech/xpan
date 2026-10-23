/**
 * Entrada do Worker na Cloudflare.
 *
 * Reaproveita o handler gerado pelo OpenNext (`.open-next/worker.js`) e acrescenta o
 * `scheduled`, que substitui as Scheduled Functions da Netlify (`netlify/functions/`).
 * O cron chama a propria rota de cron do app em memoria (sem sair para a rede), com o
 * mesmo header `Authorization: Bearer <CRON_SECRET>` que a rota exige.
 *
 * Agendamentos (UTC, o Brasil nao tem horario de verao):
 *  - `0 21 * * *` -> /api/cron/auto-release (18:00 BRT, logo apos o corte de pedidos)
 *  - `0 * * * *`  -> /api/cron/divergence-alerts (de hora em hora; rota idempotente)
 */
// Gerado pelo build do OpenNext (fora do tsconfig; o wrangler resolve no empacotamento).
import openNextWorker from "../.open-next/worker.js";

type Env = { CRON_SECRET?: string; APP_URL?: string } & Record<string, unknown>;

export const CRON_ROUTES: Record<string, string> = {
  "0 21 * * *": "/api/cron/auto-release",
  "0 * * * *": "/api/cron/divergence-alerts",
};

const worker = {
  fetch: openNextWorker.fetch,

  async scheduled(
    controller: { cron: string; scheduledTime: number },
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    const path = CRON_ROUTES[controller.cron];
    if (!path) {
      console.error(`[cron] expressao sem rota: ${controller.cron}`);
      return;
    }
    if (!env.CRON_SECRET) {
      console.error(`[cron] CRON_SECRET ausente; ${path} nao foi disparado.`);
      return;
    }
    const base = env.APP_URL || "https://xpan.invalid";
    const started = Date.now();
    const request = new Request(new URL(path, base), {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const response: Response = await openNextWorker.fetch(request, env, ctx);
    const body = await response.text();
    const line = `[cron] ${path} ${response.status} (${Date.now() - started}ms): ${body.slice(0, 2000)}`;
    if (response.ok) console.log(line);
    else console.error(line);
  },
};

export default worker;
