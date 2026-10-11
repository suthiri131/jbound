// Restyles Clerk's prebuilt forms to the JBound explorer theme (values match styles/theme.css).
export const clerkAppearance = {
  variables: {
    colorPrimary: '#2E5A3C',
    colorBackground: '#FBF6E9',
    colorText: '#2A2117',
    colorTextSecondary: '#5A4A36',
    colorInputBackground: '#F3EAD3',
    colorInputText: '#2A2117',
    colorDanger: '#9E3B1B',
    fontFamily: "'Archivo', system-ui, sans-serif",
    borderRadius: '8px',
  },
  elements: {
    rootBox: { width: '100%' },
    cardBox: {
      width: '100%',
      border: '2px solid #2A2117',
      borderRadius: '14px',
      boxShadow: '5px 5px 0 #2A2117',
      overflow: 'hidden',
    },
    card: { boxShadow: 'none', border: 'none' },
    header: { display: 'none' }, // our own <h1> is shown above the form
    formFieldLabel: { fontWeight: 700 },
    formFieldInput: {
      border: '2px solid #2A2117',
      minHeight: '44px',
      '&:focus': { borderColor: '#2A2117', boxShadow: '0 0 0 3px #E0A43B' },
    },
    otpCodeFieldInput: { border: '2px solid #2A2117' },
    formButtonPrimary: {
      minHeight: '46px',
      border: '2px solid #2A2117',
      boxShadow: '3px 3px 0 #2A2117',
      fontWeight: 700,
      textTransform: 'none',
      fontSize: '15px',
      '&:hover': { backgroundColor: '#1F3F2A' },
    },
    socialButtonsBlockButton: { border: '2px solid #2A2117', minHeight: '44px', fontWeight: 600 },
    dividerLine: { backgroundColor: '#CDB98E' },
    footerActionLink: { color: '#2E5A3C', fontWeight: 700 },
    footer: { background: '#F3EAD3' },
  },
};