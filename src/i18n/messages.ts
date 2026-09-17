/**
 * Three locales, typed. The English object is the schema: every other locale
 * must provide every key, and the compiler enforces it. A missing German
 * string is a type error, not a fallback to English discovered by a German
 * user.
 *
 * No i18n framework. Three locales and forty strings do not justify one, and
 * Intl.DateTimeFormat, Intl.NumberFormat and Intl.PluralRules -- which do the
 * hard parts -- are built into every runtime this targets.
 */

export const LOCALES = ['en', 'de', 'fr'] as const;
export type Locale = (typeof LOCALES)[number];

const en = {
  'app.title': 'Book an appointment',
  'app.skipToContent': 'Skip to content',
  'locale.label': 'Language',
  'service.legend': 'What would you like to book?',
  'service.duration': '{minutes} minutes',
  'calendar.legend': 'Choose a date',
  'calendar.previousMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.instructions': 'Use the arrow keys to move between days. Press Enter to choose a date.',
  'calendar.unavailable': 'No appointments available',
  'calendar.today': 'Today',
  'calendar.selected': 'Selected',
  'slots.legend': 'Choose a time',
  'slots.none': 'No times are available on this date. Try another day.',
  'slots.loading': 'Loading available times',
  'slots.count': '{count, plural, one {# time available} other {# times available}}',
  'slots.timeZoneNote': 'Times are shown in {zone}.',
  'form.legend': 'Your details',
  'form.name': 'Full name',
  'form.email': 'Email address',
  'form.email.hint': 'We will send your confirmation here.',
  'form.notes': 'Anything we should know? (optional)',
  'form.submit': 'Confirm booking',
  'form.submitting': 'Booking…',
  'form.error.required': 'This field is required.',
  'form.error.email': 'Enter a valid email address.',
  'form.error.taken': 'That time was just taken. Please choose another.',
  'form.error.generic': 'Something went wrong. Your booking was not made.',
  'summary.legend': 'Your appointment',
  'summary.when': '{date} at {time}',
  'confirmed.title': 'Booked',
  'confirmed.body': 'Your appointment is confirmed for {date} at {time}. Keep the reference below to look up or cancel it.',
  'confirmed.reference': 'Reference {reference}',
  'confirmed.another': 'Book another appointment',
} as const;

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const de: Messages = {
  'app.title': 'Termin buchen',
  'app.skipToContent': 'Zum Inhalt springen',
  'locale.label': 'Sprache',
  'service.legend': 'Was möchten Sie buchen?',
  'service.duration': '{minutes} Minuten',
  'calendar.legend': 'Datum wählen',
  'calendar.previousMonth': 'Vorheriger Monat',
  'calendar.nextMonth': 'Nächster Monat',
  'calendar.instructions': 'Mit den Pfeiltasten zwischen den Tagen wechseln. Mit Enter ein Datum wählen.',
  'calendar.unavailable': 'Keine Termine verfügbar',
  'calendar.today': 'Heute',
  'calendar.selected': 'Ausgewählt',
  'slots.legend': 'Uhrzeit wählen',
  'slots.none': 'An diesem Tag sind keine Termine frei. Bitte wählen Sie einen anderen Tag.',
  'slots.loading': 'Freie Zeiten werden geladen',
  'slots.count': '{count, plural, one {# Termin frei} other {# Termine frei}}',
  'slots.timeZoneNote': 'Zeiten werden in {zone} angezeigt.',
  'form.legend': 'Ihre Angaben',
  'form.name': 'Vollständiger Name',
  'form.email': 'E-Mail-Adresse',
  'form.email.hint': 'Die Bestätigung senden wir an diese Adresse.',
  'form.notes': 'Gibt es etwas, das wir wissen sollten? (optional)',
  'form.submit': 'Buchung bestätigen',
  'form.submitting': 'Wird gebucht…',
  'form.error.required': 'Dieses Feld ist erforderlich.',
  'form.error.email': 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
  'form.error.taken': 'Diese Zeit wurde gerade vergeben. Bitte wählen Sie eine andere.',
  'form.error.generic': 'Etwas ist schiefgelaufen. Die Buchung wurde nicht vorgenommen.',
  'summary.legend': 'Ihr Termin',
  'summary.when': '{date} um {time}',
  'confirmed.title': 'Gebucht',
  'confirmed.body': 'Ihr Termin am {date} um {time} ist bestätigt. Bewahren Sie die Referenz unten auf, um den Termin einzusehen oder abzusagen.',
  'confirmed.reference': 'Referenz {reference}',
  'confirmed.another': 'Weiteren Termin buchen',
};

const fr: Messages = {
  'app.title': 'Prendre rendez-vous',
  'app.skipToContent': 'Aller au contenu',
  'locale.label': 'Langue',
  'service.legend': 'Que souhaitez-vous réserver ?',
  'service.duration': '{minutes} minutes',
  'calendar.legend': 'Choisissez une date',
  'calendar.previousMonth': 'Mois précédent',
  'calendar.nextMonth': 'Mois suivant',
  'calendar.instructions': 'Utilisez les flèches pour passer d’un jour à l’autre. Appuyez sur Entrée pour choisir une date.',
  'calendar.unavailable': 'Aucun rendez-vous disponible',
  'calendar.today': 'Aujourd’hui',
  'calendar.selected': 'Sélectionné',
  'slots.legend': 'Choisissez une heure',
  'slots.none': 'Aucun créneau n’est disponible à cette date. Essayez un autre jour.',
  'slots.loading': 'Chargement des créneaux disponibles',
  'slots.count': '{count, plural, one {# créneau disponible} other {# créneaux disponibles}}',
  'slots.timeZoneNote': 'Les heures sont affichées en {zone}.',
  'form.legend': 'Vos coordonnées',
  'form.name': 'Nom complet',
  'form.email': 'Adresse e-mail',
  'form.email.hint': 'Nous y enverrons votre confirmation.',
  'form.notes': 'Quelque chose à nous signaler ? (facultatif)',
  'form.submit': 'Confirmer la réservation',
  'form.submitting': 'Réservation…',
  'form.error.required': 'Ce champ est obligatoire.',
  'form.error.email': 'Saisissez une adresse e-mail valide.',
  'form.error.taken': 'Ce créneau vient d’être pris. Veuillez en choisir un autre.',
  'form.error.generic': 'Une erreur s’est produite. Votre réservation n’a pas été effectuée.',
  'summary.legend': 'Votre rendez-vous',
  'summary.when': '{date} à {time}',
  'confirmed.title': 'Réservé',
  'confirmed.body': 'Votre rendez-vous est confirmé pour le {date} à {time}. Conservez la référence ci-dessous pour le consulter ou l’annuler.',
  'confirmed.reference': 'Référence {reference}',
  'confirmed.another': 'Prendre un autre rendez-vous',
};

export const MESSAGES: Record<Locale, Messages> = { en, de, fr };
