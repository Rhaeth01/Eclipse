import { SlashCommandBuilder } from 'discord.js';
import type { CommandRegistry, TopLevelDef } from '../CommandRegistry';

export function registerBasics(registry: CommandRegistry): void {
  // /ping
  const ping: TopLevelDef = {
    name: 'ping',
    description: 'Affiche la latence',
    async execute(interaction, _ctx) {
      const start = Date.now();
      await interaction.reply({ content: '🏓 Pong!', ephemeral: true });
      const latency = Date.now() - start;
      await interaction.editReply({ content: `🏓 Pong! \`${latency}ms\`` });
    },
  };
  registry.top(ping);

  // /help — généré dynamiquement depuis le registre
  const help: TopLevelDef = {
    name: 'help',
    description: 'Affiche la liste des commandes',
    build: (cmd: SlashCommandBuilder) =>
      cmd.addStringOption(o =>
        o.setName('categorie').setDescription('Catégorie à explorer').setRequired(false)
      ),
    async execute(interaction, _ctx) {
      const category = interaction.options.getString('categorie');

      if (category) {
        const subs = registry.getSubcommands(category);
        if (subs.length === 0) {
          await interaction.reply({ content: `❌ Catégorie \`${category}\` introuvable.`, ephemeral: true });
          return;
        }
        let text = `**/${category} — ${registry.getCategoryDescription(category)}**\n\n`;
        // Grouper par sous-groupe
        const grouped = new Map<string, typeof subs>();
        const direct: typeof subs = [];
        for (const s of subs) {
          if (s.group) {
            const g = grouped.get(s.group) ?? [];
            g.push(s);
            grouped.set(s.group, g);
          } else direct.push(s);
        }
        for (const s of direct) text += `• \`${category} ${s.name}\` — ${s.description}\n`;
        for (const [grp, list] of grouped) {
          text += `\n**${grp}**\n`;
          for (const s of list) text += `• \`${category} ${grp} ${s.name}\` — ${s.description}\n`;
        }
        await interaction.reply({ content: text, ephemeral: true });
        return;
      }

      // Vue d'ensemble : toutes les catégories
      let text = '**🌙 Eclipse — Commandes**\n\n';
      const categories = registry.getCategories();
      for (const cat of categories) {
        const count = registry.getSubcommands(cat).length;
        text += `• **/${cat}** — ${registry.getCategoryDescription(cat)} (${count})\n`;
      }
      for (const t of registry.getTopLevel()) {
        if (t.name === 'help') continue;
        text += `• **/${t.name}** — ${t.description}\n`;
      }
      const menus = registry.getContextMenuDefs();
      if (menus.length) {
        text += `\n**Menus contextuels**\n`;
        for (const m of menus) text += `• ${m.type === 'user' ? '👤' : '💬'} ${m.name}\n`;
      }
      text += `\n_Total : ${registry.countAll()} commandes. Utilise \`/help <categorie>\` pour le détail._`;
      await interaction.reply({ content: text, ephemeral: true });
    },
  };
  registry.top(help);
}
