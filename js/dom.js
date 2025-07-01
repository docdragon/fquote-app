

/**
 * @file dom.js
 * @description Tập trung tất cả các truy vấn DOM của ứng dụng.
 */

// === GENERAL APP & UI ===
export const loader = document.getElementById('loader');
export const appContainer = document.getElementById('app-container');

// === AUTHENTICATION ===
export const authModal = document.getElementById('auth-modal');
export const authStatusEl = document.getElementById('auth-status');
export const logoutButton = document.getElementById('logoutButton');
export const loginForm = document.getElementById('login-form');
export const signupForm = document.getElementById('signup-form');
export const loginErrorEl = document.getElementById('login-error');
export const signupErrorEl = document.getElementById('signup-error');
export const showSignupLink = document.getElementById('show-signup');
export const showLoginLink = document.getElementById('show-login');
export const forgotPasswordLink = document.getElementById('forgot-password-link');
export const toggleLoginPasswordButton = document.getElementById('toggle-login-password');
export const rememberMeCheckbox = document.getElementById('remember-me');


// === TABS ===
export const tabButtons = document.querySelectorAll('.tab-button');
export const tabContents = document.querySelectorAll('.tab-content');

// === QUOTE INFO ===
export const customerNameInput = document.getElementById('customerName');
export const customerAddressInput = document.getElementById('customerAddress');
export const quoteDateInput = document.getElementById('quoteDate');
export const createQuoteFromTemplateSelect = document.getElementById('createQuoteFromTemplateSelect');


// === QUOTE ITEM ENTRY FORM ===
export const quoteItemEntryFormDiv = document.getElementById('quoteItemEntryForm');
export const editingQuoteItemIdInputForm = document.getElementById('editingQuoteItemIdForm');
export const quoteItemMainCategoryInput = document.getElementById('quoteItemMainCategoryInput');
export const mainCategoryDataList = document.getElementById('mainCategoryDataList');
export const itemNameQuoteForm = document.getElementById('itemNameQuoteForm');
export const itemNameSuggestionsContainer = document.getElementById('itemNameSuggestionsContainer'); 
export const itemSpecQuoteForm = document.getElementById('itemSpecQuoteForm');
export const itemUnitQuoteForm = document.getElementById('itemUnitQuoteForm');
export const itemPriceQuoteForm = document.getElementById('itemPriceQuoteForm');
export const itemDiscountValueForm = document.getElementById('itemDiscountValueForm');
export const itemDiscountTypeForm = document.getElementById('itemDiscountTypeForm');
export const itemCalcTypeQuoteForm = document.getElementById('itemCalcTypeQuoteForm');
export const itemNotesQuoteForm = document.getElementById('itemNotesQuoteForm'); 

export const groupItemLengthQuoteForm = document.getElementById('groupItemLengthQuoteForm'); 
export const groupItemHeightQuoteForm = document.getElementById('groupItemHeightQuoteForm'); 
export const groupItemDepthQuoteForm = document.getElementById('groupItemDepthQuoteForm');   
export const itemLengthQuoteForm = document.getElementById('itemLengthQuoteForm');
export const itemHeightQuoteForm = document.getElementById('itemHeightQuoteForm');
export const itemDepthQuoteForm = document.getElementById('itemDepthQuoteForm');
export const itemQuantityQuoteForm = document.getElementById('itemQuantityQuoteForm');
export const itemImageFileQuoteForm = document.getElementById('itemImageFileQuoteForm');
export const itemImagePreviewQuoteForm = document.getElementById('itemImagePreviewQuoteForm');
export const removeItemImageButtonQuoteForm = document.getElementById('removeItemImageButtonQuoteForm');
export const addOrUpdateItemButtonForm = document.getElementById('addOrUpdateItemButtonForm');
export const quickSaveToCatalogButtonForm = document.getElementById('quickSaveToCatalogButtonForm');
export const cancelEditQuoteItemButtonForm = document.getElementById('cancelEditQuoteItemButtonForm');
export const itemLineTotalPreviewForm = document.getElementById('itemLineTotalPreviewForm');


// === QUOTE PREVIEW & TOTALS ===
export const itemListPreviewTableBody = document.getElementById('itemListPreview');
export const prepareNewQuoteItemButton = document.getElementById('prepareNewQuoteItemButton');
export const subTotalSpan = document.getElementById('subTotal');
export const applyDiscountCheckbox = document.getElementById('applyDiscountCheckbox');
export const discountValueInput = document.getElementById('discountValueInput'); 
export const discountTypeSelect = document.getElementById('discountTypeSelect');
export const discountAmountSpan = document.getElementById('discountAmount');
export const applyTaxCheckbox = document.getElementById('applyTaxCheckbox');
export const taxPercentInput = document.getElementById('taxPercent');
export const taxAmountSpan = document.getElementById('taxAmount');
export const totalPriceSpan = document.getElementById('totalPrice');

