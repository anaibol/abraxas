import { Box, Flex, HStack, Input, Text, VStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Button } from "../components/Button";
import { T } from "../tokens";
import type { GroupMember } from "./types";

interface GroupTabProps {
  groupId: string;
  leaderId: string;
  groupMembers: GroupMember[];
  inviteId: string;
  setInviteId: (val: string) => void;
  onGroupInvite?: (id: string) => void;
  onGroupLeave?: () => void;
  onGroupKick?: (id: string) => void;
  onTradeRequest?: (id: string) => void;
}

export function GroupTab({
  groupId,
  leaderId,
  groupMembers,
  inviteId,
  setInviteId,
  onGroupInvite,
  onGroupLeave,
  onGroupKick,
  onTradeRequest,
}: GroupTabProps) {
  const { t } = useTranslation();
  return (
    <Box p="3">
      {!groupId ? (
        <VStack align="stretch" gap="3">
          <Text textStyle={T.bodyMuted} color={T.goldDark} fontStyle="italic">
            {t("sidebar.group.not_in_group")}
          </Text>
          <HStack gap="2">
            <Input
              placeholder={t("sidebar.group.session_id")}
              size="xs"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
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
                onGroupInvite?.(inviteId);
                setInviteId("");
              }}
            >
              {t("sidebar.group.invite")}
            </Button>
          </HStack>
        </VStack>
      ) : (
        <VStack align="stretch" gap="2">
          <Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px">
            {t("sidebar.group.group_id", { id: groupId })}
          </Text>
          {groupMembers.map((member) => (
            <Flex
              key={member.sessionId}
              layerStyle={T.rowItem}
              justify="space-between"
              align="center"
            >
              <HStack gap="2">
                <Box w="6px" h="6px" borderRadius="full" bg="green.400" flexShrink={0} />
                <Text
                  textStyle={T.bodyMuted}
                  color={member.sessionId === leaderId ? T.gold : T.goldText}
                  fontWeight={member.sessionId === leaderId ? "700" : "400"}
                >
                  {member.name}
                  {member.sessionId === leaderId ? ` ${t("sidebar.group.leader_tag")}` : ""}
                </Text>
              </HStack>
              <HStack gap="1">
                {member.sessionId !== leaderId && (
                  <Button
                    size="xs"
                    variant="ghost"
                    p="0"
                    h="auto"
                    minW="auto"
                    color={T.gold}
                    fontSize="12px"
                    onClick={() => onTradeRequest?.(member.sessionId)}
                  >
                    {t("sidebar.social.trade")}
                  </Button>
                )}
                {leaderId === groupMembers[0]?.sessionId && member.sessionId !== leaderId && (
                  <Button
                    size="xs"
                    variant="ghost"
                    p="0"
                    h="auto"
                    minW="auto"
                    color="red.400"
                    fontSize="12px"
                    onClick={() => onGroupKick?.(member.sessionId)}
                  >
                    {t("sidebar.social.kick")}
                  </Button>
                )}
              </HStack>
            </Flex>
          ))}
          <Button
            mt="1"
            size="xs"
            variant="outline"
            borderColor={T.blood}
            color="red.400"
            _hover={{ bg: T.blood }}
            fontSize="12px"
            onClick={onGroupLeave}
          >
            {t("sidebar.group.leave")}
          </Button>
        </VStack>
      )}
    </Box>
  );
}
