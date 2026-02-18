import type { Room } from "colyseus.js";
import type { ServerMessages } from "@abraxas/shared";
import type { SpriteManager } from "../managers/SpriteManager";
import type { EffectManager } from "../managers/EffectManager";
import type { SoundManager } from "../assets/SoundManager";
import type { InputHandler } from "../systems/InputHandler";
import type { ConsoleCallback } from "../scenes/GameScene";

export class GameEventHandler {
    constructor(
        private room: Room,
        private spriteManager: SpriteManager,
        private effectManager: EffectManager,
        private soundManager: SoundManager,
        private inputHandler: InputHandler,
        private onConsoleMessage?: ConsoleCallback,
        private onKillFeed?: (killer: string, victim: string) => void,
        private onError?: (message: string) => void
    ) {}

    setupListeners() {
        this.room.onMessage("attack_start", (data: ServerMessages["attack_start"]) => this.onAttackStart(data));
        this.room.onMessage("attack_hit", (data: ServerMessages["attack_hit"]) => this.onAttackHit(data));
        this.room.onMessage("cast_start", (data: ServerMessages["cast_start"]) => this.onCastStart(data));
        this.room.onMessage("cast_hit", (data: ServerMessages["cast_hit"]) => this.onCastHit(data));
        this.room.onMessage("damage", (data: ServerMessages["damage"]) => this.onDamage(data));
        this.room.onMessage("death", (data: ServerMessages["death"]) => this.onDeath(data));
        this.room.onMessage("heal", (data: ServerMessages["heal"]) => this.onHeal(data));
        this.room.onMessage("buff_applied", (data: ServerMessages["buff_applied"]) => this.onBuffApplied(data));
        this.room.onMessage("stun_applied", (data: ServerMessages["stun_applied"]) => this.onStunApplied(data));
        this.room.onMessage("respawn", (data: ServerMessages["respawn"]) => this.onRespawn(data));
        this.room.onMessage("kill_feed", (data: ServerMessages["kill_feed"]) => this.onKillFeedMessage(data));
        this.room.onMessage("invalid_target", () => this.onInvalidTarget());
        this.room.onMessage("level_up", (data: ServerMessages["level_up"]) => this.onLevelUp(data));
        this.room.onMessage("notification", (data: ServerMessages["notification"]) => this.onNotification(data));
        this.room.onMessage("stealth_applied", (data: ServerMessages["stealth_applied"]) => this.onStealthApplied(data));
        this.room.onMessage("error", (data: { message: string }) => this.onErrorMessage(data));
    }

    private onErrorMessage(data: { message: string }) {
        this.onError?.(data.message);
        this.onConsoleMessage?.(`Error: ${data.message}`, "#ff0000");
    }

    private onAttackStart(data: ServerMessages["attack_start"]) {
        const sprite = this.spriteManager.getSprite(data.sessionId);
        if (sprite) {
            sprite.container.setAlpha(0.7);
            setTimeout(() => sprite.container.setAlpha(1), 100);
            if (data.sessionId === this.room.sessionId) {
                this.onConsoleMessage?.("You attacked!", "#cccccc");
            }
        }
        this.soundManager.playAttack();
    }

    private onAttackHit(data: ServerMessages["attack_hit"]) {
        if (data.targetSessionId) {
            this.spriteManager.flashSprite(data.targetSessionId, 0xff0000);
        }
    }

    private onCastStart(data: ServerMessages["cast_start"]) {
        const sprite = this.spriteManager.getSprite(data.sessionId);
        if (sprite) {
            sprite.container.setAlpha(0.8);
            setTimeout(() => sprite.container.setAlpha(1), 140);
            if (data.sessionId === this.room.sessionId) {
                this.onConsoleMessage?.("You cast a spell!", "#aaaaff");
            }
        }
        this.soundManager.playSpell();
    }

    private onCastHit(data: ServerMessages["cast_hit"]) {
        this.effectManager.playEffect(data.fxId, data.targetTileX, data.targetTileY);
    }

    private onDamage(data: ServerMessages["damage"]) {
        this.effectManager.showDamage(data.targetSessionId, data.amount, data.type);
        this.soundManager.playHit();

        if (data.targetSessionId === this.room.sessionId) {
            this.onConsoleMessage?.(`You took ${data.amount} damage!`, "#ff4444");
        }
    }

    private onDeath(data: ServerMessages["death"]) {
        const sprite = this.spriteManager.getSprite(data.sessionId);
        if (sprite) {
            sprite.container.setAlpha(0.3);
        }
        if (data.sessionId === this.room.sessionId) {
            this.inputHandler.cancelTargeting();
            this.onConsoleMessage?.("You have died!", "#ff0000");
        }
        this.soundManager.playDeath();
    }

    private onRespawn(data: ServerMessages["respawn"]) {
        const sprite = this.spriteManager.getSprite(data.sessionId);
        if (sprite) {
            sprite.container.setAlpha(1);
            sprite.setTilePosition(data.tileX, data.tileY);
        }
        if (data.sessionId === this.room.sessionId) {
            this.onConsoleMessage?.("You have respawned!", "#ffffff");
        }
    }

    private onHeal(data: ServerMessages["heal"]) {
        this.effectManager.showHeal(data.sessionId, data.amount);
        this.soundManager.playHeal();
        if (data.sessionId === this.room.sessionId) {
            this.onConsoleMessage?.(`You healed for ${data.amount}!`, "#33cc33");
        }
    }

    private onBuffApplied(data: ServerMessages["buff_applied"]) {
        this.effectManager.showFloatingText(data.sessionId, "BUFF", "#d4a843");
    }

    private onStunApplied(data: ServerMessages["stun_applied"]) {
        this.effectManager.showFloatingText(data.targetSessionId, "STUNNED", "#cccc33");
        if (data.targetSessionId === this.room.sessionId) {
             this.onConsoleMessage?.("You are stunned!", "#cccc33");
        }
    }

    private onStealthApplied(data: ServerMessages["stealth_applied"]) {
        this.effectManager.showFloatingText(data.sessionId, "STEALTH", "#aaddff");
    }

    private onKillFeedMessage(data: ServerMessages["kill_feed"]) {
        this.onKillFeed?.(data.killerName, data.victimName);
    }

    private onInvalidTarget() {
        this.effectManager.showFloatingText(this.room.sessionId, "Invalid target", "#ff8800");
    }

    private onLevelUp(data: ServerMessages["level_up"]) {
        this.effectManager.showFloatingText(data.sessionId, "LEVEL UP!", "#ffff00");
    }

    private onNotification(data: ServerMessages["notification"]) {
        this.onConsoleMessage?.(data.message, "#ffff00");
    }
}
