# Eclipse - Le Toolkit Ultime pour Discord

Eclipse est une application hybride (Tauri/Next.js/Node.js) conçue pour s'interfacer silencieusement et puissamment avec votre compte utilisateur Discord existant. Inspirée de projets "Advanced" (comme Nighty), l'application propose un riche ensemble d'outils de modélisation de profil, d'utilitaires pratiques (QoL), ainsi qu'une panoplie de commandes furtives et d'espionnage.

Voici la liste exhaustive de *tout* ce que réalise l'application à ce jour.

---

## 1. Architecture et Connexion (Hands-Free)

*   **Extraction DPAPI (Auto-Login) :** Eclipse utilise un backend Rust (via Tauri) pour lire les clés chiffrées de votre système d'exploitation Windows, décrypter les fichiers LevelDB locaux de votre client Discord officiel (ou navigateur), et s'y connecter instantanément (Selfbot).
*   **Connexion Gateway Temps Réel :** Au lieu d'utiliser l'API HTTP REST classique (et risquer des limitations temporaires), le module "Core" (Node.js) se connecte directement au portail WebSocket de Discord, maintenant une interaction en temps-réel (et moins détectable).
*   **Dual-Client Integration :** 
    *   Un client simule la présence et les mouvements du compte utilisateur.
    *   Un second module connecte une "Application Utilisateur" installée sur le compte afin de fournir officiellement les Slash Commands et les Menus Contextuels, ne nécessitant pas d'outrepasser les limites Discord sur les commandes textuelles modées.
*   **Mises à jour Push :** Le client Desktop communique avec le dépôt GitHub lié. Une notification visuelle permet de télécharger, d'installer, et de redémarrer le logiciel en un clic lorsque de nouvelles fonctionnalités sont poussées.

---

## 2. Dashboard et Moniteur (UI)

*   **Identité Utilisateur (Nighty-Style) :** Extraction visuelle propre contenant votre photo de profil, Pseudo, Tag Discord unique (`#0000`), le nombre de serveurs rejoints, et le nombre de contacts amicaux, tout ceci récupéré dynamiquement via le cache officiel.
*   **Centre de Notifications & Logs :** Enregistre *chaque* action exécutée en coulisse par Eclipse. 
    *   Sont affichés : Succès du Backup, Utilisations récentes d'une de vos commandes furtives, Détections d'un membre espionné.
    *   Fonctions de purge et suppression individuelle (Swipe/Trash) dotées d'animations fluides (`framer-motion` like via Tailwind).
*   **Connexion Auto-Maintenue :** Les clés Token (User & Developer App) sont stockées pour éviter les invites multiples après le premier démarrage. Le statut de connexion de la passerelle vous indique d'un coup d'œil si la connexion au serveur Core Websocket (Port `4040`) est établie.

---

## 3. Rich Presence & Animations (Onglet Profil)

### A. Constructeur Avancé (RPC)
Gérez le bloc qui s'affiche sous votre profil de compte personnalisé, de la façon la plus stricte que permet Discord :
*   **Type d'Activité :** Menus déroulants (Joue à, Écoute, Regarde, En compétition, etc.).
*   **Titres & État :** "Titre principal", "Détails" (Ligne 1) et "État" (Ligne 2).
*   **Images Riches (Assets) :** Gestion des "Large Image" ou "Small Image" supportant les IDs de votre App ou des liens CDN simples.
*   **Horodatage (Timestamp) :** Toggle permettant d'afficher depuis combien de temps vous avez démarré cette activité.
*   **Bouton Cliquable :** Configuration et injection locale d'un label couplé à une `URL` redirigeable de votre choix.
*   **Live Preview :** Une maquette "Wysiwyg" extrêmement précise mime l'apparence qu'aura l'embed directement chez la cible.

### B. Animation de Statut (Profile Keyframes)
L'ancien système de statut Discord est modifiable à la volée pour former des boucles animées.
*   **Étapes de l'animation :** Création illimitée de "Frames" combinant des phrases de texte et un Émoji cible (statique ou Unicode).
*   **Contrôle de boucle (Délai) :** Barre coulissante fixant la milliseconde de délai entre l'étape A et l'étape B (par ex : `3000ms`, recommandé pour battre le rate limit).
*   L'envoi s'opère en arrière-plan via opcode 3 pour une performance maximale et sans bloquer l'interface.

---

## 4. Paramétrages & Toolkit (Onglet Réglages)

*   **Mode Furtif (Stealth) :** Interrupteur principal. S'il est sur ON (Défaut), *tout ce que vous faîtes via application* (SlashCommands, Logs) sera supprimé par vos soins ou transformé en Message "Éphémère" (visibles *uniquement par vous-même* avec la mention "Seul vous pouvez voir ceci"). Si sur OFF, le bot répond publiquement là où il a été utilisé.
*   **Sauvegarde Disque (Backup) :** Demande au Core Node.js d'aller extraire vos Guildes ID, IDs de groupes DM, et structure d'Amis, pour l'inscrire secrètement en fichier `.JSON` exploitable ultérieurement (dans le dossier `core/backups`).
*   **Frappe Silencieuse (Silent Typing) 🤫 :** Ce paramètre visuel sert de commande pour signifier au réseau de ne plus notifier les salons quand vous tapez (en retenant les signaux "Typing" via la surcouche client, activé sur les actions intégrées à venir).

