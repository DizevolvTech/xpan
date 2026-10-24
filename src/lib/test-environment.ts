/**
 * Sistema de teste do cliente (reunião 22/10): cópia do banco de produção servida em
 * `preview-xpan.dizevolv.com`. A faixa de aviso depende só do endereço, para nunca
 * aparecer na produção nem sumir do teste por configuração esquecida.
 */
export function isTestEnvironmentHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const host = hostname.toLowerCase();
  return host.startsWith("preview-") || host.startsWith("teste-") || host.startsWith("test-");
}
