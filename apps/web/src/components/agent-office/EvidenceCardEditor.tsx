import { useState } from "react";
import type { GrowthRunInput } from "../../hooks/useGrowthRuns";

export type GrowthEvidenceCard = NonNullable<GrowthRunInput["evidenceCards"]>[number];

const STATE_LABELS: Record<GrowthEvidenceCard["state"], string> = {
  verified: "Подтверждено",
  hypothesis: "Гипотеза",
  planned: "Планируется",
  unknown: "Неизвестно",
  rejected: "Отклонено",
};

function nextEvidenceId(cards: GrowthEvidenceCard[]): string {
  const used = new Set(cards.map((card) => card.id));
  let index = cards.length + 1;
  while (used.has(`evidence-${index}`)) index += 1;
  return `evidence-${index}`;
}

function sourceLabel(value: string): string {
  const url = new URL(value);
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.hostname}${path}`;
}

type EditorProps = {
  cards: GrowthEvidenceCard[];
  sourceUrls: string[];
  onChange: (cards: GrowthEvidenceCard[]) => void;
};

export function EvidenceCardEditor({ cards, sourceUrls, onChange }: EditorProps) {
  const [removePendingId, setRemovePendingId] = useState<string | null>(null);

  const updateCard = (index: number, patch: Partial<GrowthEvidenceCard>) => {
    const next = cards.map((card, cardIndex) => cardIndex === index ? { ...card, ...patch } : card);
    onChange(next);
  };

  const addCard = () => {
    if (cards.length >= 20) return;
    onChange([...cards, {
      id: nextEvidenceId(cards),
      claim: "",
      state: "hypothesis",
      sourceUrl: null,
      evidenceBoundary: "Требуется отдельная проверка перед публичным использованием.",
    }]);
  };

  const removeCard = (id: string) => {
    onChange(cards.filter((card) => card.id !== id));
    setRemovePendingId(null);
  };

  return (
    <section className="ec-evidence-editor" aria-labelledby="evidence-editor-title">
      <div className="ec-evidence-editor__head">
        <div>
          <span className="ec-agent-office__section-label">Claim-level evidence</span>
          <h3 id="evidence-editor-title">Доказательства</h3>
          <p>Свяжите конкретный тезис с источником. Без карточек запуск останется в legacy-режиме.</p>
        </div>
        <button type="button" className="ec-btn" disabled={cards.length >= 20} onClick={addCard}>
          {cards.length >= 20 ? "Лимит 20 карточек" : "Добавить доказательство"}
        </button>
      </div>

      {cards.length === 0 ? (
        <div className="ec-evidence-editor__empty">
          <strong>Карточек пока нет</strong>
          <span>Добавьте только те тезисы, которые Researcher и Claim Auditor должны проверить отдельно.</span>
        </div>
      ) : (
        <div className="ec-evidence-editor__list" aria-live="polite">
          {cards.map((card, index) => {
            const sourceMissing = card.sourceUrl !== null && !sourceUrls.includes(card.sourceUrl);
            const verifiedWithoutSource = card.state === "verified" && card.sourceUrl === null;
            return (
              <fieldset key={card.id} className="ec-evidence-card" data-state={card.state}>
                <legend><span>{index + 1}</span><strong>{card.id}</strong></legend>
                <label className="ec-evidence-card__claim">
                  <span>Проверяемый тезис</span>
                  <textarea required minLength={5} maxLength={500} value={card.claim} placeholder="Один конкретный факт без рекламного обещания" onChange={(event) => updateCard(index, { claim: event.target.value })} />
                </label>
                <label>
                  <span>Статус</span>
                  <select value={card.state} onChange={(event) => {
                    const state = event.target.value as GrowthEvidenceCard["state"];
                    updateCard(index, {
                      state,
                      sourceUrl: state === "verified" && !card.sourceUrl && sourceUrls[0] ? sourceUrls[0] : card.sourceUrl,
                    });
                  }}>
                    {Object.entries(STATE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span>Источник</span>
                  <select required={card.state === "verified"} value={card.sourceUrl ?? ""} aria-invalid={sourceMissing || verifiedWithoutSource} onChange={(event) => updateCard(index, { sourceUrl: event.target.value || null })}>
                    <option value="">Без источника</option>
                    {sourceUrls.map((url) => <option key={url} value={url}>{sourceLabel(url)}</option>)}
                  </select>
                  {(sourceMissing || verifiedWithoutSource) && <small role="alert">{sourceMissing ? "Этот источник больше не входит в список официальных ссылок." : "Для подтверждённого тезиса выберите источник из списка выше."}</small>}
                </label>
                <label className="ec-evidence-card__boundary">
                  <span>Что источник не доказывает</span>
                  <textarea required minLength={5} maxLength={1000} value={card.evidenceBoundary} onChange={(event) => updateCard(index, { evidenceBoundary: event.target.value })} />
                </label>
                <div className="ec-evidence-card__footer">
                  <span data-state={card.state}>{STATE_LABELS[card.state]}</span>
                  {removePendingId === card.id ? (
                    <div role="group" aria-label={`Подтвердить удаление ${card.id}`}>
                      <button type="button" className="ec-btn ec-btn--danger" onClick={() => removeCard(card.id)}>Удалить карточку</button>
                      <button type="button" className="ec-btn" onClick={() => setRemovePendingId(null)}>Отмена</button>
                    </div>
                  ) : (
                    <button type="button" className="ec-evidence-card__remove" onClick={() => setRemovePendingId(card.id)}>Удалить</button>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function EvidenceCardSummary({ cards }: { cards: GrowthEvidenceCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="ec-evidence-summary" aria-label={`${cards.length} evidence cards`}>
      {cards.map((card) => (
        <article key={card.id} data-state={card.state}>
          <header><strong>{card.claim}</strong><span>{STATE_LABELS[card.state]}</span></header>
          <p>{card.evidenceBoundary}</p>
          <small>{card.sourceUrl ? sourceLabel(card.sourceUrl) : "Источник не указан"} · {card.id}</small>
        </article>
      ))}
    </div>
  );
}
