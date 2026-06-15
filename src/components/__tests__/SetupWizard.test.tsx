import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SetupWizard } from '../SetupWizard';

const mockOnClose = vi.fn();
const mockOnTokenSave = vi.fn().mockResolvedValue(undefined);
const mockOnOpenPortal = vi.fn();

function renderWizard(overrides: Partial<Parameters<typeof SetupWizard>[0]> = {}) {
  return render(
    <SetupWizard
      open={true}
      onClose={mockOnClose}
      onTokenSave={mockOnTokenSave}
      appTokenConfigured={false}
      onOpenPortal={mockOnOpenPortal}
      {...overrides}
    />
  );
}

function renderWizardAndRerender(initialOverrides: Partial<Parameters<typeof SetupWizard>[0]>, rerenderOverrides: Partial<Parameters<typeof SetupWizard>[0]>) {
  const utils = render(
    <SetupWizard
      open={true}
      onClose={mockOnClose}
      onTokenSave={mockOnTokenSave}
      appTokenConfigured={false}
      onOpenPortal={mockOnOpenPortal}
      {...initialOverrides}
    />
  );
  utils.rerender(
    <SetupWizard
      open={true}
      onClose={mockOnClose}
      onTokenSave={mockOnTokenSave}
      appTokenConfigured={false}
      onOpenPortal={mockOnOpenPortal}
      {...rerenderOverrides}
    />
  );
  return utils;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: {
      readText: vi.fn().mockRejectedValue(new Error('denied')),
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
  window.open = vi.fn();
});

