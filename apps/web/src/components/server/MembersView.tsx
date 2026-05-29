import { MemberList } from "../MemberList";
import type { MemberRow } from "../../hooks/useMembers";

type Props = {
  serverId: string;
  serverName: string;
  members: MemberRow[];
  loading: boolean;
  error: string | null;
  voiceChannelByUser: Record<string, string>;
  channelNameById: (channelId: string) => string | undefined;
  currentUserId: string;
  onOpenDm: (userId: string) => void;
};

export function MembersView({
  serverId,
  serverName,
  members,
  loading,
  error,
  voiceChannelByUser,
  channelNameById,
  currentUserId,
  onOpenDm,
}: Props) {
  const onlineCount = members.filter((m) => m.online).length;

  return (
    <section
      id="ec-server-view-members"
      role="tabpanel"
      aria-label="Участники"
      className="ec-server-view ec-server-view--members"
    >
      <div className="ec-server-view__hero ec-holo-edge">
        <div>
          <span className="ec-server-view__eyebrow">{serverName}</span>
          <h2>Участники</h2>
          <p>
            {members.length} всего · {onlineCount} в сети
          </p>
        </div>
      </div>
      <div className="ec-server-view__panel">
        <MemberList
          members={members}
          loading={loading}
          error={error}
          hideHeader
          voiceChannelByUser={voiceChannelByUser}
          channelNameById={channelNameById}
          currentUserId={currentUserId}
          onOpenDm={onOpenDm}
          serverId={serverId}
        />
      </div>
    </section>
  );
}
