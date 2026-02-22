import { Box, Flex, Tooltip } from "@chakra-ui/react";
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
      direction="row"
      w="100%"
      h="100%"
      bg="transparent"
    >
      <Flex direction="column" borderRight="2px solid" borderRightColor={T.border} bg="rgba(0,0,0,0.3)" w="44px">
        {SOCIAL_TABS.map(({ key, icon }) => (
          <Tooltip key={key} label={t(`sidebar.tabs.${key}`)} placement="right" hasArrow>
            <Flex
              flex="0"
              direction="column"
              align="center"
              justify="center"
              py="3"
              bg={tab === key ? "rgba(255,255,255,0.08)" : "transparent"}
              color={tab === key ? T.gold : T.goldDark}
              borderRight="2px solid"
              borderRightColor={tab === key ? T.gold : "transparent"}
              mr="-2px"
              cursor="pointer"
              transition="all 0.2s"
              opacity={tab === key ? 1 : 0.4}
              filter={tab === key ? `drop-shadow(0 0 6px ${T.gold}40)` : "grayscale(100%)"}
              title={t(`sidebar.tabs.${key}`)}
              _hover={{ 
                bg: "rgba(255,255,255,0.12)"
              }}
              onMouseEnter={() => {
                if (tab !== key) playUIHover?.();
              }}
              onClick={() => {
                if (tab !== key) playUIClick?.();
                setTab(key);
              }}
            >
              <Box fontSize="16px" lineHeight="1">{icon}</Box>
            </Flex>
          </Tooltip>
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
