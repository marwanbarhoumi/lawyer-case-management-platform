import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { FormField } from '@/components/shared/form-field';
import {
  CaseStatusBadge,
  InvoiceStatusBadge,
  PriorityBadge,
} from '@/components/shared/status-badges';
import { Input } from '@/components/ui/input';
import ar from '@/messages/ar.json';
import fr from '@/messages/fr.json';

function renderWith(locale: 'fr' | 'ar', ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === 'fr' ? fr : ar} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('FormField', () => {
  it('associates the label with the input', () => {
    renderWith(
      'fr',
      <FormField label="Nom">
        <Input />
      </FormField>,
    );
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
  });

  it('renders the translated validation message and marks the input invalid', () => {
    renderWith(
      'fr',
      <FormField label="E-mail" error={{ message: 'email' }}>
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent(fr.validation.email);
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });

  it('shows the hint and the optional marker', () => {
    renderWith(
      'ar',
      <FormField label="الهاتف" hint="hint text" optional>
        <Input />
      </FormField>,
    );
    expect(screen.getByText('hint text')).toBeInTheDocument();
    expect(screen.getByText(`(${ar.common.optional})`)).toBeInTheDocument();
  });
});

describe('status badges', () => {
  it('translates statuses in French', () => {
    renderWith(
      'fr',
      <>
        <CaseStatusBadge status="IN_PROGRESS" />
        <InvoiceStatusBadge status="OVERDUE" />
        <PriorityBadge priority="URGENT" />
      </>,
    );
    expect(screen.getByText(fr.enums.caseStatus.IN_PROGRESS)).toBeInTheDocument();
    expect(screen.getByText(fr.enums.invoiceStatus.OVERDUE)).toBeInTheDocument();
    expect(screen.getByText(fr.enums.casePriority.URGENT)).toBeInTheDocument();
  });

  it('translates statuses in Arabic', () => {
    renderWith('ar', <CaseStatusBadge status="CLOSED" />);
    expect(screen.getByText(ar.enums.caseStatus.CLOSED)).toBeInTheDocument();
  });
});