// === PROFIT ANALYSIS (QUOTE TAB) ===
export const estimatedTotalCogsSpan = document.getElementById('estimatedTotalCogs');
export const estimatedGrossProfitSpan = document.getElementById('estimatedGrossProfit');
export const grossProfitMarginPercentSpan = document.getElementById('grossProfitMarginPercent');


// === INSTALLMENTS SECTION ===
export const applyInstallmentsCheckbox = document.getElementById('applyInstallmentsCheckbox');
export const installmentsContainer = document.getElementById('installmentsContainer');
export const addInstallmentButton = document.getElementById('add-installment-button');
export const installmentsListContainer = document.getElementById('installments-list');
export const installmentsSummaryDiv = document.getElementById('installments-summary');

// === MAIN ACTION BUTTONS ===
export const saveCurrentQuoteButton = document.getElementById('saveCurrentQuoteButton');
export const exportPdfButton = document.getElementById('exportPdfButton');
export const clearQuoteButton = document.getElementById('clearQuoteButton');
export const saveQuoteAsTemplateButton = document.getElementById('saveQuoteAsTemplateButton');
export const exportFullQuoteButton = document.getElementById('exportFullQuoteButton'); 
export const previewPdfButton = document.getElementById('previewPdfButton');


// === SAVED QUOTES TAB ===
export const savedQuotesSearchInput = document.getElementById('savedQuotesSearchInput');
export const savedQuotesStartDateFilter = document.getElementById('savedQuotesStartDateFilter'); 
export const savedQuotesEndDateFilter = document.getElementById('savedQuotesEndDateFilter'); 
export const savedQuotesMinTotalFilter = document.getElementById('savedQuotesMinTotalFilter'); 
export const savedQuotesMaxTotalFilter = document.getElementById('savedQuotesMaxTotalFilter'); 
export const savedQuotesStatusFilter = document.getElementById('savedQuotesStatusFilter'); 
export const savedQuotesTableBody = document.getElementById('savedQuotesList');
export const loadMoreQuotesButton = document.getElementById('loadMoreQuotesButton');

// === CATALOG MANAGEMENT TAB ===
export const excelFileInputManage = document.getElementById('excelFileManage');
export const reloadExcelButton = document.getElementById('reloadExcelButton');
export const catalogSearchInput = document.getElementById('catalogSearchInput');
export const catalogFilterMainCategorySelect = document.getElementById('catalogFilterMainCategorySelect'); 
export const catalogMinPriceFilter = document.getElementById('catalogMinPriceFilter'); 
export const catalogMaxPriceFilter = document.getElementById('catalogMaxPriceFilter'); 
export const catalogSortSelect = document.getElementById('catalogSortSelect'); 
export const catalogPreviewList = document.getElementById('catalogPreviewList');
export const catalogItemCount = document.getElementById('catalogItemCount');
export const exportCatalogButton = document.getElementById('exportCatalogButton');
export const catalogPreviewTable = document.getElementById('catalogPreviewTable'); 

// === CATALOG ENTRY EDIT FORM ===
export const editingCatalogEntryIdInput = document.getElementById('editingCatalogEntryId');
export const catalogEditMainCategorySelect = document.getElementById('catalogEditMainCategorySelect'); 
export const catalogEditNameInput = document.getElementById('catalogEditName');
export const catalogEditSpecInput = document.getElementById('catalogEditSpec');
export const catalogEditUnitInput = document.getElementById('catalogEditUnit');
export const catalogEditPriceInput = document.getElementById('catalogEditPrice');
export const saveCatalogEntryButton = document.getElementById('saveCatalogEntryButton');
export const cancelCatalogEntryEditButton = document.getElementById('cancelCatalogEntryEditButton');

// === MAIN CATEGORY MANAGEMENT ===
export const mainCategoryNameInput = document.getElementById('mainCategoryNameInput');
export const editingMainCategoryIdInput = document.getElementById('editingMainCategoryId');
export const addOrUpdateMainCategoryButton = document.getElementById('addOrUpdateMainCategoryButton');
export const cancelEditMainCategoryButton = document.getElementById('cancelEditMainCategoryButton');
export const mainCategoriesTableBody = document.getElementById('mainCategoriesList');
export const mainCategoryCountSpan = document.getElementById('mainCategoryCount');

