import type { ContractTemplateType } from '@/lib/db/types';
import { Briefcase, Shield, Building2, UserPlus, FileText } from 'lucide-react';

export interface ContractTemplateInfo {
  id: ContractTemplateType;
  name: string;
  icon: any;
  desc: string;
  defaultVariables: Record<string, any>;
}

export const CONTRACT_TEMPLATES: ContractTemplateInfo[] = [
  {
    id: 'employment',
    name: 'Employment Contract',
    icon: UserPlus,
    desc: 'Standard full-time employment agreement under Indian/Tamil Nadu laws.',
    defaultVariables: {
      employeeName: '',
      jobTitle: '',
      reportingManager: 'Harry (Sathyaseelan)',
      startDate: new Date().toISOString().split('T')[0],
      monthlySalary: '',
      hoursPerDay: '8',
      daysPerWeek: '5',
      paidLeaveDays: '15',
      sickLeaveDays: '7',
    },
  },
  {
    id: 'nda',
    name: 'Mutual NDA',
    icon: Shield,
    desc: 'Non-disclosure agreement protecting confidential information of both parties.',
    defaultVariables: {
      counterpartyName: '',
    },
  },
  {
    id: 'service',
    name: 'Service Agreement',
    icon: Briefcase,
    desc: 'B2B service agreement for digital, creative, dev or SaaS services.',
    defaultVariables: {
      counterpartyName: '',
      contractValue: '',
      sowDetails: 'Digital marketing and social media management.',
    },
  },
  {
    id: 'subscription',
    name: 'Subscription Agreement',
    icon: FileText,
    desc: 'Recurring software-as-a-service (SaaS) subscription terms.',
    defaultVariables: {
      subscriberName: '',
      productName: 'Your Product',
      seatLimit: '5',
      billingPeriod: 'Annual', // Monthly / Quarterly / Annual
      subscriptionFee: '',
      billingPeriodUnit: 'year', // month / quarter / year
    },
  },
  {
    id: 'vendor',
    name: 'Vendor Agreement',
    icon: Building2,
    desc: 'Procurement agreement for goods or outsourced service providers.',
    defaultVariables: {
      vendorName: '',
      goodsDescription: 'Design assets, content writing, and consulting.',
      contractValue: '',
      duration: '12 months',
    },
  },
];

