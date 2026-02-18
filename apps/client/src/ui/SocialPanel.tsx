import React, { useState } from "react";
import { Box, Flex, Text, Button, VStack, HStack, Input } from "@chakra-ui/react";

interface PartyMember {
  sessionId: string;
  name: string;
}

interface SocialPanelProps {
  partyId: string;
  leaderId: string;
  members: PartyMember[];
  onInvite: (sessionId: string) => void;
  onLeave: () => void;
  onKick: (sessionId: string) => void;
}

const P = {
  bg: "rgba(14, 12, 20, 0.95)",
  border: "#2e2840",
  gold: "#d4a843",
  text: "#c8b68a",
};

export function SocialPanel({ partyId, leaderId, members, onInvite, onLeave, onKick }: SocialPanelProps) {
  const [inviteId, setInviteId] = useState("");

  return (
    <Box
      w="280px"
      bg={P.bg}
      border="1px solid"
      borderColor={P.border}
      borderRadius="4px"
      p="3"
      color={P.text}
      fontFamily="'Friz Quadrata', Georgia, serif"
    >
      <Flex align="center" mb="3" pb="2" borderBottom="1px solid" borderColor={P.border}>
        <Text fontWeight="bold" fontSize="14px" letterSpacing="1px" color={P.gold}>👥 PARTY {partyId ? `(${partyId})` : ""}</Text>
      </Flex>

      {!partyId ? (
        <VStack align="stretch" gap="3">
          <Text fontSize="12px" color="#888">You are not in a party. Invite someone to start one!</Text>
          <HStack gap="2">
            <Input 
              placeholder="Session ID" 
              size="xs" 
              value={inviteId} 
              onChange={(e) => setInviteId(e.target.value)}
              bg="#000"
              borderColor={P.border}
              _focus={{ borderColor: P.gold }}
            />
            <Button size="xs" onClick={() => onInvite(inviteId)}>Invite</Button>
          </HStack>
        </VStack>
      ) : (
        <VStack align="stretch" gap="2">
          {members.map((member) => (
            <Flex key={member.sessionId} justify="space-between" align="center" p="2" bg="rgba(255,255,255,0.05)" borderRadius="2px">
              <HStack gap="2">
                <Text fontSize="12px" color={member.sessionId === leaderId ? P.gold : "#fff"}>
                  {member.name} {member.sessionId === leaderId && "(L)"}
                </Text>
              </HStack>
              {leaderId === members[0]?.sessionId && member.sessionId !== leaderId && (
                <Button size="xs" variant="ghost" p="0" color="red.400" onClick={() => onKick(member.sessionId)}>
                  [Kick]
                </Button>
              )}
            </Flex>
          ))}
          
          <Button 
            mt="2" 
            size="xs" 
            variant="outline" 
            colorPalette="red" 
            onClick={onLeave}
          >
            Leave Party
          </Button>
        </VStack>
      )}
    </Box>
  );
}
