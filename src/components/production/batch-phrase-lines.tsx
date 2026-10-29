/**
 * Frase de batidas da OP em linhas curtas (cartão #42): "7/8 batidas", "7 cheias de 212 Un",
 * "+ 1 parcial de 206 Un". No celular a coluna Produto fica estreita e a frase inteira
 * numa linha era cortada pela tabela; cada parte em sua linha cabe sem rolar de lado.
 */
export function BatchPhraseLines({ done, count, phrase }: { done: number; count: number; phrase: string }) {
  const parts = phrase.split(" + ");
  return (
    <span className="block max-w-[16rem] whitespace-normal">
      <span className="block">
        {done}/{count} batidas
      </span>
      {parts.map((part, index) => (
        <span key={`${index}-${part}`} className="block">
          {index > 0 ? `+ ${part}` : part}
        </span>
      ))}
    </span>
  );
}
