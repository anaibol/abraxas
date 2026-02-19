import React from "react";
import { Box, Flex, Text, VStack, HStack, Input, Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { T } from "../tokens";
import { type PartyMember } from "./types";

interface PartyTabProps {
	partyId: string;
	leaderId: string;
	partyMembers: PartyMember[];
	inviteId: string;
	setInviteId: (val: string) => void;
	onPartyInvite?: (id: string) => void;
	onPartyLeave?: () => void;
	onPartyKick?: (id: string) => void;
	onTradeRequest?: (id: string) => void;
}

export function PartyTab({
	partyId,
	leaderId,
	partyMembers,
	inviteId,
	setInviteId,
	onPartyInvite,
	onPartyLeave,
	onPartyKick,
	onTradeRequest,
}: PartyTabProps) {
	const { t } = useTranslation();
	return (
		<Box p="3">
			{!partyId ? (
				<VStack align="stretch" gap="3">
					<Text textStyle={T.bodyMuted} color={T.goldDark} fontStyle="italic">
						{t("sidebar.party.not_in_party")}
					</Text>
					<HStack gap="2">
						<Input
							placeholder={t("sidebar.party.session_id")}
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
								onPartyInvite?.(inviteId);
								setInviteId("");
							}}
						>
							{t("sidebar.party.invite")}
						</Button>
					</HStack>
				</VStack>
			) : (
				<VStack align="stretch" gap="2">
					<Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px">
						{t("sidebar.party.party_id", { id: partyId })}
					</Text>
					{partyMembers.map((member) => (
						<Flex
							key={member.sessionId}
							layerStyle={T.rowItem}
							justify="space-between"
							align="center"
						>
							<HStack gap="2">
								<Box
									w="6px"
									h="6px"
									borderRadius="full"
									bg="green.400"
									flexShrink={0}
								/>
								<Text
									textStyle={T.bodyMuted}
									color={member.sessionId === leaderId ? T.gold : T.goldText}
									fontWeight={member.sessionId === leaderId ? "700" : "400"}
								>
									{member.name}
									{member.sessionId === leaderId
										? ` ${t("sidebar.party.leader_tag")}`
										: ""}
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
								{leaderId === partyMembers[0]?.sessionId &&
									member.sessionId !== leaderId && (
										<Button
											size="xs"
											variant="ghost"
											p="0"
											h="auto"
											minW="auto"
											color="red.400"
											fontSize="12px"
											onClick={() => onPartyKick?.(member.sessionId)}
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
						onClick={onPartyLeave}
					>
						{t("sidebar.party.leave")}
					</Button>
				</VStack>
			)}
		</Box>
	);
}
