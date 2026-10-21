/**
 * Leitura PAGINADA de tabelas inteiras.
 *
 * O PostgREST do Supabase corta cada resposta em 1000 linhas por padrão, em silêncio: uma
 * tabela maior chega truncada, sem erro. As leituras "carrega tudo" do planejamento da fábrica
 * (pedidos, itens, estado do workflow) viravam dados faltando a partir de ~1000 linhas. Aqui
 * lemos em páginas até a última vir incompleta. O chamador deve ordenar por uma chave estável
 * (sem empate), senão linhas podem repetir ou sumir entre páginas.
 */

export const SUPABASE_PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const result = await fetchPage(from, from + pageSize - 1);
    if (result.error) {
      return { data: null, error: result.error };
    }
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < pageSize) {
      return { data: rows, error: null };
    }
  }
}