export const TEMPLATE_TEXTS: Record<ContractTemplateType, string> = {
  employment: `Employment Contract TAGVERSE — Full-Time Employment

Effective Date: [EFFECTIVE_DATE]

This Employment Contract ("Agreement") is entered into as of [EFFECTIVE_DATE] by and between TAGVERSE (a brand under Blackbridge Collective) ("Employer") and [EMPLOYEE NAME] ("Employee").

1. Position & Duties
Employee is hired for the position of [JOB TITLE] and shall report to [REPORTING MANAGER/FOUNDER]. Employee agrees to perform all duties as assigned and described in the annexed Job Description (Exhibit A), and such other duties as may be reasonably assigned from time to time.

2. Commencement & Probation
Employment commences on [START DATE]. The first 3 months shall constitute a probationary period during which either party may terminate this Agreement with 7 days notice.

3. Compensation
Employee shall receive a gross monthly salary of INR [AMOUNT]. Salary will be reviewed annually. Additional benefits, if any, are described in Exhibit B.

4. Working Hours
Standard working hours are [X] hours per day, [Y] days per week, as per TAGVERSE's operational schedule. Flexible/remote work arrangements may apply as agreed with management.

5. Leave Policy
Employee is entitled to [P_LEAVE] days of paid annual leave, [S_LEAVE] days of sick leave, and public holidays as per the applicable state calendar. Leave must be applied for in advance and approved by management.

6. Confidentiality & IP
Employee agrees to maintain strict confidentiality of all company, client, and partner information. All work product, tools, content, code, and intellectual property created during employment belongs exclusively to TAGVERSE. This obligation survives termination.

7. Non-Solicitation
For 12 months following termination, Employee shall not solicit or engage any of TAGVERSE's clients, vendors, or employees for competing purposes.

8. Termination
Post-probation, either party may terminate this Agreement with 30 days written notice. TAGVERSE may terminate immediately for cause including gross misconduct, breach of confidentiality, or non-performance.

9. Governing Law
This Agreement is governed by the laws of India and the applicable labour laws of Tamil Nadu.

Signatures:
TAGVERSE (Blackbridge Collective)                  [EMPLOYEE NAME]

Signature: _______________________                 Signature: _______________________
Name: Harry (Sathyaseelan)                        Name: _______________________
Title: Founder & Managing Director                Title: _______________________
Date: [EFFECTIVE_DATE]                             Date: _______________________`,

  nda: `Mutual Non-Disclosure Agreement TAGVERSE & [COUNTERPARTY NAME]

Effective Date: [EFFECTIVE_DATE]

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of [EFFECTIVE_DATE] by and between TAGVERSE (a brand under Blackbridge Collective) ("Party A") and [COUNTERPARTY NAME] ("Party B"), collectively referred to as the "Parties."

1. Purpose
The Parties wish to explore a potential business relationship and, in connection therewith, may disclose to each other certain confidential and proprietary information. This Agreement sets forth the terms under which such information will be shared and protected.

2. Definition of Confidential Information
Confidential Information means any data or information disclosed by either Party that is designated as confidential or that reasonably should be understood to be confidential given the nature of the information and the circumstances of disclosure. This includes but is not limited to: business strategies, client lists, technical specifications, financial data, AI systems, marketing plans, and proprietary processes.

3. Obligations
Each Party agrees to:
(a) hold the other Party's Confidential Information in strict confidence;
(b) not disclose such information to any third party without prior written consent;
(c) use the Confidential Information solely for the purpose of evaluating the potential business relationship;
(d) limit access to Confidential Information to employees or contractors who have a need to know.

4. Exclusions
Confidential Information does not include information that:
(a) is or becomes publicly available through no breach of this Agreement;
(b) was rightfully known to the receiving Party prior to disclosure;
(c) is independently developed without use of the Confidential Information;
(d) is required to be disclosed by law or court order.

5. Term
This Agreement shall remain in effect for 2 years from the Effective Date. The confidentiality obligations shall survive termination for an additional 2 years.

6. Return of Information
Upon written request, each Party shall promptly return or destroy all Confidential Information and any copies thereof.

7. Governing Law
This Agreement shall be governed by the laws of India, with jurisdiction in Chennai, Tamil Nadu.

Signatures:
TAGVERSE (Blackbridge Collective)                  [COUNTERPARTY NAME]

Signature: _______________________                 Signature: _______________________
Name: Harry (Sathyaseelan)                        Name: _______________________
Title: Founder & Managing Director                Title: _______________________
Date: [EFFECTIVE_DATE]                             Date: _______________________`,

  service: `Service Agreement TAGVERSE — Client Services

Effective Date: [EFFECTIVE_DATE]
Contract ID: [CTR-XXXXXXX]

This Service Agreement ("Agreement") is entered into as of [EFFECTIVE_DATE] ("Effective Date") by and between TAGVERSE (a brand under Blackbridge Collective), headquartered in Chennai, Tamil Nadu, India ("Service Provider"), and [COUNTERPARTY NAME] ("Client").

1. Scope of Services
TAGVERSE agrees to provide the following services as mutually agreed upon in the accompanying Statement of Work (SOW): [SOW_DETAILS]
The specific deliverables, timelines, and milestones shall be defined in the SOW attached hereto as Exhibit A.

2. Payment Terms
Client agrees to pay the total contract value of $[VALUE] (or INR equivalent as agreed) for the services rendered over the duration of this Agreement. Payment shall be made as follows:
• 50% advance upon signing of this Agreement
• Remaining 50% upon project completion or as per milestone schedule in the SOW
All payments are due within 7 business days of invoice issuance. Late payments attract a 2% per month interest charge.

3. Term & Termination
This Agreement commences on the Effective Date and continues for the duration specified in the SOW, unless terminated earlier. Either party may terminate this Agreement with 30 days written notice. In the event of termination, Client shall pay for all work completed up to the termination date.

4. Intellectual Property
Upon receipt of full payment, all deliverables produced under this Agreement shall become the sole property of the Client. TAGVERSE retains the right to showcase completed work in its portfolio unless otherwise agreed in writing.

5. Confidentiality
Both parties agree to keep confidential all proprietary information shared during the course of this engagement. This obligation survives the termination of this Agreement for a period of 2 years.

6. Limitation of Liability
TAGVERSE's total liability under this Agreement shall not exceed the total fees paid by the Client in the 3 months preceding the claim. TAGVERSE is not liable for indirect, incidental, or consequential damages.

7. Governing Law
This Agreement shall be governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Chennai, Tamil Nadu.

Signatures:
IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

TAGVERSE (Blackbridge Collective)                  [COUNTERPARTY NAME]

Signature: _______________________                 Signature: _______________________
Name: Harry (Sathyaseelan)                        Name: _______________________
Title: Founder & Managing Director                Title: _______________________
Date: [EFFECTIVE_DATE]                             Date: _______________________`,

  subscription: `Subscription Agreement TAGVERSE — SaaS / Recurring Services

Effective Date: [EFFECTIVE_DATE]
Contract ID: [CTR-XXXXXXX]

This Subscription Agreement ("Agreement") is entered into as of [EFFECTIVE_DATE] by and between TAGVERSE (a brand under Blackbridge Collective) ("Provider") and [SUBSCRIBER NAME] ("Subscriber").

1. Subscription Services
Provider grants Subscriber a non-exclusive, non-transferable subscription to access and use [PRODUCT/SERVICE NAME] ("the Service") as described in the Service Description attached as Exhibit A. Access is limited to [SEAT_LIMIT] users/seats unless upgraded.

2. Subscription Term
The initial subscription term is [BILLING_PERIOD] commencing on the Effective Date ("Initial Term"). The subscription will auto-renew for successive periods of equal length unless either party provides written notice of non-renewal at least 30 days before the end of the then-current term.

3. Fees & Payment
Subscriber agrees to pay the subscription fee of $[VALUE] per [BILL_UNIT]. Fees are due in advance at the start of each billing period. All fees are non-refundable except as expressly stated herein. Late payment attracts a 2% monthly surcharge.

4. Usage & Restrictions
Subscriber shall not:
(a) sublicense, resell, or transfer the Service;
(b) reverse engineer or copy the Service;
(c) use the Service for unlawful purposes;
(d) exceed the permitted usage limits without upgrading the subscription.

5. Upgrades & Downgrades
Subscriber may upgrade their plan at any time, with charges prorated. Downgrades take effect at the next renewal date. TAGVERSE reserves the right to modify service tiers with 30 days prior written notice.

6. Service Availability
TAGVERSE targets 99% uptime for the Service. Planned maintenance will be communicated in advance. TAGVERSE is not liable for downtime caused by third-party infrastructure, force majeure, or Subscriber-side issues.

7. Data & Privacy
TAGVERSE will process Subscriber data in accordance with its Privacy Policy. Subscriber data will not be shared with third parties except as required for service delivery or by law.

8. Termination
Either party may terminate this Agreement at the end of any billing period with written notice. TAGVERSE may suspend or terminate access immediately for non-payment or breach of terms, without refund of prepaid fees.

9. Governing Law
This Agreement is governed by the laws of India. Disputes shall be resolved in Chennai, Tamil Nadu.

Signatures:
TAGVERSE (Blackbridge Collective)                  [SUBSCRIBER NAME]

Signature: _______________________                 Signature: _______________________
Name: Harry (Sathyaseelan)                        Name: _______________________
Title: Founder & Managing Director                Title: _______________________
Date: [EFFECTIVE_DATE]                             Date: _______________________`,

  vendor: `Vendor Agreement TAGVERSE — Procurement Contract

Effective Date: [EFFECTIVE_DATE]
Contract ID: [CTR-XXXXXXX]

This Vendor Agreement ("Agreement") is entered into as of [EFFECTIVE_DATE] by and between TAGVERSE (a brand under Blackbridge Collective) ("Client/Buyer") and [VENDOR NAME] ("Vendor"), for the procurement of goods or services as detailed herein.

1. Services / Goods to be Provided
Vendor agrees to supply [DESCRIPTION_OF_GOODS] as specified in the Purchase Order or Statement of Work attached hereto. All deliverables must meet the quality standards and specifications agreed upon in writing prior to commencement.

2. Compensation
TAGVERSE agrees to pay Vendor the total amount of $[VALUE] as per the agreed payment schedule. Invoices must be submitted with supporting documentation. Payment will be processed within 15 business days of invoice approval.

3. Term
This Agreement is effective from the Effective Date and continues until the completion of the engagement or for a period of [DURATION], whichever comes first, unless terminated earlier.

4. Compliance & Standards
Vendor shall comply with all applicable laws, regulations, and TAGVERSE's internal standards and brand guidelines where applicable. Vendor shall not subcontract any work without prior written consent from TAGVERSE.

5. Confidentiality
Vendor agrees to maintain confidentiality of all information received from TAGVERSE and shall not disclose such information to any third party. This obligation continues for 2 years post-termination.

6. Intellectual Property
All work product created by Vendor under this Agreement that is specifically commissioned by TAGVERSE shall be considered work-for-hire and shall be the sole property of TAGVERSE upon full payment.

7. Termination
Either party may terminate this Agreement with 15 days written notice. TAGVERSE may terminate immediately for cause, including breach of confidentiality, non-performance, or legal violations.

8. Governing Law
This Agreement shall be governed by Indian law with jurisdiction in Chennai, Tamil Nadu.

Signatures:
TAGVERSE (Blackbridge Collective)                  [VENDOR NAME]

Signature: _______________________                 Signature: _______________________
Name: Harry (Sathyaseelan)                        Name: _______________________
Title: Founder & Managing Director                Title: _______________________
Date: [EFFECTIVE_DATE]                             Date: _______________________`,
};

