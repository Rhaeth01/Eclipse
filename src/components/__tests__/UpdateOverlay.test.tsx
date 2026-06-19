import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UpdateOverlay } from '../UpdateOverlay';

describe('UpdateOverlay', () => {
  it('ne rend rien quand phase = idle', () => {
    const { container } = render(<UpdateOverlay phase="idle" progress={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche le titre "Téléchargement" et la barre à 64 % en phase downloading', () => {
    render(
      <UpdateOverlay
        phase="downloading"
        progress={64}
        version="9.9.9"
        downloaded={1024}
        contentLength={1600}
      />,
    );
    expect(screen.getByText('Téléchargement de la mise à jour')).toBeInTheDocument();
    expect(screen.getByText(/Eclipse v9\.9\.9/)).toBeInTheDocument();
    expect(screen.getByText('64%')).toBeInTheDocument();
  });

  it('affiche les bytes téléchargés / total en phase downloading', () => {
    render(
      <UpdateOverlay
        phase="downloading"
        progress={50}
        downloaded={512}
        contentLength={1024}
      />,
    );
    expect(screen.getByText(/512 o/)).toBeInTheDocument();
    expect(screen.getByText(/1 024 o|1.0 Ko|1024 o/)).toBeInTheDocument();
  });

  it('affiche "Installation…" en phase installing', () => {
    render(<UpdateOverlay phase="installing" progress={100} />);
    expect(screen.getByText('Installation en cours')).toBeInTheDocument();
  });

  it('affiche "Redémarrage" en phase restarting', () => {
    render(<UpdateOverlay phase="restarting" progress={100} />);
    expect(screen.getByText('Redémarrage')).toBeInTheDocument();
  });

  it('affiche le message d\'erreur en phase error', () => {
    render(
      <UpdateOverlay
        phase="error"
        progress={0}
        error="Connexion perdue"
      />,
    );
    expect(screen.getByText('Mise à jour interrompue')).toBeInTheDocument();
    expect(screen.getByText('Connexion perdue')).toBeInTheDocument();
  });

  it('rend le logo Eclipse', () => {
    render(<UpdateOverlay phase="downloading" progress={10} />);
    const img = screen.getByAltText('Eclipse') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    // Next/Image passe par son optimizer, le src contient l'URL encodée.
    expect(decodeURIComponent(img.src)).toContain('/icon.png');
  });
});
