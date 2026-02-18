import React, { useState } from "react";
import { Box, Flex, Text, Button, VStack, HStack, Input } from "@chakra-ui/react";

interface PartyMember {
  sessionId: string;
  name: string;
}

interface Friend {
  id: string;
  name: string;
  online: boolean;
}

interface SocialPanelProps {
  partyId: string;
  leaderId: string;
  partyMembers: PartyMember[];
  onPartyInvite: (sessionId: string) => void;
  onPartyLeave: () => void;
  onPartyKick: (sessionId: string) => void;
  
  friends: Friend[];
  onFriendRequest: (name: string) => void;
  onFriendAccept: (requesterId: string) => void;
  onWhisper: (name: string) => void;
}

const P = {
  bg: "rgba(14, 12, 20, 0.98)",
  border: "#2e2840",
  gold: "#d4a843",
  text: "#c8b68a",
  active: "rgba(255, 255, 255, 0.1)",
};

export function SocialPanel({ 
  partyId, leaderId, partyMembers, onPartyInvite, onPartyLeave, onPartyKick,
  friends, onFriendRequest, onFriendAccept, onWhisper 
}: SocialPanelProps) {
  const [inviteId, setInviteId] = useState("");
  const [friendName, setFriendName] = useState("");
  const [activeTab, setActiveTab] = useState<"party" | "friends">("party");

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
      boxShadow="0 4px 20px rgba(0,0,0,0.5)"
    >
      {/* Tabs */}
      <HStack gap="0" mb="3" borderBottom="1px solid" borderColor={P.border}>
        <Box
          flex="1"
          py="1"
          textAlign="center"
          cursor="pointer"
          fontSize="11px"
          fontWeight="bold"
          letterSpacing="1px"
          bg={activeTab === "party" ? P.active : "transparent"}
          color={activeTab === "party" ? P.gold : "#666"}
          onClick={() => setActiveTab("party")}
        >
          PARTY
        </Box>
        <Box
          flex="1"
          py="1"
          textAlign="center"
          cursor="pointer"
          fontSize="11px"
          fontWeight="bold"
          letterSpacing="1px"
          bg={activeTab === "friends" ? P.active : "transparent"}
          color={activeTab === "friends" ? P.gold : "#666"}
          onClick={() => setActiveTab("friends")}
        >
          FRIENDS
        </Box>
      </HStack>

      {activeTab === "party" ? (
        <>
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
                <Button size="xs" onClick={() => onPartyInvite(inviteId)}>Invite</Button>
              </HStack>
            </VStack>
          ) : (
            <VStack align="stretch" gap="2">
              <Text fontSize="10px" color={P.gold} mb="1">ID: {partyId}</Text>
              {partyMembers.map((member) => (
                <Flex key={member.sessionId} justify="space-between" align="center" p="2" bg="rgba(255,255,255,0.05)" borderRadius="2px">
                  <HStack gap="2">
                    <Box w="6px" h="6px" borderRadius="full" bg="green.400" />
                    <Text fontSize="12px" color={member.sessionId === leaderId ? P.gold : "#fff"}>
                      {member.name} {member.sessionId === leaderId && "(L)"}
                    </Text>
                  </HStack>
                  {leaderId === partyMembers[0]?.sessionId && member.sessionId !== leaderId && (
                    <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color="red.400" onClick={() => onPartyKick(member.sessionId)}>
                      [Kick]
                    </Button>
                  )}
                </Flex>
              ))}
              
              <Button 
                mt="2" 
                size="xs" 
                variant="outline" 
                borderColor="red.900"
                color="red.400"
                _hover={{ bg: "red.900" }}
                onClick={onPartyLeave}
              >
                Leave Party
              </Button>
            </VStack>
          )}
        </>
      ) : (
        <VStack align="stretch" gap="3">
          <HStack gap="2">
            <Input 
              placeholder="Friend Name" 
              size="xs" 
              value={friendName} 
              onChange={(e) => setFriendName(e.target.value)}
              bg="#000"
              borderColor={P.border}
              _focus={{ borderColor: P.gold }}
            />
            <Button size="xs" onClick={() => { onFriendRequest(friendName); setFriendName(""); }}>Add</Button>
          </HStack>

          <VStack align="stretch" gap="1" maxH="200px" overflowY="auto">
            {friends.length === 0 && <Text fontSize="11px" color="#555" textAlign="center">No friends yet.</Text>}
            {friends.map(friend => (
              <Flex key={friend.id} justify="space-between" align="center" p="2" bg="rgba(255,255,255,0.03)" borderRadius="2px">
                <HStack gap="2">
                  <Box w="6px" h="6px" borderRadius="full" bg={friend.online ? "green.400" : "gray.600"} />
                  <Text fontSize="12px" color={friend.online ? "#fff" : "#666"}>{friend.name}</Text>
                </HStack>
                <HStack gap="1">
                  <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color={P.gold} onClick={() => onWhisper(friend.name)}>
                    [W]
                  </Button>
                  {friend.online && (
                    <Button size="xs" variant="ghost" p="0" h="auto" minW="auto" color="blue.400" onClick={() => onPartyInvite(friend.id)}>
                      [P]
                    </Button>
                  )}
                </HStack>
              </Flex>
            ))}
          </VStack>
        </VStack>
      )}
    </Box>
  );
}
