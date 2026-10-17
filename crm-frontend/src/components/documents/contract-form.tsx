'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { ArrowLeft, Save, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentLayout } from './document-layout';
import { useWorkspace } from '@/lib/settings/workspace-context';
import { useAuth } from '@/lib/firebase/auth-context';
import { createContract, updateContract, getLeads } from '@/lib/firebase/database';
import type { Contract, ContractTemplateType, ContractStatus, Lead } from '@/lib/db/types';
import { CONTRACT_TEMPLATES, interpolateContractTemplate } from './contract-templates';
import jsPDF from 'jspdf';

interface ContractFormProps {
  existingContract?: Contract | null;
}

export function ContractForm({ existingContract }: ContractFormProps) {
  const router = useRouter();
  const { settings } = useWorkspace();
  const { workspace, user } = useAuth();
  const [saving, setSaving] = useState(false);

  // Core metadata fields
  const [contractNumber, setContractNumber] = useState(
    existingContract?.contract_number || `CTR-${Date.now().toString().slice(-6)}`
  );
  const [templateType, setTemplateType] = useState<ContractTemplateType>(
    existingContract?.template_type || 'service'
  );
  const [status, setStatus] = useState<ContractStatus>(
    existingContract?.status || 'draft'
  );
  const [clientName, setClientName] = useState(existingContract?.client_name || '');
  const [clientEmail, setClientEmail] = useState(existingContract?.client_email || '');
  const [clientAddress, setClientAddress] = useState(existingContract?.client_address || '');
  const [value, setValue] = useState(existingContract?.value?.toString() || '');
  const [currency, setCurrency] = useState(existingContract?.currency || settings.general.default_currency || 'USD');
  const [startDate, setStartDate] = useState(
    existingContract?.start_date || new Date().toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(existingContract?.end_date || '');

  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    if (workspace?.id) {
      getLeads(workspace?.id).then(setLeads);
    }
  }, [workspace?.id]);

  const clientOptions = Array.from(
    new Map(
      leads
        .filter((l) => l.company || l.name)
        .map((l) => {
          const val = l.company || l.name;
          return [val, { label: val, value: val, group: 'Saved Clients' }];
        })
    ).values()
  );

  const handleClientSelect = (val: string) => {
    setClientName(val);
    const lead = leads.find((l) => l.company === val || l.name === val);
    if (lead) {
      if (lead.email) setClientEmail(lead.email);
    }
  };

  // Template variables state
  const [variables, setVariables] = useState<Record<string, any>>({});

  // Initialize variables when template type changes or form loads
  useEffect(() => {
    const templateInfo = CONTRACT_TEMPLATES.find((t) => t.id === templateType);
    if (existingContract && existingContract.template_type === templateType) {
      setVariables(existingContract.variables || {});
    } else if (templateInfo) {
      setVariables(templateInfo.defaultVariables);
    }
  }, [templateType, existingContract]);

  // Synchronize key common fields into variables
  useEffect(() => {
    setVariables((prev) => ({
      ...prev,
      employeeName: templateType === 'employment' ? clientName : (prev.employeeName || ''),
      counterpartyName: ['nda', 'service'].includes(templateType) ? clientName : (prev.counterpartyName || ''),
      subscriberName: templateType === 'subscription' ? clientName : (prev.subscriberName || ''),
      vendorName: templateType === 'vendor' ? clientName : (prev.vendorName || ''),
      startDate: startDate || '',
      contractValue: value || '',
      subscriptionFee: value || '',
    }));
  }, [clientName, startDate, value, templateType]);

  const handleVariableChange = (key: string, val: any) => {
    setVariables((prev) => {
      const updated = { ...prev, [key]: val };
      // Sync back to top level states if applicable
      if (key === 'employeeName' || key === 'counterpartyName' || key === 'subscriberName' || key === 'vendorName') {
        setClientName(val);
      }
      if (key === 'startDate') {
        setStartDate(val);
      }
      if (key === 'contractValue' || key === 'subscriptionFee') {
        setValue(val);
      }
      return updated;
    });
  };

  const renderedContent = interpolateContractTemplate(
    templateType,
    contractNumber,
    startDate,
    variables
  );

  const handleSave = async () => {
    if (!clientName) {
      toast.error('Counterparty / Client Name is required');
      return;
    }
    if (!workspace?.id) {
      toast.error('Not authenticated');
      return;
    }

    setSaving(true);
    
    // Firebase crashes on undefined, so we strip any undefined values from variables
    const safeVariables = Object.fromEntries(
      Object.entries(variables).filter(([_, v]) => v !== undefined)
    );

    const contractData: Omit<Contract, 'id' | 'created_at' | 'updated_at'> = {
      contract_number: contractNumber,
      template_type: templateType,
      client_name: clientName,
      client_email: clientEmail,
      client_address: clientAddress,
      value: value ? parseFloat(value) : undefined,
      currency,
      start_date: startDate,
      end_date: endDate || undefined,
      status,
      variables: safeVariables,
      content: renderedContent,
      workspace_id: workspace?.id,
    };

    try {
      if (existingContract) {
        await updateContract(existingContract.id, contractData);
        toast.success('Contract updated successfully');
      } else {
        await createContract(contractData);
        toast.success('Contract created successfully');
      }
      router.push('/contracts');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save contract');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const title = CONTRACT_TEMPLATES.find((t) => t.id === templateType)?.name || 'Contract';
    
    // Add border and background styling
    doc.setFillColor(31, 41, 55); // Gray header
    doc.rect(0, 0, 210, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title.toUpperCase(), 15, 18);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`NO: ${contractNumber}`, 195, 18, { align: 'right' });

    // Render body
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(10);
    const splitText = doc.splitTextToSize(renderedContent, 180);
    
    let y = 45;
    const pageHeight = 280;

    for (const line of splitText) {
      if (y > pageHeight) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 15, y);
      y += 6.5;
    }

    doc.save(`${title.replace(/\s+/g, '_')}_${contractNumber}.pdf`);
    toast.success('PDF downloaded successfully');
  };

  const currentTemplate = CONTRACT_TEMPLATES.find((t) => t.id === templateType);

  const leftColumn = (
    <div className="space-y-6">
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contractNumber">Contract Number</Label>
              <Input
                id="contractNumber"
                value={contractNumber}
                onChange={(e) => setContractNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={(val) => setStatus(val as ContractStatus)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring">Expiring</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="templateType">Contract Template</Label>
            <Select value={templateType} onValueChange={(val) => setTemplateType(val as ContractTemplateType)}>
              <SelectTrigger id="templateType">
                <SelectValue placeholder="Select template" />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TEMPLATES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">{currentTemplate?.desc}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientName">
              {templateType === 'employment' ? 'Employee Name' : 'Counterparty / Client Name'}
            </Label>
            <SearchableSelect
              options={clientOptions}
              value={clientName}
              onValueChange={handleClientSelect}
              placeholder="Select or type new..."
              searchPlaceholder="Search clients..."
              allowCustom={true}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientEmail">Email Address</Label>
              <Input
                id="clientEmail"
                type="email"
                placeholder="e.g. client@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                placeholder="USD / INR / EUR"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientAddress">Billing Address</Label>
            <Textarea
              id="clientAddress"
              rows={2}
              placeholder="Full physical address"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Template variables section */}
      <Card className="border-border">
        <CardContent className="p-6 space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Template Variables
          </h4>

          {templateType === 'employment' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="jobTitle">Job Title</Label>
                <Input
                  id="jobTitle"
                  placeholder="e.g. Senior Software Engineer"
                  value={variables.jobTitle || ''}
                  onChange={(e) => handleVariableChange('jobTitle', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlySalary">Monthly Salary (INR)</Label>
                <Input
                  id="monthlySalary"
                  type="number"
                  placeholder="e.g. 75000"
                  value={variables.monthlySalary || ''}
                  onChange={(e) => handleVariableChange('monthlySalary', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hoursPerDay">Hours per Day</Label>
                  <Input
                    id="hoursPerDay"
                    type="number"
                    value={variables.hoursPerDay || '8'}
                    onChange={(e) => handleVariableChange('hoursPerDay', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="daysPerWeek">Days per Week</Label>
                  <Input
                    id="daysPerWeek"
                    type="number"
                    value={variables.daysPerWeek || '5'}
                    onChange={(e) => handleVariableChange('daysPerWeek', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="paidLeaveDays">Paid Leave (Days)</Label>
                  <Input
                    id="paidLeaveDays"
                    type="number"
                    value={variables.paidLeaveDays || '15'}
                    onChange={(e) => handleVariableChange('paidLeaveDays', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sickLeaveDays">Sick Leave (Days)</Label>
                  <Input
                    id="sickLeaveDays"
                    type="number"
                    value={variables.sickLeaveDays || '7'}
                    onChange={(e) => handleVariableChange('sickLeaveDays', e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {templateType === 'nda' && (
            <p className="text-sm text-muted-foreground">
              No extra parameters needed. Counterparty and dates are linked dynamically above.
            </p>
          )}

          {templateType === 'service' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contractValue">Contract Value ({currency})</Label>
                <Input
                  id="contractValue"
                  type="number"
                  placeholder="e.g. 5000"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sowDetails">Scope of Work (SOW)</Label>
                <Textarea
                  id="sowDetails"
                  rows={4}
                  placeholder="Describe SOW deliverables..."
                  value={variables.sowDetails || ''}
                  onChange={(e) => handleVariableChange('sowDetails', e.target.value)}
                />
              </div>
            </>
          )}

          {templateType === 'subscription' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="productName">Product Name</Label>
                <Input
                  id="productName"
                  value={variables.productName || 'Your Product'}
                  onChange={(e) => handleVariableChange('productName', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="seatLimit">Seat / User Limit</Label>
                  <Input
                    id="seatLimit"
                    type="number"
                    value={variables.seatLimit || '5'}
                    onChange={(e) => handleVariableChange('seatLimit', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingPeriod">Billing Period</Label>
                  <Select
                    value={variables.billingPeriod || 'Annual'}
                    onValueChange={(val) => {
                      handleVariableChange('billingPeriod', val);
                      handleVariableChange('billingPeriodUnit', val === 'Monthly' ? 'month' : val === 'Quarterly' ? 'quarter' : 'year');
                    }}
                  >
                    <SelectTrigger id="billingPeriod">
                      <SelectValue placeholder="Billing Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subscriptionFee">Subscription Fee ({currency})</Label>
                <Input
                  id="subscriptionFee"
                  type="number"
                  placeholder="e.g. 99"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
            </>
          )}

          {templateType === 'vendor' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contractValue">Procurement Value ({currency})</Label>
                <Input
                  id="contractValue"
                  type="number"
                  placeholder="e.g. 1500"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goodsDescription">Description of Goods / Services</Label>
                <Textarea
                  id="goodsDescription"
                  rows={3}
                  placeholder="Describe goods/services vendor provides..."
                  value={variables.goodsDescription || ''}
                  onChange={(e) => handleVariableChange('goodsDescription', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Contract Duration</Label>
                <Input
                  id="duration"
                  placeholder="e.g. 12 months"
                  value={variables.duration || '12 months'}
                  onChange={(e) => handleVariableChange('duration', e.target.value)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const rightColumn = (
    <div className="bg-card border border-border rounded-xl shadow-lg p-8 md:p-12 min-h-[842px] max-w-[595px] flex flex-col justify-between font-serif text-[10px] leading-relaxed text-foreground select-none relative whitespace-pre-wrap">
      <div>
        <div className="border-b border-border pb-4 mb-6 flex justify-between items-start font-sans">
          <div>
            <h4 className="text-xs font-black tracking-wider text-primary">TAGVERSE</h4>
            <p className="text-[8px] text-muted-foreground">brand under Blackbridge Collective</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-muted-foreground font-mono">NO: {contractNumber}</p>
            <p className="text-[8px] font-bold mt-0.5">{startDate ? new Date(startDate).toLocaleDateString() : ''}</p>
          </div>
        </div>

        <div className="text-foreground">
          {renderedContent}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push('/contracts')}
            className="rounded-xl border-border"
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {existingContract ? 'Edit Contract' : 'New Contract'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Define variables and generate contract documents.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleDownloadPdf} className="rounded-xl border-border">
            <Download size={16} className="mr-2" />
            Download PDF
          </Button>
          <Button onClick={handleSave} disabled={saving} className="rounded-xl shadow-md font-bold px-6">
            {saving ? (
              <Loader2 size={16} className="animate-spin mr-2" />
            ) : (
              <Save size={16} className="mr-2" />
            )}
            Save Contract
          </Button>
        </div>
      </div>
      <div className="max-w-4xl mx-auto w-full mt-8 pb-24 space-y-8">
        {leftColumn}
      </div>
    </div>
  );
}
