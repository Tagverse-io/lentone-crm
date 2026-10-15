// Normalized Database Operations
// This module provides the relationship-driven CRM data layer

// ===== Types =====
export * from '../types';

// ===== Events =====
export { onEvent, emitEvent, clearEventHandlers } from '../events';

// ===== Companies =====
export {
  createCompany,
  getCompany,
  getCompanies,
  updateCompany,
  deleteCompany,
  findCompanyByName,
  searchCompanies,
  subscribeToCompanies,
  getCompanyDefaults,
  getCompanyStats,
} from '../companies/api';

// ===== Contacts =====
export {
  createContact,
  getContact,
  getContacts,
  getCompanyContacts,
  updateContact,
  deleteContact,
  findContactsByEmail,
  findContactsByPhone,
  searchContacts,
  getPrimaryContact,
  subscribeToContacts,
  subscribeToCompanyContacts,
} from '../contacts/api';

// ===== Deals =====
export {
  createDeal,
  getDeal,
  getDeals,
  getCompanyDeals,
  getContactDeals,
  getPipelineDeals,
  getStageDeals,
  updateDeal,
  deleteDeal,
  moveDealToStage,
  markDealAsWon,
  markDealAsLost,
  searchDeals,
  getDealsByStatus,
  getDealStats,
  subscribeToDeals,
  subscribeToCompanyDeals,
} from '../deals/api';

// ===== Quotes =====
export {
  createQuote,
  getQuote,
  getQuotes,
  getCompanyQuotes,
  getDealQuotes,
  updateQuote,
  deleteQuote,
  markQuoteAsSent,
  markQuoteAsAccepted,
  markQuoteAsRejected,
  searchQuotes,
  getQuotesByStatus,
  getExpiringQuotes,
  getQuoteStats,
  calculateQuoteTotals,
  generateQuoteNumber,
  subscribeToQuotes,
  subscribeToCompanyQuotes,
} from '../quotes/api';

// ===== Invoices =====
export {
  createInvoice,
  getInvoice,
  getInvoices,
  getCompanyInvoices,
  getDealInvoices,
  getQuoteInvoices,
  updateInvoice,
  deleteInvoice,
  markInvoiceAsSent,
  markInvoiceAsPaid,
  markInvoiceAsOverdue,
  searchInvoices,
  getInvoicesByStatus,
  getOverdueInvoices,
  getInvoicesDueSoon,
  getInvoiceStats,
  calculateInvoiceTotals,
  generateInvoiceNumber,
  subscribeToInvoices,
  subscribeToCompanyInvoices,
} from '../invoices/api';

// ===== Payments =====
export {
  createPayment,
  getPayment,
  getPayments,
  getCompanyPayments,
  getInvoicePayments,
  getDealPayments,
  updatePayment,
  deletePayment,
  recordPayment,
  searchPayments,
  getPaymentsByStatus,
  getPaymentsByMethod,
  getPaymentsInDateRange,
  getPaymentStats,
  subscribeToPayments,
  subscribeToCompanyPayments,
} from '../payments/api';

// ===== Activities =====
export {
  logActivity,
  getActivities,
  getCompanyActivities,
  getDealActivities,
  getContactActivities,
  getQuoteActivities,
  getInvoiceActivities,
  getLeadActivities,
  logLeadCreated,
  logLeadQualified,
  logDealCreated,
  logDealStageChanged,
  logQuoteCreated,
  logInvoiceCreated,
  logPaymentReceived,
  getActivityLabel,
  getActivityIcon,
  subscribeToActivities,
  subscribeToCompanyActivities,
} from '../activities/api';

// ===== Relationship Protection =====
export {
  checkCompanyRelationships,
  canDeleteCompany,
  checkContactRelationships,
  canDeleteContact,
  checkDealRelationships,
  canDeleteDeal,
  canDeleteQuote,
  canDeleteInvoice,
  getRelationshipSummary,
} from '../relationship-protection';
