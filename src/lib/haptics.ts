import * as Haptics from 'expo-haptics';

/**
 * Vibração leve de resposta ao toque. Sempre "silenciosa" em caso de erro:
 * aparelho sem motor de vibração, modo economia de bateria ou web — a
 * interface nunca pode quebrar por causa de um detalhe de acabamento.
 */
function safely(run: () => Promise<unknown>) {
  try {
    run().catch(() => {});
  } catch {
    // módulo nativo indisponível — ignora
  }
}

export function tapLight() {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function tapMedium() {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Troca de seleção (aba, chip, filtro). */
export function selection() {
  safely(() => Haptics.selectionAsync());
}

/** Algo deu certo (atividade salva, rota publicada). */
export function success() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Aviso antes de uma ação destrutiva (descartar corrida, apagar). */
export function warning() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
