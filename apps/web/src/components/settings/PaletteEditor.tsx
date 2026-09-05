import { useEffect, useState } from "react";
import type { AppearanceController } from "../../hooks/useAppearance";
import { DEFAULT_PALETTE, PALETTE_KEYS, PALETTE_PRESETS, normalizeHex, paletteError, type Palette } from "../../lib/appearance";
import "../../styles/appearance.css";

const LABELS: Record<keyof Palette, string> = {
  accent: "Основной акцент", secondary: "Второй акцент", background: "Фон приложения",
  surface: "Панели и карточки", text: "Основной текст", border: "Линии и границы",
};

export function PaletteEditor({ appearance: a }: { appearance: AppearanceController }) {
  const [draft, setDraft] = useState<Palette | null>(a.saved);
  const [dirty, setDirty] = useState(false);
  const [success, setSuccess] = useState(false);
  const colors = draft ?? DEFAULT_PALETTE;
  const validation = draft ? paletteError(draft) : null;
  useEffect(() => { if (!dirty) setDraft(a.saved); }, [a.saved, dirty]);
  useEffect(() => () => a.cancelPreview(), [a.cancelPreview]);

  function choose(next: Palette | null) {
    setDraft(next);
    setDirty(true);
    setSuccess(false);
    // Keep the last readable preview while the HEX field is incomplete/invalid.
    a.previewPalette(next === null || !paletteError(next) ? next : (draft && !paletteError(draft) ? draft : a.saved));
  }
  function cancel() {
    setDraft(a.saved);
    setDirty(false);
    setSuccess(false);
    a.cancelPreview();
  }
  async function save() {
    if (!validation && await a.save(draft)) { setDirty(false); setSuccess(true); }
  }
  return (
    <section className="ec-palette" aria-labelledby="ec-palette-title" aria-busy={a.loading || a.busy}>
      <div className="ec-palette__heading">
        <div><h3 id="ec-palette-title">Ваши цвета</h3><p>Тёмная основа, ваша палитра. Сохраняется в аккаунте для веба и приложения.</p></div>
        <span className="ec-palette__private">Только для вас</span>
      </div>
      {a.error && <div className="ec-palette__error" role="alert"><span>{a.error}</span>{!a.loaded && <button type="button" className="ec-btn ec-btn--ghost" onClick={() => void a.reload()} disabled={a.loading}>Повторить</button>}</div>}
      <fieldset disabled={a.busy || !a.loaded} className="ec-palette__controls">
        <legend className="ec-palette__legend">Готовая палитра или свои оттенки</legend>
        <div className="ec-palette__presets" aria-label="Готовые палитры">
          {PALETTE_PRESETS.map((preset, index) => (
            <button type="button" key={preset.name} aria-pressed={index === 0 ? draft === null : JSON.stringify(colors) === JSON.stringify(preset.colors)} onClick={() => choose(index === 0 ? null : { ...preset.colors })}>
              <span className="ec-palette__swatches" aria-hidden="true">{[preset.colors.background, preset.colors.surface, preset.colors.accent, preset.colors.secondary].map((color, i) => <i key={i} style={{ background: color }} />)}</span>
              {preset.name}
            </button>
          ))}
        </div>
        <div className="ec-palette__fields">
          {PALETTE_KEYS.map(key => (
            <div className="ec-palette__field" key={key}>
              <label htmlFor={"ec-color-" + key}>{LABELS[key]}</label>
              <div className="ec-palette__input-pair">
                <input type="color" aria-label={LABELS[key] + " — выбор цвета"} value={normalizeHex(colors[key]) ?? DEFAULT_PALETTE[key]} onChange={e => choose({ ...colors, [key]: e.target.value })} />
                <input id={"ec-color-" + key} type="text" autoComplete="off" spellCheck={false} maxLength={7} value={colors[key]} aria-invalid={!normalizeHex(colors[key])} aria-describedby={validation ? "ec-palette-validation" : undefined} onChange={e => choose({ ...colors, [key]: e.target.value })} />
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="ec-palette__sample" aria-label="Предпросмотр оформления">
        <div className="ec-palette__sample-sidebar"><span>Пространство</span><strong># обсуждение</strong><span># задачи</span></div>
        <div className="ec-palette__sample-message"><strong>Всё на своих местах</strong><p>Сообщения, панели и акценты в вашей гамме.</p><span className="ec-palette__sample-tag">Активный элемент</span></div>
      </div>
      <p className="ec-palette__note">Оттенки наведения и вторичный текст подбираются автоматически для читаемости. Цвета ошибок и статусов не меняются.</p>
      {validation && <p id="ec-palette-validation" role="alert" className="ec-palette__validation">{validation}</p>}
      <div className="ec-palette__footer">
        <span role="status">{a.busy ? "Сохраняем…" : !a.loaded && a.loading ? "Загружаем цвета…" : success ? "Оформление сохранено" : dirty ? "Предпросмотр · не сохранено" : "Изменения видны только вам"}</span>
        <div>
          {(draft || a.saved) && <button type="button" className="ec-btn ec-btn--ghost" disabled={a.busy || !a.loaded} onClick={() => choose(null)}>Сбросить</button>}
          {dirty && <button type="button" className="ec-btn ec-btn--ghost" disabled={a.busy} onClick={cancel}>Отменить</button>}
          <button type="button" className="ec-btn ec-btn--primary" disabled={!dirty || !!validation || a.busy || !a.loaded} onClick={() => void save()}>Сохранить цвета</button>
        </div>
      </div>
    </section>
  );
}
