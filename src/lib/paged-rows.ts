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

/** Páginas pedidas ao mesmo tempo depois da primeira (leitura especulativa; sobra vazia é barata). */
const PARALLEL_PAGES = 3;

export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = SUPABASE_PAGE_SIZE,
): Promise<{ data: T[]; error: null } | { data: null; error: { message: string } }> {
  // A 1ª página decide se a tabela cabe numa leitura só (caso comum: 1 ida ao banco).
  const first = await fetchPage(0, pageSize - 1);
  if (first.error) {
    return { data: null, error: first.error };
  }
  const rows: T[] = [...(first.data ?? [])];
  if (rows.length < pageSize) {
    return { data: rows, error: null };
  }
  // Tabela grande: as páginas seguintes saem em janelas paralelas (antes eram uma a uma, cada
  // uma esperando a ida e volta ao banco). A ordem das linhas é a da página, não a da resposta.
  for (let next = pageSize; ; next += pageSize * PARALLEL_PAGES) {
    const window = await Promise.all(
      Array.from({ length: PARALLEL_PAGES }, (_, index) => {
        const from = next + index * pageSize;
        return fetchPage(from, from + pageSize - 1);
      }),
    );
    for (const result of window) {
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
}
