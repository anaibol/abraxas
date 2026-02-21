import { Box, Flex } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAudio } from "../contexts/AudioContext";
import { FriendsTab } from "./sidebar/FriendsTab";
import { GroupTab } from "./sidebar/GroupTab";
import { GuildTab } from "./sidebar/GuildTab";
import { HEX, T } from "./tokens";

const SOCIAL_TABS: readonly {
  key: "group" | "guild" | "friends";
  icon: string;
}[] = [
  { key: "group", icon: "⚔️" },
  { key: "guild", icon: "🛡️" },
  { key: "friends", icon: "👥" },
];

export interface SocialPanelProps {
  groupId?: string;
  leaderId?: string;
  groupMembers: any[];
  onGroupInvite: (name: string) => void;
  onGroupLeave: () => void;
  onGroupKick: (name: string) => void;
  
  guildId?: string;
  guildMembers: any[];
  onGuildCreate: (name: string) => void;
  onGuildInvite: (name: string) => void;
  onGuildLeave: () => void;
  onGuildKick: (name: string) => void;
  onGuildPromote: (name: string) => void;
  onGuildDemote: (name: string) => void;

  friends: any[];
  pendingFriendRequests: any[];
  onFriendRequest: (name: string) => void;
  onFriendAccept: (id: string) => void;
  onFriendRemove: (id: string) => void;
  
  onWhisper: (name: string) => void;
  onTradeRequest: (id: string) => void;
}

export function SocialPanel({
  groupId = "",
  leaderId = "",
  groupMembers = [],
  onGroupInvite,
  onGroupLeave,
  onGroupKick,

  guildId = "",
  guildMembers = [],
  onGuildCreate,
  onGuildInvite,
  onGuildLeave,
  onGuildKick,
  onGuildPromote,
  onGuildDemote,

  friends = [],
  pendingFriendRequests = [],
  onFriendRequest,
  onFriendAccept,
  onFriendRemove,

  onWhisper,
  onTradeRequest,
}: SocialPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"group" | "guild" | "friends">("group");
  const [inviteId, setInviteId] = useState("");
  const [friendName, setFriendName] = useState("");
  const { playUIClick, playUIHover } = useAudio();

  return (
    <Flex
      direction="column"
      w="100%"
      h="100%"
      bg="rgba(12, 10, 18, 0.65)"
      backdropFilter="blur(6px)"
      borderBottom="1px solid rgba(255,255,255,0.06)"
      borderLeft="1px solid rgba(255,255,255,0.06)"
      borderRight="1px solid rgba(255,255,255,0.06)"
    >
      <Flex borderBottom="2px solid" borderBottomColor={T.border} bg="rgba(0,0,0,0.3)">
        {SOCIAL_TABS.map(({ key, icon }) => (
          <Flex
            key={key}
            flex="1"
            direction="column"
            align="center"
            justify="center"
            py="1"
            gap="0.5"
            bg={tab === key ? "rgba(255,255,255,0.1)" : "transparent"}
            color={tab === key ? T.gold : T.goldDark}
            borderBottom="2px solid"
            borderBottomColor={tab === key ? T.gold : "transparent"}
            mb="-2px"
            cursor="pointer"
            transition="all 0.2s"
            _hover={{ 
              color: T.goldText, 
              bg: "rgba(255,255,255,0.15)"
            }}
            onMouseEnter={() => {
              if (tab !== key) playUIHover?.();
            }}
            onClick={() => {
              if (tab !== key) playUIClick?.();
              setTab(key);
            }}
          >
            <Box fontSize="14px" lineHeight="1">{icon}</Box>
            <Box
              fontFamily={T.display}
              fontSize="9px"
              fontWeight="700"
              letterSpacing="0.5px"
              textTransform="uppercase"
              lineHeight="1"
            >
              {t(`sidebar.tabs.${key}`)}
            </Box>
          </Flex>
        ))}
      </Flex>
      <Box flex="1" overflow="auto" p="2">
        {tab === "group" && (
          <GroupTab
            groupId={groupId}
            leaderId={leaderId}
            groupMembers={groupMembers}
            inviteId={inviteId}
            setInviteId={setInviteId}
            onGroupInvite={onGroupInvite}
            onGroupLeave={onGroupLeave}
            onGroupKick={onGroupKick}
            onTradeRequest={onTradeRequest}
          />
        )}
        {tab === "guild" && (
          <GuildTab
            guildId={guildId}
            guildMembers={guildMembers}
            onGuildCreate={onGuildCreate}
            onGuildInvite={onGuildInvite}
            onGuildLeave={onGuildLeave}
            onGuildKick={onGuildKick}
            onGuildPromote={onGuildPromote}
            onGuildDemote={onGuildDemote}
          />
        )}
        {tab === "friends" && (
          <FriendsTab
            friends={friends}
            pendingFriendRequests={pendingFriendRequests}
            friendName={friendName}
            setFriendName={setFriendName}
            onFriendRequest={onFriendRequest}
            onFriendAccept={onFriendAccept}
            onFriendRemove={onFriendRemove}
            onWhisper={onWhisper}
            onTradeRequest={onTradeRequest}
            onGroupInvite={onGroupInvite}
          />
        )}
      </Box>
    </Flex>
  );
}
