import type { StoredAccount } from "../../../lib/accountVault";
import { resolveAssetUrl } from "../../../lib/assets";
import { Avatar } from "../../Avatar";
import { EclipseUiIcon } from "../../icons/EclipseUiIcon";

type Props = {
  accounts: StoredAccount[];
  currentAccountId: string;
  onSwitch: (accountId: string) => void;
  onForget: (accountId: string) => void;
  onAdd: () => void;
};

export function AccountsSection({ accounts, currentAccountId, onSwitch, onForget, onAdd }: Props) {
  return (
    <div className="ec-settings-section ec-settings-section--accounts">
      <header className="ec-settings-section__hero">
        <div>
          <span className="ec-settings-section__eyebrow">Учётная запись</span>
          <h2>Аккаунты на устройстве</h2>
          <p>Переключайся без повторного ввода пароля. Веб, desktop и другие устройства остаются в сети независимо.</p>
        </div>
        <button type="button" className="ec-btn ec-btn--primary ec-btn--sm" onClick={onAdd}>
          <EclipseUiIcon name="plus" size={16} />
          Добавить аккаунт
        </button>
      </header>

      <section className="ec-settings-account-list" aria-label="Сохранённые аккаунты">
        {accounts.map((account) => {
          const active = account.id === currentAccountId;
          return (
            <article key={account.id} className="ec-settings-account-row" data-active={active}>
              <Avatar
                url={resolveAssetUrl(account.user.avatar)}
                name={account.user.displayName}
                size={44}
              />
              <div className="ec-settings-account-row__copy">
                <strong>{account.user.displayName}</strong>
                <span>{account.user.email}</span>
              </div>
              {active ? (
                <span className="ec-settings-status-pill ec-settings-status-pill--ok">
                  <i aria-hidden /> Используется сейчас
                </span>
              ) : (
                <div className="ec-settings-account-row__actions">
                  <button type="button" className="ec-btn ec-btn--sm" onClick={() => onSwitch(account.id)}>
                    Переключиться
                  </button>
                  <button
                    type="button"
                    className="ec-btn ec-btn--sm ec-btn--danger"
                    data-cursor="danger"
                    onClick={() => onForget(account.id)}
                  >
                    Убрать
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </section>

      <aside className="ec-settings-account-note">
        <EclipseUiIcon name="shield" size={18} />
        <div>
          <strong>Пароли не сохраняются</strong>
          <p>Хранятся только сессионные токены, как и для одного аккаунта. «Убрать» удаляет профиль с этого устройства; смена пароля завершает все его сессии.</p>
        </div>
      </aside>
    </div>
  );
}
