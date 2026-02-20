import { GuildRole } from "../generated/prisma";
import { prisma } from "../database/db";

export class GuildService {
	static async createGuild(name: string, founderCharacterId: string) {
		return prisma.$transaction(async (tx) => {
			const guild = await tx.guild.create({
				data: { name },
			});
			await tx.guildMember.create({
				data: {
					guildId: guild.id,
					characterId: founderCharacterId,
					role: GuildRole.LEADER,
				},
			});
			return guild;
		});
	}

	static async getGuildMembers(guildId: string) {
		return prisma.guildMember.findMany({
			where: { guildId },
			include: { character: true },
		});
	}

	static async getGuildByCharacterId(characterId: string) {
		const member = await prisma.guildMember.findUnique({
			where: { characterId },
			include: { guild: true },
		});
		return member?.guild || null;
	}

	static async getMember(characterId: string) {
		return prisma.guildMember.findUnique({
			where: { characterId },
			include: { guild: true },
		});
	}

	static async addMember(guildId: string, characterId: string, role: GuildRole = GuildRole.MEMBER) {
		return prisma.guildMember.create({
			data: {
				guildId,
				characterId,
				role,
			},
		});
	}

	static async removeMember(characterId: string) {
		return prisma.guildMember.delete({
			where: { characterId },
		});
	}

	static async updateRole(characterId: string, role: GuildRole) {
		return prisma.guildMember.update({
			where: { characterId },
			data: { role },
		});
	}

	static async deleteGuild(guildId: string) {
		return prisma.guild.delete({
			where: { id: guildId },
		});
	}
}