// === COMPANY SETTINGS TAB ===
export const companyNameSettingInput = document.getElementById('companyNameSetting');
export const companyAddressSettingInput = document.getElementById('companyAddressSetting');
export const companyPhoneSettingInput = document.getElementById('companyPhoneSetting');
export const companyEmailSettingInput = document.getElementById('companyEmailSetting');
export const companyTaxIdSettingInput = document.getElementById('companyTaxIdSetting');
export const companyBankAccountSetting = document.getElementById('companyBankAccountSetting');
export const companyLogoFileInput = document.getElementById('companyLogoFile');
export const logoPreview = document.getElementById('logoPreview');
export const saveCompanySettingsButton = document.getElementById('saveCompanySettingsButton');
export const defaultNotesSettingInput = document.getElementById('defaultNotesSetting');

// Tùy chỉnh In ấn
export const printTitleSettingInput = document.getElementById('printTitleSetting');
export const printCreatorNameSettingInput = document.getElementById('printCreatorNameSetting'); 
export const printFooterSettingInput = document.getElementById('printFooterSetting');

// Interface Settings
export const globalDarkModeToggleButton = document.getElementById('globalDarkModeToggleButton');

// Data Backup & Restore
export const backupDataButton = document.getElementById('backupDataButton');
export const restoreDataFile = document.getElementById('restoreDataFile'); // Changed ID from restoreDataFileInput for consistency
export const restoreDataButton = document.getElementById('restoreDataButton');
export const restoreDataStatusP = document.getElementById('restoreDataStatus');


// === ADMIN TAB ===
export const adminSearchUserInput = document.getElementById('admin-search-user-input'); 
export const adminFetchUserButton = document.getElementById('admin-fetch-user-button');
export const adminUserDetailsContainer = document.getElementById('admin-user-details-container');
export const adminUserDetailsDiv = document.getElementById('admin-user-details');
export const adminTargetUserIdInput = document.getElementById('admin-target-user-id');
export const adminDaysToExtendInput = document.getElementById('admin-days-to-extend'); 
export const adminUpdateExpiryButton = document.getElementById('admin-update-expiry-button');
export const adminUpdateStatusP = document.getElementById('admin-update-status');
// New Admin DOM elements
export const adminDefaultTrialDaysInput = document.getElementById('admin-default-trial-days');
export const adminSaveGlobalSettingsButton = document.getElementById('admin-save-global-settings-button');
export const adminGlobalSettingsStatusP = document.getElementById('admin-global-settings-status');
export const adminRefreshStatsButton = document.getElementById('admin-refresh-stats-button');
export const adminStatsDisplayDiv = document.getElementById('admin-stats-display');
export const statsTotalUsersSpan = document.getElementById('stats-total-users');
export const statsActiveUsersSpan = document.getElementById('stats-active-users');
export const statsExpiredLockedUsersSpan = document.getElementById('stats-expired-locked-users');
export const statsNewLast7DaysSpan = document.getElementById('stats-new-last-7-days');
export const adminUserStatusSelect = document.getElementById('admin-user-status-select');
export const adminUpdateStatusButton = document.getElementById('admin-update-status-button');


// === COSTING TAB ===
export const costingProductNameInput = document.getElementById('costingProductName');
export const costingSheetIdInput = document.getElementById('costingSheetId'); 
export const costingQuantityProducedInput = document.getElementById('costingQuantityProduced');
export const createCostingFromTemplateSelect = document.getElementById('createCostingFromTemplateSelect');


// Product Dimensions 
export const costingProductLengthInput = document.getElementById('costingProductLength');
export const costingProductWidthInput = document.getElementById('costingProductWidth');
export const costingProductHeightInput = document.getElementById('costingProductHeight');

// Material Costing
export const costingMaterialFormDetails = document.getElementById('costingMaterialFormDetails'); 
export const costingMaterialEntryForm = document.getElementById('costingMaterialEntryForm'); 
export const editingMaterialIdInput = document.getElementById('editingMaterialIdInput'); 
export const costingMaterialNameInput = document.getElementById('costingMaterialName');
export const costingMaterialNameSuggestionsContainer = document.getElementById('costingMaterialNameSuggestionsContainer'); 
export const costingMaterialSpecInput = document.getElementById('costingMaterialSpec'); 
export const costingMaterialUnitInput = document.getElementById('costingMaterialUnit');
export const costingMaterialDimensionsInput = document.getElementById('costingMaterialDimensions'); 
export const costingMaterialQuantityInput = document.getElementById('costingMaterialQuantity');
export const costingMaterialQuantityLabel = document.getElementById('costingMaterialQuantityLabel'); 
export const costingMaterialLinkDim = document.getElementById('costingMaterialLinkDim'); 
export const costingMaterialPriceInput = document.getElementById('costingMaterialPrice');
export const costingMaterialWasteInput = document.getElementById('costingMaterialWaste'); 
export const addCostingMaterialButton = document.getElementById('addCostingMaterialButton');
export const saveMaterialToLibraryButton = document.getElementById('saveMaterialToLibraryButton'); 
export const cancelEditMaterialButton = document.getElementById('cancelEditMaterialButton'); 
export const costingMaterialsTableBody = document.getElementById('costingMaterialsList');
export const totalDirectMaterialsCostSpan = document.getElementById('totalDirectMaterialsCostSpan');

