"use client";

import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { RoomMemberView } from "@/lib/types";

const ROLE_ORDER: Record<string, number> = { HOST: 0, ELDER: 1, MEMBER: 2 };
const ROLE_LABEL: Record<string, string> = { HOST: "Host", ELDER: "Elders", MEMBER: "Members" };

export function ParticipantsPanel({
  members,
  isHost,
  onPromote,
  onDemote,
  onRemove,
}: {
  members: RoomMemberView[];
  isHost: boolean;
  onPromote: (userId: string) => void;
  onDemote: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const grouped = members.reduce<Record<string, RoomMemberView[]>>((acc, m) => {
    (acc[m.role] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {["HOST", "ELDER", "MEMBER"].map((role) =>
        grouped[role]?.length ? (
          <div key={role}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-base-300">{ROLE_LABEL[role]}</p>
            <div className="space-y-1">
              {grouped[role].map((m) => (
                <MemberRow key={m.userId} member={m} isHost={isHost} onPromote={onPromote} onDemote={onDemote} onRemove={onRemove} />
              ))}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}

function MemberRow({
  member,
  isHost,
  onPromote,
  onDemote,
  onRemove,
}: {
  member: RoomMemberView;
  isHost: boolean;
  onPromote: (userId: string) => void;
  onDemote: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const canManage = isHost && member.role !== "HOST";

  return (
    <div className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.05]">
      <div className="flex min-w-0 items-center gap-2">
        <div className="relative h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-[#1a2a4a] to-[#1a3a38] text-center text-[10px] font-bold uppercase leading-7">
          {member.profileImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={member.profileImage} alt="" className="h-7 w-7 rounded-full object-cover" />
          ) : (
            member.username.slice(0, 2)
          )}
          {!member.isConnected && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-base-500 ring-2 ring-base-950" />}
        </div>
        <span className="truncate text-sm font-medium text-white">{member.username}</span>
      </div>

      {canManage && (
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} className="text-base-400 transition-colors hover:text-white">
            <MoreVertical size={16} />
          </button>
          {open && (
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-white/[0.1] bg-[#0e121b] py-1 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl">
              {member.role === "MEMBER" ? (
                <MenuItem label="Promote to Elder" onClick={() => (onPromote(member.userId), setOpen(false))} />
              ) : (
                <MenuItem label="Demote to Member" onClick={() => (onDemote(member.userId), setOpen(false))} />
              )}
              <MenuItem label="Remove from room" danger onClick={() => (onRemove(member.userId), setOpen(false))} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={"block w-full px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.07] " + (danger ? "text-rose-400" : "text-base-200 hover:text-white")}
    >
      {label}
    </button>
  );
}
