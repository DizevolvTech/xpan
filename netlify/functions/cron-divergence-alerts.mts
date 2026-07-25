/**
 * Abertura automática de ocorrências a partir dos alertas de divergência.
 *
 * Porta o agendamento que estava em `vercel.json` e NUNCA rodou aqui. De hora em hora, como na
 * configuração original (`0 * * * *`, UTC — de hora em hora é o mesmo em qualquer fuso).
 *
 * A rota é idempotente: dedup por marcador `[auto:<alertId>@<data>]` na descrição. Verificado
 * ao vivo em 24/07 — 5 alertas detectados, 5 ocorrências criadas na 1ª execução, 0 criadas e 5
 * deduplicadas na 2ª.
 */
/**
 * Dispara a rota de cron do app.
 *
 * DUPLICADO DE PROPÓSITO nas duas Scheduled Functions em vez de virar módulo compartilhado:
 * um import relativo entre arquivos `.mts` depende de como o bundler da Netlify resolve a
 * extensão, e isso não é verificável aqui. Se resolvesse errado, a função quebraria em
 * silêncio — que é exatamente o modo de falha que este arquivo existe para corrigir. São 25
 * linhas; a duplicação custa menos que o risco.
 *
 * A URL NÃO é hardcoded: `URL` é uma variável read-only que a Netlify injeta em runtime com o
 * endereço principal do site, então funciona em qualquer site/branch sem configuração.
 *
 * `CRON_SECRET` PRECISA estar nas variáveis de ambiente do site — sem ela a rota responde 503
 * e o agendamento falha em silêncio, que é o estado de hoje.
 */
async function triggerCronRoute(path: string) {
  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl) {
    console.error(`[cron] URL ausente no ambiente — ${path} não foi disparado.`);
    return;
  }
  if (!cronSecret) {
    console.error(
      `[cron] CRON_SECRET não configurada — ${path} responderia 503. ` +
        "Configure em Site settings → Environment variables.",
    );
    return;
  }

  const started = Date.now();
  try {
    const response = await fetch(new URL(path, siteUrl), {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const elapsedMs = Date.now() - started;
    // Scheduled Function não devolve response body, então o log É o registro de auditoria.
    const body = await response.text();

    if (!response.ok) {
      console.error(`[cron] ${path} falhou (${response.status}, ${elapsedMs}ms): ${body}`);
      return;
    }
    console.log(`[cron] ${path} ok (${elapsedMs}ms): ${body}`);
  } catch (error) {
    console.error(`[cron] ${path} lançou exceção após ${Date.now() - started}ms:`, error);
  }
}

const runDivergenceAlerts = async () => {
  await triggerCronRoute("/api/cron/divergence-alerts");
};

export default runDivergenceAlerts;

export const config = {
  schedule: "0 * * * *",
};