---

## 🛡️ Fonctionnalités Passives (Local-First)
Eclipse intègre un moteur de base de données local surpuissant (`SQLite`) qui s'assure de l'intégrité de votre compte sans alerter les serveurs Discord.
- **Tracker Hors-Ligne (Amis & Serveurs)** : Lors de votre utilisation quotidienne, Eclipse maintient une copie stricte de vos relations et de vos serveurs (Guildes) dans un cache de session local. 
  Au démarrage suivant de l'application, l'algorithme comparera l'état réel actuel du compte fourni par Discord avec la dernière sauvegarde SQLite. S'il trouve des divergences, il génèrera instantanément un popup **Toast** et un rapport dans vos journaux de *Notifications* : vous saurez ainsi précisément si un "Ami" vous a supprimé de sa liste pendant votre sommeil, ou si un Serveur vous a expulsé sans rien dire !

---

## 5. Commandes & Espionnage (Intégration User App)

L'une des plus grandes forces de ce module. Les commandes sont intégrées *directement en natif* au client officiel de Discord. Tapez simplement `/`, sélectionnez l'icône de l'Application Eclipse sur la barre de gauche, ou via "Clic droit" de la souris.

### A. Slash Commands Classiques (`/`)
1.   `/help` : L'aide globale qui recense un Embed d'aide récapitulant les capacités d'Eclipse.
2.   `/ping` : Simule un "Pong!" pour renvoyer la qualité/latence globale de la connexion du selfbot au serveur américain Discord.
3.   `/purge <compteur>` : Supprime les "X" *derniers messages de vous-même* dans le salon actuel, en envoyant une requête cache à intervalle régulier. Très utile pour nettoyer une trace sans alerter.
4.   `/ghostping <utilisateur>` : Mentionne furtivement un utilisateur (avec ping serveur rouge pour lui), mais le supprime sous la demie-seconde en arrière-plan. La cible verra le "1" rougir sans jamais trouver d'où provient l'origine de l'alerte sur desktop/mobile.
5.   `/hiddenping <util.> <message>` : (Troll) Rédige un `<message>` parfaitement visible par tous, mais mentionne la `<cible>` de manière totalement invisible grâce à un bloc de formatage ZWSP ultra-long empêchant l'application Discord de rendre le "tag". Personne ne saura qui mentionne la cible !
6.   `/spy <utilisateur>` (Sur Serveur) : *La commande ultime de surveillance.* Elle initie un conteneur Set() sur la machine tournant Eclipse pour mapper et espionner une personne sur une guilde. Dès l'instant d'activation, la cible surveillée signalera au client Eclipse en temps réel (via le panneau Dashboard *Notifications*) les mouvements suivants : 
      - Elle entre, sort, ou transite de son propre chef entre des *Salons Vocaux*.
      - Elle édite ou supprime ses textes... *(En cours d'amélioration "Sniper")*
7.   `/format <style> <texte>` : Formate instantanément un bloc de texte (`Gras`, `Italique`, `Code Block`, `Citation` ou `Spoiler`) sans avoir besoin de manipuler les structures Markdown de Discord.
8.   `/purgehack <lignes>` : (Troll) Rédige un gigantesque bloc invisible composé de Zéro-Width-Spaces. Repousse tout l'historique du salon vers le haut du curseur pour tous les membres actifs du chat, simulant un "Clear/Purge" complet de l'écran sans créer le moindre historique de Modération sur le serveur.

### B. Commandes de Modération (`/` sur Serveur)
Contrairement aux Applications tierces, Eclipse utilise votre **Token d'Utilisateur** pour lancer ces actions natives par requête API. Les actions n'apparaitront pas comme un appel applicatif "Eclipse a banni XXX" mais bien comme si vous l'aviez fait vous-même via l'interface Discord classique.
1.   `/kick <user> [raison]` : Expulse un membre du serveur.
2.   `/ban <user> [raison]` : Bannit un membre du serveur.
3.   `/hackban <id> [raison]` : L'outil ultime anti-raid. Bannit un identifiant précis de votre serveur **même s'il n'a pas encore rejoint la guilde** (Préventif).
4.   `/unban <id>` : Lève le bannissement d'un profil par son numéro.
5.   `/slowmode <secondes>` : Modifie furtivement la vitesse du mode lent sur le salon actuel.
6.   `/lock` / `/unlock` : Verrouille et Déverrouille instantanément le salon pour le rôle global `@everyone`.

### C. Modules de Harcèlement & Trolls Lourds
⚠️ *Ces modules exploitent des comportements obscurs ou des failles de l'API Discord v9. À utiliser de manière ludique et à vos propres risques sur les serveurs communautaires.*
1.   `/mimic <user> <texte>` : **Mimétisme Absolu**. Vole subtilement la photo de profil et le pseudo de la victime ciblée pour créer un WebHook éphémère d'une micro-seconde, poster le message en son nom, et s'auto-détruire. Pratique pour manipuler des conversations. (Nécessite *Manage Webhooks*).
2.   `/reactroll <user> <emoji>` : (Toggle On/Off) Track persistant en arrière plan. Place l'utilisateur ciblé sur liste noire ; dès lors, dès qu'il poste un message où que ce soit, le Selfbot d'Eclipse vient instantanément le liker avec l'emoji de votre choix, le poussant à la folie.
3.   `/deletesend <user>` : (Toggle On/Off) **Censure Totale**. À chaque message rédigé par la victime, Eclipse le supprime en urgence et le recrée au nom de la victime via WebHook. L'utilisateur ciblé *perd ainsi la propriété de tous ses propres messages* (il lui est impossible d'éditer le message ou de le supprimer à postériori).
4.   `/gcspam <user>` : Attaque l'Endpoint privé Discord pour bombarder un membre de votre liste d'amis de créations de Groupes Privés, pour détruire/noyer son interface de messages.
6.   `/fakenitro` : Fait apparaitre dans le salon actuel la vraie boîte jaune et cadeau Discord Nitro.
7.   `/server_clone <destination_id>` : **Clonage Absolu**. Frappe l'API Discord pour cloner un à un tous les Salons (Texte, Voix) et leurs Catégories avec leurs permissions, du serveur source vers un serveur de destination vide (Aspiration / Raiding).
8.   `/autoreply <user> <texte>` : **Présence Simulée (IA/Idle)**. Track une cible. S'il parle, le Selfbot entame une fausse frappe et répond au bout d'un temps aléatoire exactement la phrase choisie. Très utile pour prétendre ne pas être AFK sans bouger de son lit.