describe('SetupWizard', () => {
  describe('Closed state', () => {
    it('renders nothing when open is false', () => {
      const { container } = render(
        <SetupWizard open={false} onClose={mockOnClose} onTokenSave={mockOnTokenSave} appTokenConfigured={false} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Step 1 — Welcome', () => {
    it('displays the welcome title', () => {
      renderWizard();
      expect(screen.getByText('Configurer les Slash Commands')).toBeInTheDocument();
    });

    it('has a "Configurer manuellement" button that goes to step 2', async () => {
      renderWizard();
      const btn = screen.getByText('Configurer manuellement');
      await userEvent.click(btn);
      expect(await screen.findByText("Créer une application Discord")).toBeInTheDocument();
    });

    it('has a "Setup hybride" button that opens the setup webview', async () => {
      renderWizard();
      const btn = screen.getByText(/Setup hybride/);
      await userEvent.click(btn);
      expect(mockOnOpenPortal).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/Une fenêtre Discord s/)).toBeInTheDocument();
    });
  });

  describe('Step 2 — Instructions', () => {
    beforeEach(async () => {
      renderWizard();
      await userEvent.click(screen.getByText('Configurer manuellement'));
    });

    it('displays the three instruction steps', () => {
      expect(screen.getByText("Créer une application Discord")).toBeInTheDocument();
      expect(screen.getByText(/Ouvrez le portail développeur Discord/)).toBeInTheDocument();
      expect(screen.getByText(/Cliquez sur "New Application"/)).toBeInTheDocument();
      expect(screen.getByText(/Allez dans l'onglet "Bot"/)).toBeInTheDocument();
    });

    it('has a Discord link that calls onOpenPortal', async () => {
      const link = screen.getByText('discord.com/developers/applications');
      await userEvent.click(link);
      // Falls back to window.open if onOpenPortal is not provided, but we provided it
      expect(mockOnOpenPortal).toHaveBeenCalled();
    });

    it('has a "Retour" button going back to step 1', async () => {
      await userEvent.click(screen.getByText('Retour'));
      expect(await screen.findByText('Configurer les Slash Commands')).toBeInTheDocument();
    });

    it('has a "J\'ai mon token" button going to step 3', async () => {
      await userEvent.click(screen.getByText("J'ai mon token"));
      expect(await screen.findByText('Entrez votre token')).toBeInTheDocument();
    });
  });

  describe('Step 3 — Token input', () => {
    beforeEach(async () => {
      renderWizard();
      await userEvent.click(screen.getByText('Configurer manuellement'));
      await userEvent.click(screen.getByText("J'ai mon token"));
    });

    it('displays a token input field', () => {
      expect(screen.getByPlaceholderText('MTAxMjM0NTY3ODkw...')).toBeInTheDocument();
    });

    it('disables "Enregistrer" when token is too short', () => {
      const btn = screen.getByRole('button', { name: /Enregistrer le token/ });
      expect(btn).toBeDisabled();
    });

    it('enables "Enregistrer" when token is long enough', async () => {
      const input = screen.getByPlaceholderText('MTAxMjM0NTY3ODkw...');
      await userEvent.type(input, 'A'.repeat(20));
      const btn = screen.getByText('Enregistrer le token');
      expect(btn).not.toBeDisabled();
    });

    it('shows error when token too short and user tries to paste from clipboard', async () => {
      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue('short'),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
      const pasteBtn = screen.getByTitle('Coller depuis le presse-papier');
      await userEvent.click(pasteBtn);
      await waitFor(() => {
        expect(screen.getByText(/Aucun token valide détecté/)).toBeInTheDocument();
      });
    });

    it('auto-fills token from clipboard when valid', async () => {
      const validToken = 'MTAxMjM0NTY3ODkwMTIzNA.AbCdEf.ghIjKlMnOpQrStUvWxYz';
      Object.assign(navigator, {
        clipboard: {
          readText: vi.fn().mockResolvedValue(validToken),
          writeText: vi.fn().mockResolvedValue(undefined),
        },
      });
      const pasteBtn = screen.getByTitle('Coller depuis le presse-papier');
      await userEvent.click(pasteBtn);
      const input = screen.getByPlaceholderText('MTAxMjM0NTY3ODkw...') as HTMLInputElement;
      expect(input.value).toBe(validToken);
    });

    it('calls onTokenSave and goes to step 4 on valid token save', async () => {
      const input = screen.getByPlaceholderText('MTAxMjM0NTY3ODkw...');
      await userEvent.type(input, 'A'.repeat(30));
      await userEvent.click(screen.getByText('Enregistrer le token'));

      await waitFor(() => {
        expect(mockOnTokenSave).toHaveBeenCalledWith('A'.repeat(30));
      });
      expect(await screen.findByText('Configuration terminée !')).toBeInTheDocument();
    });

    it('has a "Retour" button going back to step 2', async () => {
      await userEvent.click(screen.getByText('Retour'));
      expect(await screen.findByText("Créer une application Discord")).toBeInTheDocument();
    });

    it('shows error when onTokenSave rejects', async () => {
      mockOnTokenSave.mockRejectedValueOnce(new Error('Token invalide'));
      const input = screen.getByPlaceholderText('MTAxMjM0NTY3ODkw...');
      await userEvent.type(input, 'A'.repeat(30));
      await userEvent.click(screen.getByText('Enregistrer le token'));

      await waitFor(() => {
        expect(screen.getByText(/Token invalide/)).toBeInTheDocument();
      });
    });
  });

  describe('Step 4 — Done', () => {
    beforeEach(async () => {
      renderWizard();
      await userEvent.click(screen.getByText('Configurer manuellement'));
      await userEvent.click(screen.getByText("J'ai mon token"));
      const input = screen.getByPlaceholderText('MTAxMjM0NTY3ODkw...');
      await userEvent.type(input, 'A'.repeat(30));
      await userEvent.click(screen.getByText('Enregistrer le token'));
    });

    it('shows confirmation message', async () => {
      expect(await screen.findByText('Configuration terminée !')).toBeInTheDocument();
      const gridItems = screen.getAllByText(/\/ghostping|\/spy|44\+ commandes/);
      expect(gridItems.length).toBeGreaterThanOrEqual(3);
    });

    it('"Commencer" button calls onClose', async () => {
      await userEvent.click(screen.getByText('Commencer'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pre-configured state', () => {
    it('starts at step 4 when appTokenConfigured is true', () => {
      renderWizard({ appTokenConfigured: true });
      expect(screen.getByText('Configuration terminée !')).toBeInTheDocument();
    });
  });

  describe('Fallback open portal', () => {
    it('uses window.open when onOpenPortal is not provided', async () => {
      render(
        <SetupWizard
          open={true}
          onClose={mockOnClose}
          onTokenSave={mockOnTokenSave}
          appTokenConfigured={false}
        />
      );
      await userEvent.click(screen.getByText('Configurer manuellement'));
      const link = screen.getByText('discord.com/developers/applications');
      await userEvent.click(link);
      expect(window.open).toHaveBeenCalledWith('https://discord.com/developers/applications', '_blank');
    });
  });

  describe('Hybrid setup flow (v0.3.4)', () => {
    it('shows hybrid instructions after clicking Setup hybride', async () => {
      renderWizard();
      await userEvent.click(screen.getByText(/Setup hybride/));
      expect(mockOnOpenPortal).toHaveBeenCalledTimes(1);
      expect(await screen.findByText(/Une fenêtre Discord s/)).toBeInTheDocument();
      expect(screen.getByText(/L'App ID est détecté automatiquement/)).toBeInTheDocument();
    });

    it('displays captcha_required fallback in the hybrid step', async () => {
      // Start with no setupProgress (welcome screen), then re-render with
      // captcha_required → useEffect auto-switches to 'hybrid' step.
      renderWizardAndRerender({}, { setupProgress: { step: 'captcha_required', message: 'Discord bloque aussi cette étape.' } as any });
      await waitFor(() => {
        expect(screen.getAllByText(/Discord bloque aussi cette étape/).length).toBeGreaterThan(0);
      });
      expect(screen.getByText(/Méthode manuelle/)).toBeInTheDocument();
    });

    it('shows hybrid step progress when create_bot step is broadcast', async () => {
      // Start in welcome, click hybrid, then re-render with in-progress progress.
      const utils = renderWizard();
      await userEvent.click(screen.getByText(/Setup hybride/));
      utils.rerender(
        <SetupWizard
          open={true}
          onClose={mockOnClose}
          onTokenSave={mockOnTokenSave}
          appTokenConfigured={false}
          onOpenPortal={mockOnOpenPortal}
          setupProgress={{ step: 'creating_bot', message: 'Ajout du Bot...' } as any}
        />
      );
      expect(await screen.findByText(/Configuration du Bot/)).toBeInTheDocument();
    });
  });
});
