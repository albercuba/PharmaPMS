export type IntegrationContext = {
  organizationId: string;
  countryCode: string;
  locale: string;
  requestId?: string;
};
export type IntegrationResult<T> = {
  status: 'SUCCESS' | 'NOT_CONFIGURED' | 'FAILED';
  data?: T;
  message?: string;
};

export interface ElectronicPrescriptionAdapter {
  receivePrescription(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface ClinicalMedicationDataAdapter {
  lookupMedication(
    identifier: string,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface WholesalerAdapter {
  submitPurchaseOrder(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface AccountingAdapter {
  exportTransactions(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface InsuranceAdapter {
  checkEligibility(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface PaymentAdapter {
  authorize(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
  refund(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface CommunicationAdapter {
  sendMessage(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface RegulatoryReportingAdapter {
  submitReport(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}
export interface DispensingMachineAdapter {
  submitDispense(
    input: unknown,
    context: IntegrationContext,
  ): Promise<IntegrationResult<unknown>>;
}

export type IntegrationRegistry = Partial<{
  electronicPrescription: ElectronicPrescriptionAdapter;
  clinicalMedicationData: ClinicalMedicationDataAdapter;
  wholesaler: WholesalerAdapter;
  accounting: AccountingAdapter;
  insurance: InsuranceAdapter;
  payment: PaymentAdapter;
  communication: CommunicationAdapter;
  regulatoryReporting: RegulatoryReportingAdapter;
  dispensingMachine: DispensingMachineAdapter;
}>;
