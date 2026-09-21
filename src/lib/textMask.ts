// ---------------------------------------------------------------------------
// Máscaras simples de texto pra campo de formulário. Hoje só tem a de data,
// usada em todo campo AAAA-MM-DD do app (RegisterActivityModal,
// CreateChallengeModal) — antes disso, digitar "20260720" ficava exatamente
// assim, sem traço nenhum, e o usuário tinha que digitar os traços na mão.
// ---------------------------------------------------------------------------

/**
 * Formata uma entrada de data enquanto o usuário digita, inserindo os
 * traços de AAAA-MM-DD sozinho. Ignora qualquer caractere que não seja
 * dígito (então colar "20/26-07-20" também vira "2026-07-20") e limita a
 * 8 dígitos (4 de ano, 2 de mês, 2 de dia).
 *
 * `previous` é o valor do campo antes dessa digitação (o `value` atual do
 * estado). Serve só pra um caso: apagar bem em cima de um traço tira só o
 * traço, e como ele é recalculado a partir dos dígitos (que continuam os
 * mesmos), a máscara recolocaria o mesmo traço no lugar — o backspace
 * pareceria não fazer nada. Quando detecta esse caso (apagou 1 caractere e
 * os dígitos continuam exatamente os mesmos), tira também o último dígito,
 * pra todo backspace sempre encurtar o campo de verdade.
 */
export function maskDateInput(raw: string, previous?: string): string {
  let digits = raw.replace(/\D/g, '');
  if (previous !== undefined && raw.length < previous.length) {
    const prevDigits = previous.replace(/\D/g, '');
    if (digits.length > 0 && digits === prevDigits) {
      digits = digits.slice(0, -1);
    }
  }
  digits = digits.slice(0, 8);
  if (digits.length > 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
  if (digits.length > 4) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}