// Labor Costing
export const costingLaborFormDetails = document.getElementById('costingLaborFormDetails'); 
export const costingLaborEntryForm = document.getElementById('costingLaborEntryForm'); 
export const editingLaborIdInput = document.getElementById('editingLaborIdInput'); 
export const costingLaborDescriptionInput = document.getElementById('costingLaborDescription'); 
export const costingLaborHoursInput = document.getElementById('costingLaborHours');
export const costingLaborRateInput = document.getElementById('costingLaborRate');
export const addCostingLaborButton = document.getElementById('addCostingLaborButton');
export const cancelEditLaborButton = document.getElementById('cancelEditLaborButton'); 
export const costingLaborTableBody = document.getElementById('costingLaborList');
export const totalDirectLaborCostSpan = document.getElementById('totalDirectLaborCostSpan');

// Manufacturing Overhead
export const costingOverheadTotalInput = document.getElementById('costingOverheadTotal');

// Management & Sales Costs (New)
export const costingManagementCostTotalInput = document.getElementById('costingManagementCostTotal');
export const costingSalesMarketingCostTotalInput = document.getElementById('costingSalesMarketingCostTotal');

// Other Costs 
export const costingOtherCostFormDetails = document.getElementById('costingOtherCostFormDetails'); 
export const costingOtherCostEntryForm = document.getElementById('costingOtherCostEntryForm'); 
export const editingOtherCostIdInput = document.getElementById('editingOtherCostIdInput'); 
export const costingOtherCostDescriptionInput = document.getElementById('costingOtherCostDescription');
export const costingOtherCostAmountInput = document.getElementById('costingOtherCostAmount');
export const addCostingOtherCostButton = document.getElementById('addCostingOtherCostButton');
export const cancelEditOtherCostButton = document.getElementById('cancelEditOtherCostButton'); 
export const costingOtherCostsTableBody = document.getElementById('costingOtherCostsList');
export const totalOtherCostsSpan = document.getElementById('totalOtherCostsSpan');


// Costing Results & Actions
export const totalCostSpan = document.getElementById('totalCostSpan'); // Renamed from totalProductionCostSpan
export const unitCostSpan = document.getElementById('unitCostSpan'); // Renamed from unitProductionCostSpan

export const calculateCostingButton = document.getElementById('calculateCostingButton');
export const saveCostingButton = document.getElementById('saveCostingButton');
export const clearCostingFormButton = document.getElementById('clearCostingFormButton');
export const saveCostingAsTemplateButton = document.getElementById('saveCostingAsTemplateButton');

// What-If Scenario Analysis
export const whatIfMaterialChangeInput = document.getElementById('whatIfMaterialChange');
export const whatIfLaborChangeInput = document.getElementById('whatIfLaborChange');
export const whatIfOverheadChangeInput = document.getElementById('whatIfOverheadChange');
export const whatIfManagementChangeInput = document.getElementById('whatIfManagementChange');
export const whatIfSalesMarketingChangeInput = document.getElementById('whatIfSalesMarketingChange');
export const calculateWhatIfButton = document.getElementById('calculateWhatIfButton');
export const whatIfUnitCostSpan = document.getElementById('whatIfUnitCostSpan');
export const whatIfDifferenceSpan = document.getElementById('whatIfDifferenceSpan');


// Saved Costing Sheets
export const savedCostingsTableBody = document.getElementById('savedCostingsList');

// Materials Library section 
export const materialsLibrarySection = document.getElementById('materialsLibrarySection');
export const materialsLibraryCountSpan = document.getElementById('materialsLibraryCountSpan');
export const materialsLibrarySearchInput = document.getElementById('materialsLibrarySearchInput');
export const materialsLibraryTable = document.getElementById('materialsLibraryTable');
export const materialsLibraryList = document.getElementById('materialsLibraryList');

// === TEMPLATE MANAGEMENT TAB ===
export const tabTemplateManagement = document.getElementById('tabTemplateManagement');
export const quoteTemplatesTableBody = document.getElementById('quoteTemplatesTableBody');
export const costingTemplatesTableBody = document.getElementById('costingTemplatesTableBody');
export const quoteTemplateCountSpan = document.getElementById('quoteTemplateCountSpan');
export const costingTemplateCountSpan = document.getElementById('costingTemplateCountSpan');