export function interpolateContractTemplate(
  type: ContractTemplateType,
  contractNumber: string,
  effectiveDate: string,
  variables: Record<string, any>
): string {
  const template = TEMPLATE_TEXTS[type];
  if (!template) return '';

  let text = template;
  
  // Base replacements
  text = text.replace(/\[EFFECTIVE_DATE\]/g, effectiveDate ? new Date(effectiveDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');
  text = text.replace(/\[CTR-XXXXXXX\]/g, contractNumber || '—');

  // Dynamic values
  if (type === 'employment') {
    text = text.replace(/\[EMPLOYEE NAME\]/g, variables.employeeName || '[EMPLOYEE NAME]');
    text = text.replace(/\[JOB TITLE\]/g, variables.jobTitle || '[JOB TITLE]');
    text = text.replace(/\[REPORTING MANAGER\/FOUNDER\]/g, variables.reportingManager || '[REPORTING MANAGER/FOUNDER]');
    text = text.replace(/\[START DATE\]/g, variables.startDate ? new Date(variables.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '[START DATE]');
    text = text.replace(/\[AMOUNT\]/g, variables.monthlySalary || '[AMOUNT]');
    text = text.replace(/\[X\] hours per day/g, `${variables.hoursPerDay || 'X'} hours per day`);
    text = text.replace(/\[Y\] days per week/g, `${variables.daysPerWeek || 'Y'} days per week`);
    text = text.replace(/\[P_LEAVE\]/g, variables.paidLeaveDays || '[P_LEAVE]');
    text = text.replace(/\[S_LEAVE\]/g, variables.sickLeaveDays || '[S_LEAVE]');
  } else if (type === 'nda') {
    text = text.replace(/\[COUNTERPARTY NAME\]/g, variables.counterpartyName || '[COUNTERPARTY NAME]');
  } else if (type === 'service') {
    text = text.replace(/\[COUNTERPARTY NAME\]/g, variables.counterpartyName || '[COUNTERPARTY NAME]');
    text = text.replace(/\[SOW_DETAILS\]/g, variables.sowDetails || '[SOW_DETAILS]');
    text = text.replace(/\[VALUE\]/g, variables.contractValue || '[VALUE]');
  } else if (type === 'subscription') {
    text = text.replace(/\[SUBSCRIBER NAME\]/g, variables.subscriberName || '[SUBSCRIBER NAME]');
    text = text.replace(/\[PRODUCT\/SERVICE NAME\]/g, variables.productName || '[PRODUCT/SERVICE NAME]');
    text = text.replace(/\[SEAT_LIMIT\]/g, variables.seatLimit || '[NUMBER]');
    text = text.replace(/\[BILLING_PERIOD\]/g, (variables.billingPeriod || '[MONTHLY / QUARTERLY / ANNUAL]').toUpperCase());
    text = text.replace(/\[VALUE\]/g, variables.subscriptionFee || '[VALUE]');
    text = text.replace(/\[BILL_UNIT\]/g, variables.billingPeriodUnit || '[month/quarter/year]');
  } else if (type === 'vendor') {
    text = text.replace(/\[VENDOR NAME\]/g, variables.vendorName || '[VENDOR NAME]');
    text = text.replace(/\[DESCRIPTION_OF_GOODS\]/g, variables.goodsDescription || '[DESCRIPTION OF SERVICES/GOODS]');
    text = text.replace(/\[VALUE\]/g, variables.contractValue || '[VALUE]');
    text = text.replace(/\[DURATION\]/g, variables.duration || '[DURATION]');
  }

  return text;
}
