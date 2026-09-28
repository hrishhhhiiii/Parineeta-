// Documents that have no admin form generated from src/admin/schemas.js.
export const EXTRA_SCHEMAS = {
  announcement: {
    type: 'object',
    properties: {
      text: { type: ['string', 'null'], maxLength: 200 },
      linkText: { type: ['string', 'null'], maxLength: 60 },
      linkUrl: { type: ['string', 'null'], maxLength: 500, pattern: '^(https://|/|#|$)' },
      startsAt: { type: ['string', 'null'], maxLength: 40 },
      endsAt: { type: ['string', 'null'], maxLength: 40 },
      visible: { type: ['boolean', 'null'] },
    },
  },
};
