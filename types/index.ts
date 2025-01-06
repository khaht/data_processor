export interface ProcessorConfig {
  concurrency?: number;
  batchConcurrentLimit?: number;
  batchSize?: number;
  retryAttempts?: number;
  retryDelay?: number;
  authorization?: string;
  capillaryHost?: string;
}
export type CliArguments = Required<ProcessorConfig> & { input: string };

export interface CSVUser {
  [key: string]: any;
}

export interface UserWallet {
  id: string;
  loyalty_user_id: string;
  current_tier_id: string;
  loyalty_programme_id: string;
  name: string;
  current_balance: number;
  lifetime_earned_points: number;
  lifetime_expired_points: number;
  lifetime_redeemed_points: number;
  lifetime_returned_points: number;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  [key: string]: any;
}

export interface PointSummary {
  loyaltyPoints: number;
  lifetimePoints: number;
  expired: number;
  redeemed: number;
  returned: number;
}

export interface ExpireSchedule {
  expiry_date: string;
}

export interface Customer {
  external_id: string;
  item_status: {
    success: string;
    code: string;
    message: string;
    warnings: { warning: string[] };
  };
  points_summaries: {
    points_summary: PointSummary[];
  };
  expiry_schedule: ExpireSchedule[];
  [key: string]: any;
}
export interface UserDetails {
  response: { status: { code: number }; customers: { customer: Customer[] } };

  [key: string]: any;
}

export interface PointAllocation {
  id: string;
  type: string;
  points: number;
  remaining_points: number;
  expires_at: string;
  wallet_id: string;
  loyalty_rule_engine_transaction_id: string;
  created_by: string;
  audit: LoyaltyTransactionAudit;
}

export interface LoyaltyTransactionAudit {
  id: string;
  loyalty_user_id: string;
  transaction_reference_id: string;
  request_payload: Record<string, any>;
  created_by: string;
}

export type ProcessedUser = CSVUser & { success: boolean; error?: string };

export interface ProcessingResult {
  successful: ProcessedUser[];
  failed: ProcessedUser[];
  totalProcessed: number;
}
