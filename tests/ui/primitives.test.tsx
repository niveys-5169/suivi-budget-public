import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  Amount,
  Badge,
  Button,
  Card,
  Field,
  IconButton,
  Input,
  List,
  ListItem,
  ProgressBar,
  SegmentedControl,
  Switch,
  Text,
} from '../../public/src/ui';

afterEach(() => vi.restoreAllMocks());

describe('Text', () => {
  it('rend la balise sémantique par défaut de la variante', () => {
    render(<Text variant="title2">Comptes courants</Text>);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Comptes courants');
  });

  it("pose un title quand le texte est tronqué, pour ne pas perdre l'information", () => {
    render(<Text truncate>{'Prélèvement mensuel assurance habitation — contrat 4471902'}</Text>);
    expect(screen.getByTitle(/Prélèvement mensuel assurance/)).toBeInTheDocument();
  });

  it('ne met en capitales que la variante overline', () => {
    const { rerender, container } = render(<Text variant="headline">Salaire</Text>);
    expect(container.firstElementChild?.className).not.toContain('uppercase');
    rerender(<Text variant="overline">juillet 2026</Text>);
    expect(container.firstElementChild?.className).toContain('uppercase');
  });
});

describe('Amount', () => {
  it("colore selon le signe et n'utilise jamais l'or pour une valeur", () => {
    const { container, rerender } = render(<Amount value={2640} />);
    expect(container.firstElementChild?.className).toContain('text-positive');
    expect(container.firstElementChild?.className).not.toContain('text-gold');

    rerender(<Amount value={-62.4} />);
    expect(container.firstElementChild?.className).toContain('text-negative');
  });

  it('affiche un tiret pour une valeur absente plutôt que 0 €', () => {
    render(<Amount value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('préfixe les montants positifs quand signed est demandé', () => {
    render(<Amount value={312.4} signed />);
    expect(screen.getByText(/^\+/)).toBeInTheDocument();
  });
});

describe('Card', () => {
  it('signale une carte imbriquée en développement', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Card>
        <Card>contenu</Card>
      </Card>,
    );
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('<Card> imbriquée'));
  });

  it('ne signale rien pour des cartes sœurs', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <>
        <Card>a</Card>
        <Card>b</Card>
      </>,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("n'a ni ombre ni bordure par défaut", () => {
    const { container } = render(<Card>x</Card>);
    const cls = container.firstElementChild?.className ?? '';
    expect(cls).not.toMatch(/shadow/);
    expect(cls).not.toMatch(/border/);
  });
});

describe('Button', () => {
  it('est de type button par défaut, pour ne pas soumettre un formulaire par accident', () => {
    render(<Button>Enregistrer</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('est désactivé et annoncé occupé pendant le chargement', () => {
    render(<Button loading>Enregistrer</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('exige un nom accessible sur IconButton', () => {
    render(<IconButton label="Rechercher">x</IconButton>);
    expect(screen.getByRole('button', { name: 'Rechercher' })).toBeInTheDocument();
  });
});

describe('Field', () => {
  it('associe le label au contrôle et relaie le message', () => {
    render(
      <Field label="Montant" error="Montant requis">
        {(p) => <Input {...p} />}
      </Field>,
    );
    const input = screen.getByLabelText('Montant');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Montant requis');
    expect(screen.getByRole('alert')).toHaveTextContent('Montant requis');
  });
});

describe('List', () => {
  it('porte le rayon sur la liste, jamais sur les lignes', () => {
    const { container } = render(
      <List>
        <ListItem title="Boursorama" subtitle="Compte joint" />
      </List>,
    );
    expect(container.firstElementChild?.className).toContain('rounded-lg');
    const row = screen.getByText('Boursorama').closest('div,button');
    expect(row?.className ?? '').not.toMatch(/rounded/);
  });

  it('rend une ligne cliquable comme un vrai bouton', () => {
    const onClick = vi.fn();
    render(<ListItem title="Livret A" onClick={onClick} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('Contrôles', () => {
  it('expose SegmentedControl comme un groupe avec état pressé', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Type"
        value="all"
        onChange={onChange}
        segments={[
          { value: 'all', label: 'Tout' },
          { value: 'out', label: 'Dépenses' },
        ]}
      />,
    );
    expect(screen.getByRole('button', { name: 'Tout' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Dépenses' }));
    expect(onChange).toHaveBeenCalledWith('out');
  });

  it('expose Switch avec le rôle switch', () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} label="Mode compact" />);
    const sw = screen.getByRole('switch', { name: 'Mode compact' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('borne ProgressBar entre 0 et 100', () => {
    const { rerender } = render(<ProgressBar value={1.8} label="Budget" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    rerender(<ProgressBar value={-3} label="Budget" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('rend Badge en casse normale', () => {
    const { container } = render(<Badge tone="accent">Pointé</Badge>);
    expect(container.firstElementChild?.className).not.toContain('uppercase');
  });
});

describe('Cohérence du système', () => {
  it('aucune primitive n’émet de rayon hors échelle', () => {
    const { container } = render(
      <MemoryRouter>
        <Card>
          <Button variant="primary">A</Button>
          <Badge>B</Badge>
          <ProgressBar value={0.5} label="p" />
        </Card>
      </MemoryRouter>,
    );
    const classes = Array.from(container.querySelectorAll('*'))
      .map((el) => el.className)
      .filter((c): c is string => typeof c === 'string')
      .join(' ');
    expect(classes).not.toMatch(/rounded-(2xl|3xl|4xl)\b/);
    expect(classes).not.toMatch(/rounded-\[/);
  });
});
