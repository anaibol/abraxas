import React from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { CLASS_STATS, type Spell } from "@abraxas/shared";
import { T, HEX } from "../tokens";
import { type PlayerState } from "./types";

interface SidebarFooterProps {
	state: PlayerState;
	isMobile?: boolean;
	classSpells: Spell[];
}

export function SidebarFooter({
	state,
	isMobile,
	classSpells,
}: SidebarFooterProps) {
	const { t } = useTranslation();
	const hpPct =
		state.maxHp > 0 ? Math.max(0, (state.hp / state.maxHp) * 100) : 0;
	const manaPct =
		state.maxMana > 0 ? Math.max(0, (state.mana / state.maxMana) * 100) : 0;
	const hpColor = hpPct > 50 ? T.blood : hpPct > 25 ? "#8b5a1a" : "#5a0e0e";
	const stats = CLASS_STATS[state.classType];

	return (
		<Box
			mt="auto"
			flexShrink={0}
			borderTop="2px solid"
			borderTopColor={T.border}
			bg={T.darkest}
		>
			<Box
				h="1px"
				bg={`linear-gradient(90deg, transparent, ${HEX.gold}, transparent)`}
			/>
			<Flex
				justify="space-around"
				py="2.5"
				px="3"
				borderBottom="1px solid"
				borderBottomColor={T.raised}
			>
				<StatChip
					label={t("sidebar.stats.str")}
					value={state.str ?? stats?.str ?? 0}
				/>
				<StatChip
					label={t("sidebar.stats.agi")}
					value={state.agi ?? stats?.agi ?? 0}
				/>
				<StatChip
					label={t("sidebar.stats.int")}
					value={state.intStat ?? stats?.int ?? 0}
				/>
			</Flex>

			{/* HP bar */}
			<Box px="3.5" pt="2.5" pb="1">
				<Text textStyle={T.statLabel} color={T.goldDark} textAlign="center" letterSpacing="3px" mb="0.5">
					{t("status.health")}
				</Text>
				<Box
					pos="relative"
					h="22px"
					bg="#0a0810"
					border="1px solid"
					borderColor={T.border}
					borderRadius="2px"
					overflow="hidden"
				>
					<Box h="100%" w={`${hpPct}%`} bg={hpColor} transition="width 0.2s" />
					<Flex
						pos="absolute"
						inset="0"
						align="center"
						justify="center"
						textStyle={T.codeText}
						fontWeight="700"
						color="#fff"
						textShadow="1px 1px 3px #000"
					>
						{state.hp}/{state.maxHp}
					</Flex>
				</Box>
			</Box>

			{/* Mana bar */}
			<Box px="3.5" pt="1.5" pb="2.5">
				<Text textStyle={T.statLabel} color={T.goldDark} textAlign="center" letterSpacing="3px" mb="0.5">
					{t("status.mana")}
				</Text>
				<Box
					pos="relative"
					h="22px"
					bg="#080818"
					border="1px solid"
					borderColor={T.border}
					borderRadius="2px"
					overflow="hidden"
				>
					<Box
						h="100%"
						w={`${manaPct}%`}
						bg={T.arcane}
						transition="width 0.2s"
					/>
					<Flex
						pos="absolute"
						inset="0"
						align="center"
						justify="center"
						textStyle={T.codeText}
						fontWeight="700"
						color="#fff"
						textShadow="1px 1px 3px #000"
					>
						{state.mana}/{state.maxMana}
					</Flex>
				</Box>
			</Box>

			{/* Keybinds — hide on mobile since controls are on-screen */}
			{!isMobile && (
				<Flex
					px="3"
					py="2"
					gap="2"
					justify="center"
					flexWrap="wrap"
					borderTop="1px solid"
					borderTopColor={T.raised}
					bg={T.bg}
				>
					<KeyHint keys="Arrows" action={t("controls.move")} />
					<KeyHint keys="Ctrl" action={t("controls.melee")} />
					<KeyHint keys="A" action={t("controls.pickup")} />
					<KeyHint keys="T" action={t("controls.drop")} />
					<KeyHint keys="M" action={t("controls.meditate")} />
					{classSpells.map((spell) => (
						<KeyHint
							key={spell.id}
							keys={`${spell.key}${spell.rangeTiles > 0 ? "+Click" : ""}`}
							action={t(`spells.${spell.id}.name`)}
						/>
					))}
				</Flex>
			)}
		</Box>
	);
}

function StatChip({ label, value }: { label: string; value: number }) {
	return (
		<Box textAlign="center">
			<Text textStyle={T.statLabel} color={T.goldDark} letterSpacing="1px">
				{label}
			</Text>
			<Text fontSize="20px" fontWeight="700" color={T.gold} mt="0.5">
				{value}
			</Text>
		</Box>
	);
}

function KeyHint({ keys, action }: { keys: string; action: string }) {
	return (
		<Flex align="center" gap="1" textStyle={T.bodyMuted} color={T.goldDark}>
			<Box
				layerStyle={T.goldBadge}
				bg={T.surface}
				textStyle={T.badgeText}
				color={T.goldMuted}
			>
				{keys}
			</Box>
			{action}
		</Flex>
	);
}
