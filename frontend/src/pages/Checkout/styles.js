export const C = '#8DC63F'
export const GRAD = 'linear-gradient(135deg, #A8D86D 0%, #7EC840 50%, #5EAE2E 100%)'

const s = {
  page: { background: '#e4e4e8', minHeight: '100dvh', paddingBottom: 16 },

  pageTitle: {
    fontSize: 18, fontWeight: 800, color: '#1a1a1a',
    textAlign: 'center', letterSpacing: -0.3,
  },
  backBtn: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    background: '#fff', border: `2px solid ${C}`, borderRadius: 14,
    padding: '12px 20px', width: '100%',
    fontSize: 15, fontWeight: 700, color: C, cursor: 'pointer',
    boxSizing: 'border-box',
  },

  section: { padding: '0 16px', marginBottom: 12 },
  sLabel: {
    fontSize: 13, fontWeight: 700, color: '#8e8e93',
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 8, paddingLeft: 2,
  },
  card: {
    background: '#fff', borderRadius: 18, padding: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    display: 'flex', flexDirection: 'column', gap: 10,
  },

  // Order summary
  orderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  orderName: { fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  orderQty: { color: '#8e8e93', fontWeight: 400 },
  orderPrice: { fontSize: 14, fontWeight: 700, color: '#1a1a1a' },
  orderTotalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 10, borderTop: '1px solid #f0f0f2', marginTop: 4,
    fontSize: 14, color: '#8e8e93', fontWeight: 600,
  },
  orderTotal: { fontSize: 18, fontWeight: 800, color: '#1a1a1a' },

  // Inputs
  input: {
    border: '1.5px solid #e5e5ea', borderRadius: 14, padding: '13px 14px',
    fontSize: 15, background: '#f8f8fa', color: '#1a1a1a',
    outline: 'none', width: '100%', fontFamily: 'inherit', boxSizing: 'border-box',
  },

  // Location
  locRow: { display: 'flex', gap: 8 },
  locBtn: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 8px', borderRadius: 14,
    border: '1.5px solid #e5e5ea', background: '#f8f8fa',
    fontSize: 13, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
  },
  locBtnPrimary: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    padding: '11px 8px', borderRadius: 14,
    border: `1.5px solid ${C}`, background: `${C}08`,
    fontSize: 13, fontWeight: 700, color: C, cursor: 'pointer',
  },
  locConfirmed: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 13, fontWeight: 600, color: C,
  },

  // Bottles
  bottleRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  bottleText: { fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  stepper: {
    display: 'flex', alignItems: 'center',
    background: '#f0f0f2', borderRadius: 12, overflow: 'hidden',
  },
  stepperBtn: {
    background: GRAD, border: 'none', width: 34, height: 34,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#fff', fontSize: 18, fontWeight: 700,
  },
  stepperBtnDisabled: {
    background: '#ccc', cursor: 'default',
  },
  stepperVal: {
    fontWeight: 700, fontSize: 16, minWidth: 32, textAlign: 'center', color: '#1a1a1a',
  },
  discountLine: {
    fontSize: 13, fontWeight: 600, color: C,
    background: `${C}08`, borderRadius: 10, padding: '8px 10px',
  },

  // Discounts
  discountRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  discountName: { fontSize: 14, fontWeight: 600, color: '#1a1a1a' },
  discountAvail: { fontSize: 12, color: '#8e8e93', marginTop: 2 },
  useBtn: {
    padding: '8px 14px', borderRadius: 12,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 700, color: '#3c3c43', cursor: 'pointer',
  },
  useBtnActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },

  // Payment methods
  payMethod: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14,
    border: '1.5px solid transparent', background: '#f8f8fa',
    cursor: 'pointer', width: '100%',
  },
  payMethodActive: {
    border: `1.5px solid ${C}30`, background: `${C}06`,
  },
  payMethodLabel: { fontSize: 15, fontWeight: 600 },

  // Balance note
  balanceNote: {
    background: `${C}10`, borderRadius: 14, padding: '12px 14px',
    display: 'flex', alignItems: 'center', gap: 8,
  },

  // Total
  totalSection: {
    padding: '8px 16px 8px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 4px',
  },
  totalLabel: { fontSize: 15, fontWeight: 600, color: '#8e8e93' },
  totalAmt: { fontSize: 26, fontWeight: 800, color: '#1a1a1a', letterSpacing: -0.5 },
  primaryBtn: {
    background: GRAD, color: '#fff', border: 'none', borderRadius: 14,
    height: 52, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#8e8e93',
    padding: '12px 0', fontSize: 14, cursor: 'pointer', textAlign: 'center',
    width: '100%',
  },
  errorBox: {
    background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 14,
    padding: '10px 12px', fontSize: 13, color: '#ef4444', fontWeight: 500,
  },
  spinner: {
    width: 20, height: 20, borderRadius: '50%',
    border: '2.5px solid rgba(255,255,255,0.3)',
    borderTop: '2.5px solid #fff',
    animation: 'spin 0.7s linear infinite', display: 'inline-block',
  },

  // Card payment screen
  payCard: {
    background: '#1a1a1a', borderRadius: 18, padding: '18px 16px',
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  payCardLabel: { fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 600 },
  payCardNum: { fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: 3, fontFamily: 'monospace' },
  payCardHolder: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1 },
  payAmtBig: { fontSize: 28, fontWeight: 800, color: C, letterSpacing: -0.5 },
  payAmtCur: { fontSize: 16, fontWeight: 400, color: 'rgba(255,255,255,0.35)' },
  cpyBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '8px 14px', alignSelf: 'flex-start',
    fontSize: 13, color: 'rgba(255,255,255,0.55)', cursor: 'pointer',
  },
  cpyBtnDone: {
    background: `${C}25`, borderColor: `${C}50`, color: C,
  },
  helpSteps: {
    display: 'flex', flexDirection: 'column', gap: 10,
    background: '#fff', borderRadius: 18, padding: 14,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  helpStep: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#3c3c43', fontWeight: 500 },
  helpNum: {
    width: 26, height: 26, borderRadius: '50%', background: GRAD, color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },

  // Success
  successPage: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '85dvh', padding: '0 24px', gap: 14,
    textAlign: 'center', background: '#e4e4e8',
  },
  successIcon: {
    width: 80, height: 80, borderRadius: '50%', background: GRAD,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 8, boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },
  successTitle: { fontSize: 24, fontWeight: 800, color: '#1a1a1a', margin: 0 },
  successDesc: { fontSize: 14, color: '#8e8e93', margin: 0 },

  // Saved addresses
  savedRow: {
    display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
    scrollbarWidth: 'none',
  },
  savedChip: {
    flexShrink: 0, padding: '8px 14px', borderRadius: 12,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 600, color: '#3c3c43', cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  savedChipActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },

  // Date/Time picker
  dateScroll: {
    display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4,
    scrollbarWidth: 'none',
  },
  dateChip: {
    flexShrink: 0, padding: '10px 14px', borderRadius: 14,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#3c3c43',
    textAlign: 'center', minWidth: 70,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  },
  dateChipActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },
  dateDay: { fontSize: 18, fontWeight: 800 },
  dateLabel: { fontSize: 11, fontWeight: 600 },
  timeRow: { display: 'flex', gap: 8, marginTop: 8 },
  timeBtn: {
    flex: 1, padding: '12px 8px', borderRadius: 14,
    border: '1.5px solid #e5e5ea', background: '#fff',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#3c3c43',
    textAlign: 'center',
  },
  timeBtnActive: {
    border: `1.5px solid ${C}`, background: `${C}08`, color: C,
  },

  // Popup overlay
  popupOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(4px)', zIndex: 9000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '0 24px',
  },
  popupCard: {
    background: '#fff', borderRadius: 22, padding: '24px 20px',
    width: '100%', maxWidth: 340,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
    textAlign: 'center',
  },
  popupTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 },
  popupDesc: { fontSize: 14, color: '#8e8e93', margin: 0, lineHeight: 1.5 },
  popupBtnRow: { display: 'flex', gap: 8, width: '100%' },
  popupBtnGhost: {
    flex: 1, padding: '13px 0', borderRadius: 14,
    border: 'none', background: '#f0f0f2',
    fontSize: 15, fontWeight: 600, color: '#8e8e93', cursor: 'pointer',
  },
  popupBtnPrimary: {
    flex: 1, padding: '13px 0', borderRadius: 14,
    border: 'none', background: GRAD, color: '#fff',
    fontSize: 15, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(100,160,30,0.3)',
  },

  // Bottle owed info
  bottleInfo: {
    fontSize: 12, color: '#8e8e93', marginTop: 2,
  },
}

export default s
