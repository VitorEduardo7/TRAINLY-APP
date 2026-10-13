import { RefObject, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardEvent, LayoutAnimation, Platform, ScrollView, TextInput, View } from 'react-native';

/**
 * Quanto o teclado está cobrindo de um container, em pixels — o quanto ele
 * precisa "subir" (via `paddingBottom`) pra ficar inteiro acima do teclado.
 *
 * Por que não o `KeyboardAvoidingView` do React Native: ele calcula a
 * sobreposição com a posição do container RELATIVA AO PAI, não à tela. Dentro
 * de um `<Modal>` e de telas com área segura essa conta sai errada — era isso
 * que fazia a janela de "Registrar atividade" e o login sumirem da tela ao
 * tocar num campo (o padding calculado ficava bem maior que o teclado). Aqui a
 * conta é feita com a posição real na tela (`measureInWindow`) contra o topo
 * real do teclado, e o resultado nunca passa de 80% da altura do container —
 * mesmo que o sistema mande um evento estranho (o preenchimento automático de
 * senha / Face ID do iPhone manda alguns), a tela nunca some.
 *
 * Funciona igual nos dois sistemas: no Android (que hoje roda "de ponta a
 * ponta", sem a janela encolher sozinha com o teclado) a conta dá a altura do
 * teclado; se algum aparelho ainda encolher a janela, o container encolhe
 * junto e a sobreposição medida vira 0 — sem empurrar duas vezes.
 */
export function useKeyboardLift(containerRef: RefObject<View | null>, options?: { enabled?: boolean }): number {
  const enabled = options?.enabled ?? true;
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);

  useEffect(() => {
    const ios = Platform.OS === 'ios';

    const apply = (next: number, e?: KeyboardEvent) => {
      const rounded = Math.round(next);
      if (Math.abs(liftRef.current - rounded) < 1) return;
      liftRef.current = rounded;
      // No iOS o teclado avisa ANTES de aparecer, com a duração da animação
      // dele — então a tela sobe junto, no mesmo ritmo, em vez de pular.
      if (ios && e && e.duration > 0) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { duration: e.duration, type: LayoutAnimation.Types.keyboard },
        });
      }
      setLift(rounded);
    };

    if (!enabled) {
      apply(0);
      return;
    }

    const onChange = (e: KeyboardEvent) => {
      const kb = e.endCoordinates;
      // Alguns modos de acessibilidade do iOS mandam altura 0 ao esconder.
      if (!kb || kb.height <= 0) {
        apply(0, e);
        return;
      }
      const node = containerRef.current;
      if (!node) return;
      node.measureInWindow((_x, y, _w, h) => {
        if (!h) return;
        const overlap = y + h - kb.screenY;
        apply(Math.max(0, Math.min(overlap, h * 0.8)), e);
      });
    };
    const onHide = (e: KeyboardEvent) => apply(0, e);

    const subs = ios
      ? [Keyboard.addListener('keyboardWillChangeFrame', onChange), Keyboard.addListener('keyboardWillHide', onHide)]
      : [Keyboard.addListener('keyboardDidShow', onChange), Keyboard.addListener('keyboardDidHide', onHide)];

    // Teclado já aberto quando a tela montou (ex: veio direto de outro campo).
    const metrics = Keyboard.isVisible() ? Keyboard.metrics() : undefined;
    if (metrics) {
      onChange({ endCoordinates: metrics, startCoordinates: metrics, duration: 0, easing: 'keyboard', isEventFromThisApp: true });
    }

    return () => subs.forEach((s) => s.remove());
  }, [containerRef, enabled]);

  return enabled ? lift : 0;
}

/**
 * Rola um `ScrollView` até o campo que está com o cursor ficar inteiro à
 * vista (com uma folga), se ele estiver escondido embaixo ou em cima. Usado
 * depois que a janela sobe com o teclado: o espaço visível diminui e o campo
 * tocado podia ficar logo abaixo da borda.
 */
export function scrollFocusedIntoView(
  scroll: ScrollView | null,
  viewport: View | null,
  scrollY: number,
  margin = 20,
) {
  const input = TextInput.State.currentlyFocusedInput?.();
  if (!input || !scroll || !viewport) return;
  viewport.measureInWindow((_vx, vy, _vw, vh) => {
    input.measureInWindow((_ix, iy, _iw, ih) => {
      if (!vh || !ih) return;
      const hiddenBelow = iy + ih + margin - (vy + vh);
      const hiddenAbove = vy + margin - iy;
      if (hiddenBelow > 0) scroll.scrollTo({ y: scrollY + hiddenBelow, animated: true });
      else if (hiddenAbove > 0) scroll.scrollTo({ y: Math.max(0, scrollY - hiddenAbove), animated: true });
    });
  });
}
