import { useMemo, useState } from "react";
import { buildVoiceOpsPlan, executeVoiceOpsPlan, VOICE_OPS_SKILLS, type VoiceOpsPlan, type VoiceOpsReceipt, type VoiceOpsSkillId } from "../../lib/voiceOpsPolicy";
import "../../styles/voice-ops.css";

type VoiceOpsRoomProps = {
  serverId: string | null;
  serverName: string | null;
};

export function VoiceOpsRoom({ serverId, serverName }: VoiceOpsRoomProps) {
  const [skillId, setSkillId] = useState<VoiceOpsSkillId>("workspace.status");
  const [command, setCommand] = useState("Покажи безопасный статус workspace");
  const [plan, setPlan] = useState<VoiceOpsPlan | null>(null);
  const [approved, setApproved] = useState(false);
  const [killSwitch, setKillSwitch] = useState(true);
  const [receipt, setReceipt] = useState<VoiceOpsReceipt | null>(null);
  const workspaceName = serverName?.trim() || "Eclipse Chat";
  const selectedSkill = useMemo(() => VOICE_OPS_SKILLS.find((skill) => skill.id === skillId) ?? VOICE_OPS_SKILLS[0], [skillId]);

  const resetResult = () => {
    setPlan(null);
    setApproved(false);
    setReceipt(null);
    setKillSwitch(true);
  };

  const selectSkill = (nextSkill: VoiceOpsSkillId) => {
    setSkillId(nextSkill);
    resetResult();
  };

  if (!serverId) {
    return <main className="ec-voice-ops ec-voice-ops--centered"><section><p className="ec-voice-ops__eyebrow">Voice Ops</p><h1>Выберите workspace</h1><p>Команды привязаны к выбранному пространству и не смешивают его контекст с другими workspace.</p></section></main>;
  }

  const createPlan = () => {
    setPlan(buildVoiceOpsPlan(command, skillId));
    setApproved(false);
    setReceipt(null);
    setKillSwitch(true);
  };

  const execute = () => {
    if (!plan || !approved || killSwitch) return;
    setReceipt(executeVoiceOpsPlan(plan, workspaceName));
    setKillSwitch(true);
  };

  const stage = receipt ? 4 : approved ? 3 : plan ? 2 : 1;

  return (
    <main className="ec-voice-ops" aria-labelledby="voice-ops-title">
      <header className="ec-voice-ops__header">
        <div>
          <p className="ec-voice-ops__eyebrow">{workspaceName} · Sentinel handoff</p>
          <h1 id="voice-ops-title">Voice Command Room</h1>
          <p>Сначала plan и diff. Execute доступен только для read-only навыка после явного approval.</p>
        </div>
        <button type="button" className="ec-voice-ops__stop" data-active={killSwitch} aria-pressed={killSwitch} onClick={() => setKillSwitch((value) => !value)}>
          <strong>{killSwitch ? "STOP включён" : "Read-only разблокирован"}</strong>
          <span>{killSwitch ? "Выполнение запрещено" : "Только до одного receipt"}</span>
        </button>
      </header>

      <section className="ec-voice-ops__telemetry" aria-label="Состояние voice-контура">
        <div><span>Микрофон</span><strong>Не запрошен</strong></div>
        <div><span>Динамик</span><strong>Без звука</strong></div>
        <div><span>STT / TTS</span><strong>Не аттестованы</strong></div>
        <div><span>Sentinel bridge</span><strong data-state="offline">Не подключён</strong></div>
      </section>

      <section className="ec-voice-ops__notice" role="status"><strong>Read-only по умолчанию</strong><span>Команда выполняется локально в UI. Chat не обращается к localhost, shell, filesystem или secrets.</span></section>

      <div className="ec-voice-ops__workspace">
        <aside className="ec-voice-ops__skills" aria-label="Разрешённые навыки">
          <div className="ec-voice-ops__section-head"><div><span>Allowlist</span><h2>Разрешённые навыки</h2></div><strong>{VOICE_OPS_SKILLS.length}</strong></div>
          {VOICE_OPS_SKILLS.map((skill) => <button key={skill.id} type="button" data-active={skill.id === skillId} aria-pressed={skill.id === skillId} onClick={() => selectSkill(skill.id)}><strong>{skill.label}</strong><span>{skill.description}</span></button>)}
          <div className="ec-voice-ops__blocked"><strong>Заблокировано</strong><span>shell · write files · install · deploy · secrets</span></div>
        </aside>

        <section className="ec-voice-ops__command" aria-label="Безопасная команда">
          <ol className="ec-voice-ops__steps" aria-label="Этапы команды">
            {["Команда", "План", "Approval", "Receipt"].map((label, index) => <li key={label} data-state={stage > index + 1 ? "done" : stage === index + 1 ? "active" : "waiting"}><i>{stage > index + 1 ? "✓" : index + 1}</i><span>{label}</span></li>)}
          </ol>
          <label htmlFor="voice-ops-command">Команда</label>
          <textarea id="voice-ops-command" value={command} maxLength={500} onChange={(event) => { setCommand(event.target.value); resetResult(); }} />
          <div className="ec-voice-ops__meta"><span>{selectedSkill.id}</span><span>без side effects</span></div>

          {plan && <div className="ec-voice-ops__plan"><div><strong>План</strong><ul>{plan.steps.map((step) => <li key={step}>{step}</li>)}</ul></div><div><strong>Diff до запуска</strong><ul>{plan.diff.map((item) => <li key={item}>{item}</li>)}</ul></div></div>}
          {receipt && <div className="ec-voice-ops__receipt" role="status"><strong>Receipt · {receipt.title}</strong><pre>{receipt.lines.join("\n")}</pre><span>Kill switch снова включён.</span></div>}

          <div className="ec-voice-ops__actions">
            {!plan && <button type="button" className="ec-btn ec-btn--primary" disabled={!command.trim()} onClick={createPlan}>Собрать plan и diff</button>}
            {plan && !approved && <button type="button" className="ec-btn ec-btn--primary" onClick={() => setApproved(true)}>Подтвердить read-only plan</button>}
            {plan && approved && !receipt && <button type="button" className="ec-btn ec-btn--primary" disabled={killSwitch} onClick={execute}>{killSwitch ? "Сначала отключите STOP" : "Выполнить read-only команду"}</button>}
            {receipt && <button type="button" className="ec-btn" onClick={resetResult}>Новая команда</button>}
            <span>{killSwitch ? "Kill switch блокирует execute." : "Разблокировка действует до receipt."}</span>
          </div>
        </section>
      </div>
    </main>
  );
}
