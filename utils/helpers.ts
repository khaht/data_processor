import { Customer, LoyaltyTransactionAudit, PointAllocation, ProcessedUser, UserWallet } from '../types';
import { v4 as uuid } from 'uuid';

export const transactionAuditGenerator = (userId: string): LoyaltyTransactionAudit => {
  return {
    id: uuid(),
    loyalty_user_id: userId,
    transaction_reference_id: uuid(),
    created_by: userId,
    request_payload: {
      loyalty_user_id: userId,
      points_to_migrate: 'loyalty_points',
    },
  };
};

export const pointAllocationGenerator = (userDetails: Customer, walletId: string): PointAllocation[] => {
  const pointAllocation: PointAllocation[] = [];
  const { expiry_schedule, points_summaries } = userDetails;
  if (expiry_schedule && expiry_schedule.length > 0) {
    expiry_schedule.forEach((schedule) => {
      const transactionAudit = transactionAuditGenerator(userDetails.external_id);
      pointAllocation.push({
        id: uuid(),
        type: 'POINTS_ADDED',
        points: Number(points_summaries?.points_summary?.[0]?.loyaltyPoints) || 0,
        remaining_points: Number(points_summaries?.points_summary?.[0]?.loyaltyPoints) || 0,
        expires_at: schedule.expiry_date,
        wallet_id: walletId,
        loyalty_rule_engine_transaction_id: transactionAudit.id,
        created_by: userDetails.external_id,
        audit: transactionAudit,
      });
    });
  }
  return pointAllocation;
};

export const newWallet = (data: ProcessedUser): UserWallet => ({
  id: data.id,
  loyalty_user_id: data.loyalty_user_id,
  current_tier_id: data.current_tier_id,
  loyalty_programme_id: data.loyalty_programme_id,
  name: data.name,
  current_balance: data.current_balance,
  lifetime_earned_points: data.lifetime_earned_points,
  lifetime_expired_points: data.lifetime_expired_points,
  lifetime_redeemed_points: data.lifetime_redeemed_points,
  lifetime_returned_points: data.lifetime_returned_points,
  created_at: data.created_at,
  updated_at: data.updated_at,
  created_by: data.created_by,
  updated_by: data.updated_by,
});

export const newPointAllocation = (p: PointAllocation): Omit<PointAllocation, 'audit'> => ({
  id: p.id,
  type: p.type,
  points: p.points,
  remaining_points: p.remaining_points,
  expires_at: p.expires_at,
  wallet_id: p.wallet_id,
  loyalty_rule_engine_transaction_id: p.loyalty_rule_engine_transaction_id,
  created_by: p.created_by,
});

export const formatExecutionTime = (startTime: number, endTime: number): string => {
  const durationInMs = endTime - startTime;
  const hours = Math.floor(durationInMs / (1000 * 60 * 60));
  const minutes = Math.floor((durationInMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((durationInMs % (1000 * 60)) / 1000);
  const milliseconds = durationInMs % 1000;

  return `${hours}h ${minutes}m ${seconds}s ${milliseconds}ms`;
};
