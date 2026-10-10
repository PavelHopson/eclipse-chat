import { Modal } from "./Modal";
import { VoiceSettingsContent } from "./VoiceSettingsContent";

export function VoiceSettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Настройки голоса" onClose={onClose} width={520}>
      <VoiceSettingsContent />
    </Modal>
  );
}