### D. Menus Contextuels d'Utilisateur (User Apps)
*(Faites un clic droit sur n'importe quel pseudo d'un salon ou ami > Menu "Applications")*
1.  **`Ghostping`** : Variante du ping furtif `/` au dessus, applicable instantanément en trois clics sur un collègue agaçant, là où il se trouve.
2.  **`Spy User`** : Activateur On/Off ciblé rapide, évitant de devoir utiliser les slashs commands, pour cibler plus vite.

### E. Menus Contextuels de Message (Message Apps)
*(Faites un clic droit sur n'importe quel texte ou image d'un channel > Menu "Applications")*
1.  **`Traduire`** : Utilise en coulisses l'API `gtx` gratuite de Google Translate pour décortiquer la grammaire d'un message étranger inconnu posté devant vous. En une seconde, un Embed éphémère (invisible de la guilde locale) dresse un bloc : "Original" vs "Compréhension Française", pratique pour rester silencieux.
2.  **`Voler Emojis`** : Parse via une Régex puissante toute structure Discord du message qui comporterait un format `<:nom:id>` de custom emoji.
    - Eclipse retourne alors un menu déroulant cliquable affichant la liste des serveurs où vous avez la force (ManageGuildExpressions). Vous choisissez d'un clic où atterrira ces ressources graphiques.
    - Le Bot va les télécharger puis les héberger automatiquement sur le serveur d'arrivée en un battement de cil, rapportant si aucun de la quinzaine d'emojis d'une phrase copypasta n'a rompu sous l'action.
3.  **`Voler Stickers`** : Semblablement au système Emoji, le bot aspirera n'importe quel Lottie/Autocollant mis en avant par un individu depuis un message, ouvrira la modal de sélection (Sélecteur de destination), et l'y placera secrètement (sous un label formaté de vol de Nighty).

---

## 6. Guide de Développement & Troubleshooting

### Démarrage Unifié
Pour compiler et lancer simultanément l'interface graphique (Tauri/React) et le backend WebSocket local (Node.js), favorisez la commande racine :
```bash
npm run dev:all
```

### Problèmes fréquents (Port 4040 In Use)
Lors d'un rechargement forcé de la console (ou si l'interface Tauri s'est fermée accidentellement sans tuer les processus enfants), vous pourriez rencontrer l'erreur Node.js suivante :
> `Error: listen EADDRINUSE: address already in use :::4040`

**Cause :** L'ancien processus *Core Node* (qui gère le WebSocket Local) tourne toujours en tâche de fond et bloque le port de l'application.

**Fix :** 
- Sur **Windows** : Ouvrez un terminal administrateur et tuez le processus fantôme via :
  `netstat -ano | findstr :4040` suivi de `taskkill /PID <NUMERO> /F` (ou cherchez simplement `node.exe` dans le Gestionnaire des Tâches).
- Relancez ensuite proprement `npm run dev:all`.

---
*Ce document sera mis à jour à chaque intégration majeure du cycle de dev et suit chronologiquement l'étendue des possibilités locales d'Eclipse !*
