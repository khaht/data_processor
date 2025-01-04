import axios from 'axios';
import pLimit from 'p-limit';
import { parse } from 'csv-parse';
import fs from 'fs';
import { v4 as uuid } from 'uuid';

import { CSVUser, Customer, ProcessedUser, ProcessingResult, ProcessorConfig, UserDetails } from '../types';
import { pointAllocationGenerator } from '../utils/helpers';
import { logError } from '../utils/logs';

export class DataProcessor {
  private limit: ReturnType<typeof pLimit>;
  private batchConcurrentLimit: number;
  private batchSize: number;
  private retryAttempts: number;
  private retryDelay: number;
  private apiToken: string;

  constructor(config: ProcessorConfig = {}) {
    this.limit = pLimit(config.concurrency || 50);
    this.batchSize = config.batchSize || 10;
    this.batchConcurrentLimit = config.batchConcurrentLimit || 10;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 500;
    this.apiToken = config.apiToken || '';
  }

  async processCSVFile(filePath: string): Promise<ProcessingResult> {
    let processedCount = 0;
    const userDetails: ProcessedUser[] = [];
    const batchArray: CSVUser[] = [];

    /**
     * Create a readable stream from CSV file and parse into objects
     * columns: true -> Use the first row as column names
     * skip_empty_lines: true -> Skip empty lines in CSV
     */
    const parser = fs.createReadStream(filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
      }),
    );

    // Iterate through each record in the CSV file using async iterator
    for await (const record of parser) {
      // Add current record to temporary array for batch processing
      batchArray.push(record as CSVUser);

      // Check if we have enough records for a full batch
      if (batchArray.length >= this.batchSize) {
        // Call API to process current batch of records
        const results = await this.processBatch(batchArray);

        // Iterate through results and add them to final results array
        results.forEach((result) => {
          userDetails.push(...result);
        });

        // Update the count of processed records
        processedCount += batchArray.length;
        console.log(`Processed ${processedCount} users`);

        // Clear batch array for next batch
        batchArray.length = 0;

        // Delay for 1 second before processing next batch to avoid API overload
        await this.delay(1000);
      }
    }

    // Process remaining records that weren't enough to form a complete batch
    if (batchArray.length > 0) {
      // Call API to process final batch
      const results = await this.processBatch(batchArray);

      // Add results to final results array
      results.forEach((result) => {
        userDetails.push(...result);
      });

      // Update final count of processed records
      processedCount += batchArray.length;
      console.log(`Processed ${processedCount} users`);
    }

    const successful = userDetails.filter((user) => user.success);
    const failed = userDetails.filter((user) => !user.success);

    return {
      successful,
      failed,
      totalProcessed: processedCount,
    };
  }

  // Process a batch of users by splitting them into smaller concurrent batches
  private processBatch(users: CSVUser[]): Promise<ProcessedUser[][]> {
    const batchConcurrentArray = [];

    /**
     * Split users array into smaller batches based on concurrent limit
     * e.g. if we have 1000 users and concurrent limit is 100,
     * we'll create 10 batches of 100 users each
     */
    for (let i = 0; i < users.length; i += this.batchConcurrentLimit) {
      /**
       * Slice users array to get current batch of users
       * slice(i, i + limit) will get users from index i up to (not including) i + limit
       */
      const batches: CSVUser[] = users.slice(i, i + this.batchConcurrentLimit);
      batchConcurrentArray.push(batches);
    }

    /**
     * Use p-limit to control concurrency of API requests
     * this.limit ensures we don't exceed max concurrent requests
     * this.fetchUserDetailsBatch handles the actual API call for each batch
     */
    const promises = batchConcurrentArray.map((users: CSVUser[]) => this.limit(() => this.fetchUserDetailsBatch(users)));

    return Promise.all(promises);
  }

  private async fetchUserDetailsBatch(users: CSVUser[]): Promise<ProcessedUser[]> {
    try {
      const userIds = users.map((user) => user.loyalty_user_id).join(',');
      const result = await this.makeRequestWithRetry(async () => {
        const response = await axios.get<UserDetails>(
          `https://apac.api.capillarytech.com/v1.1/customer/get?format=json&external_id=${userIds}&user_id=true&segments=true&tier_upgrade_criteria=true&slab_history=true&format=json&transactions=false&notes=false&user_id=true&mlp=true&expiry_schedule=true&expired_points=true&point_summary=true`,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: this.apiToken,
            },
          },
        );

        return users.map((user) => {
          let additionalUserDetails: Record<string, any> = {
            current_balance: 0,
            lifetime_earned_points: 0,
            lifetime_expired_points: 0,
            lifetime_redeemed_points: 0,
            lifetime_returned_points: 0,
            name: '',
          };
          const {
            data: {
              response: {
                status: { code },
                customers: { customer },
              },
            },
          } = response;
          let success = false;
          let userDetails: Customer | undefined;
          const walletId = uuid();

          if (code === 200 || code === 201) {
            userDetails = customer.find((c) => c.external_id === user.loyalty_user_id);
            if (userDetails && userDetails?.item_status.success === 'true') {
              success = true;
              additionalUserDetails = {
                name: `${!userDetails?.firstname && !userDetails?.lastname ? '' : `${userDetails?.firstname} ${userDetails?.lastname}`}`,
                current_balance: Number(userDetails?.points_summaries?.points_summary?.[0]?.loyaltyPoints) || 0,
                lifetime_earned_points: Number(userDetails?.points_summaries?.points_summary?.[0]?.lifetimePoints) || 0,
                lifetime_expired_points: Number(userDetails?.points_summaries?.points_summary?.[0]?.expired) || 0,
                lifetime_redeemed_points: Number(userDetails?.points_summaries?.points_summary?.[0]?.redeemed) || 0,
                lifetime_returned_points: Number(userDetails?.points_summaries?.points_summary?.[0]?.returned) || 0,
                is_multiple_points_expiry: !!userDetails?.expiry_schedule?.length,
                point_allocations: pointAllocationGenerator(userDetails, walletId),
              };
            } else {
              additionalUserDetails = {
                ...userDetails,
              };
            }
          }

          return {
            id: walletId,
            loyalty_user_id: user.loyalty_user_id,
            current_tier_id: user.current_tier,
            loyalty_programme_id: '', // need to confirm
            created_at: user.created_at,
            updated_at: user.updated_at,
            created_by: user.loyalty_user_id,
            updated_by: user.loyalty_user_id,
            ...additionalUserDetails,
            success,
          };
        });
      });
      if ('error' in result) {
        return users.map((user) => ({
          ...user,
          success: false,
          error: result.error,
        }));
      }
      return result as ProcessedUser[];
    } catch (error) {
      // If the batch request fails, mark all users in the batch as failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to fetch details for batch:`, errorMessage);

      return users.map((user) => ({
        ...user,
        success: false,
        error: `Batch request failed: ${errorMessage}`,
      })) as any;
    }
  }

  private async makeRequestWithRetry<T>(requestFn: () => Promise<T>): Promise<T | { error: string; details: any }> {
    const timeUnix = new Date().getTime();
    const destinationFolder = `${process.cwd()}/error_logs`;
    const errorLogPath = `${destinationFolder}/errors_${timeUnix}.json`;

    // Try the request with retries
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        return await requestFn();
      } catch (error) {
        if (attempt === this.retryAttempts) {
          if (!fs.existsSync(destinationFolder)) {
            fs.mkdirSync(destinationFolder, { recursive: true });
          }
          // Log the final failure
          logError(error, attempt, errorLogPath);
          // Return error object instead of throwing
          return {
            error: 'Request failed after all retry attempts',
            details: error,
          };
        }

        if (axios.isAxiosError(error) && error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || String(this.retryDelay));
          console.log(`Rate limited, waiting ${retryAfter} seconds before retry ${attempt + 1}/${this.retryAttempts}`);
          await this.delay(retryAfter * 1000);
        } else {
          console.log(`Request failed, attempt ${attempt}/${this.retryAttempts}, retrying in ${this.retryDelay}ms`);
          await this.delay(this.retryDelay);
        }
      }
    }

    return {
      error: 'Unexpected end of retry loop',
      details: null,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
