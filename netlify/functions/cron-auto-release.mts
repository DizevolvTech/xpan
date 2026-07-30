/**
 * Liberação automática dos pedidos elegíveis (AJ-A6.2).
 *
 * Porta o agendamento que estava em `vercel.json` e NUNCA rodou aqui — a Netlify ignora
 * aquele arquivo.
 *
 * ⚠️ O cron da Netlify é avaliado em UTC. A expressão nasceu como `0 20 * * *`, herdada do
 * `vercel.json` — 20:00 UTC = **17:00 em Brasília**, ANTES do corte de pedidos das 18:00, ou
 * seja, a liberação automática rodava enquanto as lojas ainda podiam pedir e os pedidos da
 * última hora ficavam de fora do lote. Cliente decidiu em 30/07: roda 18:00 BRT, logo após o
 * corte, com o dia já fechado. Daí `0 21 * * *`.
 *
 * O Brasil não tem mais horário de verão, então UTC-3 é fixo o ano todo e a expressão não
 * precisa de ajuste sazonal. Se o corte das 18:00 mudar, esta expressão muda junto.
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

const runAutoRelease = async () => {
  await triggerCronRoute("/api/cron/auto-release");
};

export default runAutoRelease;

export const config = {
  // 21:00 UTC = 18:00 BRT, logo após o corte de pedidos. Ver o cabeçalho do arquivo.
  schedule: "0 21 * * *",
};
