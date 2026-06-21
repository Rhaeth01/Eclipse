import { describe, it, expect } from 'vitest';
import { buildEclipseEmbed, ECLIPSE_COLOR, ECLIPSE_ERROR_COLOR, eclipseAck, eclipseEmbedPayload } from '../embeds';

describe('buildEclipseEmbed — Corona amber + logo', () => {
  it('utilise la couleur amber Corona par défaut (0xe69a00)', () => {
    const embed = buildEclipseEmbed({ title: 'Test' });
    expect(embed.data.color).toBe(ECLIPSE_COLOR);
    expect(embed.data.color).toBe(0xe69a00);
  });

  it('utilise ECLIPSE_ERROR_COLOR quand isError=true via eclipseAck', () => {
    const payload = eclipseAck('❌ Erreur', undefined, true);
    expect((payload.embeds[0] as any).data.color).toBe(ECLIPSE_ERROR_COLOR);
  });

  it('set le footer "Eclipse" par défaut', () => {
    const embed = buildEclipseEmbed({ title: 'Test' });
    expect(embed.data.footer?.text).toBe('Eclipse');
  });

  it('set un timestamp par défaut', () => {
    const embed = buildEclipseEmbed({ title: 'Test' });
    expect(embed.data.timestamp).toBeDefined();
  });

  it('ne crash pas si interaction.client.user est undefined (test mocks)', () => {
    expect(() => buildEclipseEmbed({ title: 'Test' }, {} as any)).not.toThrow();
    expect(() => buildEclipseEmbed({ title: 'Test' }, { client: {} } as any)).not.toThrow();
    expect(() => buildEclipseEmbed({ title: 'Test' }, { client: { user: {} } } as any)).not.toThrow();
  });

  it('utilise le bot avatar comme thumbnail quand interaction disponible', () => {
    const avatarURL = vi.fn().mockReturnValue('https://bot-avatar.png');
    const embed = buildEclipseEmbed(
      { title: 'Test' },
      { client: { user: { displayAvatarURL: avatarURL } } } as any
    );
    expect(embed.data.thumbnail?.url).toBe('https://bot-avatar.png');
    expect(avatarURL).toHaveBeenCalledWith({ size: 256 });
  });

  it('override thumbnail explicite > bot avatar', () => {
    const avatarURL = vi.fn().mockReturnValue('https://bot-avatar.png');
    const embed = buildEclipseEmbed(
      { title: 'Test', thumbnail: 'https://custom.png' },
      { client: { user: { displayAvatarURL: avatarURL } } } as any
    );
    expect(embed.data.thumbnail?.url).toBe('https://custom.png');
  });

  it('désactive thumbnail avec null', () => {
    const embed = buildEclipseEmbed(
      { title: 'Test', thumbnail: null },
      { client: { user: { displayAvatarURL: () => 'https://bot.png' } } } as any
    );
    expect(embed.data.thumbnail).toBeUndefined();
  });

  it('ajoute fields en ordre', () => {
    const embed = buildEclipseEmbed({
      fields: [
        { name: 'A', value: '1', inline: true },
        { name: 'B', value: '2', inline: false },
      ],
    });
    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.fields?.[0].name).toBe('A');
    expect(embed.data.fields?.[1].name).toBe('B');
  });

  it('eclipseEmbedPayload retourne embed + ephemeral:true', () => {
    const payload = eclipseEmbedPayload({ title: 'X' });
    expect(payload.embeds).toHaveLength(1);
    expect(payload.ephemeral).toBe(true);
  });
});

import { vi } from 'vitest';
