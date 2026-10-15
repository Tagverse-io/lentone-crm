'use client';

import React from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { HelpCircle } from 'lucide-react';

const TERMS_DEFINITIONS: Record<string, { what: string; why: string; example: string }> = {
  // Audit Report Terms
  overall_health: {
    what: "A score summarizing your business's financial safety.",
    why: "Tells you instantly if the business is doing well or needs help.",
    example: "Excellent = Profitable & Safe. Poor = Losing money or Risky."
  },
  ledger_integrity: {
    what: "Verifies that all math in your accounting 'book' balances out.",
    why: "Ensures no money is missing or fake money created by mistake.",
    example: "If you logged +$100 income, the bank account must also show +$100."
  },
  compliance_status: {
    what: "Automatic rules to check if your records follow accounting laws.",
    why: "Prevents legal trouble and tax audit nightmares.",
    example: "Checking that you don't have negative cash (which is impossible)."
  },
  liquidity_status: {
    what: "Your ability to pay immediate bills with cash you have now.",
    why: "You can be rich in property but penniless in cash (bad for bills).",
    example: "High = Plenty of cash. Low = Struggle to pay rent."
  },
  cash_position: {
    what: "The total calculated amount of money currently available.",
    why: "This is your fuel gauge for the business engine.",
    example: "Bank Balance + Cash in Hand = Cash Position."
  },
  revenue_trend: {
    what: "The direction your income is moving over time.",
    why: "Growing income is the main goal. Shrinking needs fixing.",
    example: "Jan: $5k, Feb: $6k = Increasing (Good!)."
  },
  expense_trend: {
    what: "The direction your spending is moving over time.",
    why: "You want this to stay flat or grow slower than revenue.",
    example: "Jan: $2k, Feb: $4k = Increasing (Watch out!)."
  },
  net_income: {
    what: "The actual profit left after paying all expenses.",
    why: "This is what you actually get to keep or reinvest.",
    example: "Revenue ($100) - Expenses ($80) = Net Income ($20)."
  },
  anomalies: {
    what: "Suspicious or weird entries that don't look right.",
    why: "Helps catch mistakes or potential theft/fraud early.",
    example: "A transaction for $0.01 or a date in the future."
  },

  // Main Finance Page Terms
  current_balance: {
    what: 'The actual money you allow yourself to spend right now.',
    why: 'Prevents you from spending money you do not have.',
    example: 'Starting Balance + All Income - All Expenses.'
  },
  total_revenue: {
    what: 'Total money coming into the business from all sources.',
    why: 'Higher revenue means more growth potential.',
    example: 'Client Payments + Sales + Investments.'
  },
  total_expenses: {
    what: 'Total money leaving the business for any reason.',
    why: 'Keeping this low increases your profit.',
    example: 'Server Costs + Office Rent + Salaries.'
  },
  pending_revenue: {
    what: 'Money that clients owe you but haven\'t paid yet.',
    why: 'Important to track what you are expecting, not just what you have.',
    example: 'Invoices marked "Pending" waiting for customer payment.'
  },
  transaction_ledger: {
    what: 'A master list of every single time money moved.',
    why: 'Provides the proof and detail behind your summary numbers.',
    example: 'Like your bank statement history.'
  },
  transaction_category: {
    what: 'Labels to group similar types of spending.',
    why: 'Helps you see exactly where your money is going.',
    example: 'Software Subscriptions, Office Supplies, Travel.'
  },
  transaction_type: {
    what: 'Classifies money as either coming in (Income) or going out (Expense).',
    why: 'Fundamental for knowing if you are making or losing money.',
    example: 'Income (+) vs Expense (-).'
  },
  
  // New Audit Terms
  total_transactions: {
    what: 'The count of every distinct financial record created.',
    why: 'High volume might need more automated checking tools.',
    example: '50 invoices + 20 expenses = 70 Total Transactions.'
  },
  accounts_monitored: {
    what: 'Individual buckets where money is tracked.',
    why: 'Separating money helps you organize and analyze it better.',
    example: 'Bank, Cash in Hand, Sales, Office Expenses.'
  },
  monthly_cash_flow: {
    what: 'A timeline showing money coming in vs. money going out.',
    why: 'Helps you spot seasonal patterns and plan for lean months.',
    example: 'High spending in Dec, High income in Jan.'
  },
  financial_position: {
    what: 'A snapshot of what you own (Assets) vs. what you owe (Liabilities).',
    why: 'The true measure of company wealth, not just cash.',
    example: 'Own $1M Building + Owe $200k Loan = Strong Position.'
  },
  revenue_by_source: {
    what: 'Breakdown of where your money is coming from.',
    why: 'Identify your most profitable products or services.',
    example: '70% Consulting, 30% Software Sales.'
  },
  expenses_by_category: {
    what: 'Breakdown of where your money is going.',
    why: 'Identify areas where you can cut costs.',
    example: '40% Salaries, 20% Rent, 10% Travel.'
  },
  account_balance_distribution: {
    what: 'How your wealth is spread across different accounts.',
    why: 'Risk management; don\'t keep all eggs in one basket.',
    example: '90% in Bank vs 10% in Cash.'
  },
  audit_trail: {
    what: 'The history of who created what record and when.',
    why: 'Essential for security and tracking down errors.',
    example: 'John added Expense #123 on Monday at 2pm.'
  },
  recommendations: {
    what: 'Smart suggestions to improve your financial health.',
    why: 'Actionable advice generated from your data patterns.',
    example: '"Reduce travel expenses" or "Collect pending invoices".'
  },
  account_analysis: {
    what: 'Deep dive into each specific account usage.',
    why: 'Finds accounts that are dormant or over-utilized.',
    example: 'Checking which expense category is used most often.'
  }
};

export const TermHelp = ({ term }: { term: string }) => {
  const def = TERMS_DEFINITIONS[term];
  if (!def) return null;
  return (
    <HoverCard openDelay={200}>
      <HoverCardTrigger asChild>
        <div className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-colors ml-1.5 align-middle cursor-help tabindex-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" role="button" tabIndex={0}>
          <HelpCircle className="h-3.5 w-3.5" />
          <span className="sr-only">Explain {term}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 bg-white/95 backdrop-blur-sm shadow-xl border-slate-200">
        <div className="space-y-3">
          <div>
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-1">
              <HelpCircle className="h-4 w-4 text-primary" /> What is it?
            </h4>
            <p className="text-sm text-slate-600 leading-snug">{def.what}</p>
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-900 mb-1">Why it matters?</h4>
            <p className="text-sm text-slate-600 leading-snug">{def.why}</p>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-md border border-slate-100">
            <p className="text-xs text-slate-700">
              <span className="font-semibold text-primary">Example: </span>
              {def.example}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
