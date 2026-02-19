import React from "react";
import { Box, Flex, Text, VStack, HStack, Input, Button } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { T } from "../tokens";
import { type Friend } from "./types";

interface FriendsTabProps {
	friends: Friend[];
	pendingFriendRequests: { id: string; name: string }[];
	friendName: string;
	setFriendName: (val: string) => void;
	onFriendRequest?: (name: string) => void;
	onFriendAccept?: (id: string) => void;
	onWhisper?: (name: string) => void;
	onTradeRequest?: (id: string) => void;
	onPartyInvite?: (id: string) => void;
}

export function FriendsTab({
	friends,
	pendingFriendRequests,
	friendName,
	setFriendName,
	onFriendRequest,
	onFriendAccept,
	onWhisper,
	onTradeRequest,
	onPartyInvite,
}: FriendsTabProps) {
	const { t } = useTranslation();
	return (
		<Box p="3">
			<VStack align="stretch" gap="3">
				<HStack gap="2">
					<Input
						placeholder={t("sidebar.friends.friend_name")}
						size="xs"
						value={friendName}
						onChange={(e) => setFriendName(e.target.value)}
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
							onFriendRequest?.(friendName);
							setFriendName("");
						}}
					>
						{t("sidebar.friends.add")}
					</Button>
				</HStack>
				<VStack align="stretch" gap="1">
					{friends.length === 0 && (
						<Text
							textStyle={T.bodyMuted}
							color={T.goldDark}
							textAlign="center"
							fontStyle="italic"
							py="4"
						>
							{t("sidebar.friends.no_friends")}
						</Text>
					)}
					{friends.map((friend) => (
						<Flex
							key={friend.id}
							layerStyle={T.rowItem}
							justify="space-between"
							align="center"
						>
							<HStack gap="2">
								<Box
									w="6px"
									h="6px"
									borderRadius="full"
									bg={friend.online ? "green.400" : "gray.600"}
									flexShrink={0}
								/>
								<Text
									textStyle={T.bodyMuted}
									color={friend.online ? T.goldText : T.goldDark}
								>
									{friend.name}
								</Text>
							</HStack>
							<HStack gap="1">
								<Button
									size="xs"
									variant="ghost"
									p="0"
									h="auto"
									minW="auto"
									color={T.gold}
									fontSize="12px"
									onClick={() => onWhisper?.(friend.name)}
								>
									{t("sidebar.social.whisper")}
								</Button>
								{friend.online && (
									<Button
										size="xs"
										variant="ghost"
										p="0"
										h="auto"
										minW="auto"
										color="blue.400"
										fontSize="12px"
										onClick={() => onPartyInvite?.(friend.id)}
									>
										{t("sidebar.social.party_invite")}
									</Button>
								)}
								{friend.online && (
									<Button
										size="xs"
										variant="ghost"
										p="0"
										h="auto"
										minW="auto"
										color={T.gold}
										fontSize="12px"
										onClick={() => onTradeRequest?.(friend.id)}
									>
										{t("sidebar.social.trade")}
									</Button>
								)}
							</HStack>
						</Flex>
					))}
				</VStack>
				{pendingFriendRequests.length > 0 && (
					<VStack align="stretch" gap="1">
						<Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px">
							{t("sidebar.friends.pending_requests")}
						</Text>
						{pendingFriendRequests.map((req) => (
							<Flex
								key={req.id}
								layerStyle={T.rowItem}
								justify="space-between"
								align="center"
							>
								<Text textStyle={T.bodyMuted} color={T.goldText}>
									{req.name}
								</Text>
								<Button
									size="xs"
									variant="ghost"
									p="0"
									h="auto"
									minW="auto"
									color="green.400"
									fontSize="12px"
									onClick={() => onFriendAccept?.(req.id)}
								>
									{t("sidebar.friends.accept")}
								</Button>
							</Flex>
						))}
					</VStack>
				)}
			</VStack>
		</Box>
	);
}
