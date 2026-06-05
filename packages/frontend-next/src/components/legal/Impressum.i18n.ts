import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'impressum';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Legal Notice',
  sections: {
    provider: {
      title: 'Provider Information',
      name: 'FreiFahren e.V. - Johan Trieloff (Chairman)',
      careOf: 'c/o Online-Impressum #7591',
      street: 'Europaring 90',
      city: '53757 Sankt Augustin',
    },
    contact: {
      title: 'Contact',
      emailLabel: 'Email:',
      form: 'Additional electronic contact channel: email.',
    },
    representedBy: {
      title: 'Represented by',
      content:
        'The association is represented jointly by any two members of the board: Johan Trieloff, Moritz Clerc, David Brandes.',
    },
    register: {
      title: 'Register Entry',
      content: 'Register of Associations: Amtsgericht Charlottenburg, VR 42496',
    },
    vat: {
      title: 'VAT',
      content: 'The association is not subject to VAT.',
    },
  },
  links: {
    privacy: 'Privacy Policy',
  },
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Impressum',
  sections: {
    provider: {
      title: 'Anbieterkennzeichnung',
      name: 'FreiFahren e.V. - Johan Trieloff (Vorstandsvorsitzender)',
      careOf: 'c/o Online-Impressum #7591',
      street: 'Europaring 90',
      city: '53757 Sankt Augustin',
    },
    contact: {
      title: 'Kontakt',
      emailLabel: 'E-Mail:',
      form: 'Weiterer elektronischer Kontaktweg: Kontaktaufnahme per E-Mail.',
    },
    representedBy: {
      title: 'Vertretungsberechtigt',
      content:
        'Der Verein wird jeweils durch zwei Mitglieder des Vorstands gemeinsam vertreten: Johan Trieloff, Moritz Clerc, David Brandes.',
    },
    register: {
      title: 'Registereintrag',
      content: 'Vereinsregister: Amtsgericht Charlottenburg, VR 42496',
    },
    vat: {
      title: 'Umsatzsteuer',
      content: 'Der Verein ist nicht umsatzsteuerpflichtig.',
    },
  },
  links: {
    privacy: 'Datenschutz',
  },
});
