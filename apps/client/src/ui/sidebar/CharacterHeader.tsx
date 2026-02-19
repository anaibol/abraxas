import React from "react";
import { Box, Flex, Text, HStack } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { T, HEX } from "../tokens";
import { type PlayerState } from "./types";

interface CharacterHeaderProps {
	state: PlayerState;
	isRecording?: boolean;
}

export function CharacterHeader({ state, isRecording }: CharacterHeaderProps) {
	const { t } = useTranslation();
	return (
		<Box
			px="4"
			pt="3.5"
			pb="2.5"
			bg={T.surface}
			borderBottom="1px solid"
			borderBottomColor={T.border}
			textAlign="center"
		>
			<Text
				fontSize="16px"
				fontWeight="700"
				color={T.gold}
				letterSpacing="2px"
				textShadow="0 0 12px rgba(180,140,50,0.25)"
			>
				{state.name}
			</Text>
			<Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="4px" mt="0.5">
				{t(`classes.${state.classType}.name`)}
			</Text>
			<HStack gap="2" justify="center" mt="1" flexWrap="wrap">
				{!state.alive && (
					<Text
						textStyle={T.bodyMuted}
						color={T.bloodBright}
						fontWeight="700"
						letterSpacing="3px"
					>
						{t("status.dead")}
					</Text>
				)}
				{state.stunned && (
					<Text textStyle={T.bodyMuted} color="#cccc33" fontWeight="700" letterSpacing="2px">
						{t("status.stunned")}
					</Text>
				)}
				{state.stealthed && (
					<Text textStyle={T.bodyMuted} color="#9944cc" fontWeight="700" letterSpacing="2px">
						{t("status.stealthed")}
					</Text>
				)}
				{state.meditating && (
					<Text textStyle={T.bodyMuted} color="#44aacc" fontWeight="700" letterSpacing="2px">
						{t("status.meditating")}
					</Text>
				)}
			</HStack>
			{isRecording && (
				<Flex align="center" justify="center" gap="2" mt="1.5">
					<Box
						w="8px"
						h="8px"
						bg="#ff0000"
						borderRadius="full"
						animation="pulse 1s infinite"
					/>
					<Text textStyle={T.bodyMuted} color="#ff4444" fontWeight="700" letterSpacing="2px">
						{t("status.transmitting")}
					</Text>
				</Flex>
			)}
			{/* Level + XP bar */}
			<Flex align="center" justify="space-between" mt="2" px="0.5">
				<Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="2px">
					{t("sidebar.inventory.level")} {state.level ?? 1}
				</Text>
				<Text textStyle={T.codeText} color={T.goldDark}>
					{state.xp ?? 0} / {state.maxXp ?? 100} {t("sidebar.inventory.xp")}
				</Text>
			</Flex>
			<Box
				pos="relative"
				h="6px"
				bg={T.darkest}
				border="1px solid"
				borderColor={T.border}
				borderRadius="full"
				overflow="hidden"
				mt="0.5"
			>
				<Box
					h="100%"
					w={`${state.maxXp ? Math.min(100, ((state.xp ?? 0) / state.maxXp) * 100) : 0}%`}
					bg={`linear-gradient(90deg, ${HEX.goldDark}, ${HEX.gold})`}
					transition="width 0.3s"
				/>
			</Box>
		</Box>
	);
}
