import { Box, Flex, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { T } from "../tokens";
import type { SidebarProps } from "./types";

interface GuildTabProps {
  guildId?: string;
  guildMembers: NonNullable<SidebarProps["guildMembers"]>;
  onGuildCreate?: (name: string) => void;
  onGuildInvite?: (targetName: string) => void;
  onGuildLeave?: () => void;
  onGuildKick?: (targetName: string) => void;
  onGuildPromote?: (targetName: string) => void;
  onGuildDemote?: (targetName: string) => void;
}

export function GuildTab({
  guildId,
  guildMembers,
  onGuildCreate,
  onGuildInvite,
  onGuildLeave,
  onGuildKick,
  onGuildPromote,
  onGuildDemote,
}: GuildTabProps) {
  const { t } = useTranslation();
  const [inputName, setInputName] = useState("");

  const myMember = guildMembers.find((m) => m.sessionId !== undefined); // Simple assumption, might need refinement if multiple online
  const amILeader = myMember?.role === "LEADER";
  const amIOfficer = myMember?.role === "OFFICER";
  const canInvite = amILeader || amIOfficer;

  return (
    <Box p="3">
      {!guildId ? (
        <VStack align="stretch" gap="3">
          <Text textStyle={T.bodyMuted} color={T.goldDark} fontStyle="italic">
            {t("sidebar.guild.not_in_guild", "You are not in a guild.")}
          </Text>
          <HStack gap="2">
            <Input
              placeholder={t("sidebar.guild.guild_name", "Guild Name")}
              size="xs"
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              bg={T.darkest}
              borderColor={T.border}
              color={T.goldText}
              fontSize="11px"
              fontFamily={T.mono}
              _focus={{ borderColor: T.gold }}
            />
            <Button
              size="xs"
              bg={T.raised}
              color={T.gold}
              borderColor={T.border}
              border="1px solid"
              _hover={{ bg: T.surface, borderColor: T.gold }}
              onClick={() => {
                if (inputName) {
                  onGuildCreate?.(inputName);
                  setInputName("");
                }
              }}
            >
              {t("sidebar.guild.create", "Create (1000g)")}
            </Button>
          </HStack>
        </VStack>
      ) : (
        <VStack align="stretch" gap="2">
          <HStack justify="space-between">
            <Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px">
              {t("sidebar.guild.guild_members", "GUILD MEMBERS")}
            </Text>
            <Button
              size="xs"
              variant="outline"
              borderColor={T.blood}
              color="red.400"
              _hover={{ bg: T.blood }}
              fontSize="10px"
              h="20px"
              onClick={onGuildLeave}
            >
              {t("sidebar.guild.leave", "Leave")}
            </Button>
          </HStack>

          {canInvite && (
            <HStack gap="2" pb="2" borderBottom="1px solid" borderColor={T.border}>
              <Input
                placeholder={t("sidebar.guild.player_name", "Player Name")}
                size="xs"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                bg={T.darkest}
                borderColor={T.border}
                color={T.goldText}
                fontSize="11px"
                fontFamily={T.mono}
                _focus={{ borderColor: T.gold }}
              />
              <Button
                size="xs"
                bg={T.raised}
                color={T.gold}
                borderColor={T.border}
                border="1px solid"
                _hover={{ bg: T.surface, borderColor: T.gold }}
                onClick={() => {
                  if (inputName) {
                    onGuildInvite?.(inputName);
                    setInputName("");
                  }
                }}
              >
                {t("sidebar.guild.invite", "Invite")}
              </Button>
            </HStack>
          )}

          {guildMembers.map((member) => (
            <Flex
              key={member.name}
              layerStyle={T.rowItem}
              justify="space-between"
              align="center"
              opacity={member.online ? 1 : 0.6}
            >
              <HStack gap="2">
                <Box
                  w="6px"
                  h="6px"
                  borderRadius="full"
                  bg={member.online ? "green.400" : "gray.500"}
                  flexShrink={0}
                />
                <VStack align="start" gap="0">
                  <Text
                    textStyle={T.bodyMuted}
                    color={member.online ? T.goldText : "gray.400"}
                    fontWeight={member.online ? "600" : "400"}
                    lineHeight="1.2"
                  >
                    {member.name}
                  </Text>
                  <Text fontSize="10px" color={T.goldDark} textTransform="uppercase">
                    {member.role}
                  </Text>
                </VStack>
              </HStack>
              <HStack gap="1">
                {amILeader && member.role !== "LEADER" && (
                  <>
                    {member.role === "MEMBER" ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        p="0"
                        h="auto"
                        minW="auto"
                        color={T.gold}
                        fontSize="10px"
                        onClick={() => onGuildPromote?.(member.name)}
                      >
                        ↑
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="ghost"
                        p="0"
                        h="auto"
                        minW="auto"
                        color={T.gold}
                        fontSize="10px"
                        onClick={() => onGuildDemote?.(member.name)}
                      >
                        ↓
                      </Button>
                    )}
                  </>
                )}
                {(amILeader || (amIOfficer && member.role === "MEMBER")) &&
                  member.sessionId !== myMember?.sessionId && (
                    <Button
                      size="xs"
                      variant="ghost"
                      p="0"
                      h="auto"
                      minW="auto"
                      color="red.400"
                      fontSize="10px"
                      onClick={() => onGuildKick?.(member.name)}
                    >
                      {t("sidebar.social.kick", "Kick")}
                    </Button>
                  )}
              </HStack>
            </Flex>
          ))}
        </VStack>
      )}
    </Box>
  );
}
